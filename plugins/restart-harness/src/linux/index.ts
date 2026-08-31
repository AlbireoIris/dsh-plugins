/**
 * Restart Harness host half — one-click restart of the running dsh web
 * service. The POST endpoint replies BEFORE any kill happens and spawns a
 * DETACHED helper that sleeps, kills THIS process by PID, then re-runs the
 * launcher script, so the service comes back exactly as on boot.
 *
 * Carrier note (measured on one Linux machine, kept as hard knowledge): a
 * plain `spawn`'d helper stays inside the host's process tree, and dsh's
 * teardown signal-funnels that whole tree — a normally-spawned helper would
 * be killed before it could act. The helper therefore re-execs itself through
 * `setsid nohup` (a new session / process group, reparented to init), which
 * the host teardown cannot reach. This is the same double-fork the local dsh
 * restart script uses.
 *
 * Visibility and recovery: spawn 'error'/'exit' events and every helper step
 * are appended to the configurable log file, and the re-entry guard clears
 * itself when the helper exits (or never starts) so a failed attempt can be
 * retried.
 *
 * A companion GET /dsh-health endpoint reports a per-process boot id so the
 * browser can detect the new process and refresh immediately.
 */
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import type { ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'restart-harness'

/** Required services: the Web carrier supplies the HTTP route. */
export const inject = ['webServer']

/** Per-process boot identity; changes on every restart. */
const BOOT_ID = randomUUID()

/** Deployment-varying knobs, each optional in the cordis.yml row config. */
export interface RestartHarnessConfig {
  /** Log file for host/helper events. Default: $TMPDIR/dsh-restart/restart-harness.log */
  logFile?: string
  /** Shell launcher executed after the kill. Default: <home>/.dsh/bin/start-dsh-web.sh */
  launcherScript?: string
  /** Delay (ms) between the 200 response and the kill. Default: 800 */
  killDelayMs?: number
  /** Delay (ms) between the kill and the relaunch. Default: 1000 */
  relaunchDelayMs?: number
}

export function apply(ctx: Context, rawConfig?: Partial<RestartHarnessConfig>): void {
  const config = resolveConfig(rawConfig)
  let pending = false

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh-health',
    handler: async (_req, res) => {
      respond(res, 200, { bootId: BOOT_ID })
    },
  }), 'restart-harness: GET /dsh-health')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh/restart-harness',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        respond(res, 405, { ok: false, message: 'Use POST' })
        return
      }
      if (pending) {
        respond(res, 409, { ok: false, message: 'Restart already in progress; please wait.' })
        return
      }
      pending = true
      try {
        const child = launchRestartHelper(config)
        child.on('error', (error) => {
          logHost(config, 'helper spawn error: ' + error.message)
          pending = false
        })
        child.on('exit', (code) => {
          logHost(config, 'helper exited, code=' + String(code))
          pending = false
        })
        respond(res, 200, { ok: true, message: 'Restarting in a few seconds.' })
      } catch (error) {
        pending = false
        respond(res, 500, { ok: false, message: String(error instanceof Error ? error.message : error) })
      }
    },
  }), 'restart-harness: POST /dsh/restart-harness')
}

/** Merge row config over the defaults. */
function resolveConfig(overrides: Partial<RestartHarnessConfig> = {}): Required<RestartHarnessConfig> {
  return {
    logFile: overrides.logFile ?? join(tmpdir(), 'dsh-restart', 'restart-harness.log'),
    launcherScript: overrides.launcherScript ?? join(homedir(), '.dsh', 'bin', 'start-dsh-web.sh'),
    killDelayMs: overrides.killDelayMs ?? 800,
    relaunchDelayMs: overrides.relaunchDelayMs ?? 1000,
  }
}

/**
 * Write a self-contained bash helper to the temp dir and spawn it detached.
 * The helper re-execs itself through `setsid nohup` (its own session, outside
 * the host's tree), sleeps, then runs the launcher script — which owns the
 * kill + relaunch — to bring the service back. Every step writes to the log
 * file so a partial failure is visible, and the re-entry guard clears on
 * spawn error/exit.
 */
function launchRestartHelper(config: Required<RestartHarnessConfig>): ChildProcess {
  const dir = join(tmpdir(), 'dsh-restart')
  mkdirSync(dir, { recursive: true })
  const helperPath = join(dir, `restart-helper-${process.pid}.sh`)
  writeFileSync(helperPath, buildHelperSource(config), 'utf8')
  logHost(config, 'helper script written: ' + helperPath)
  const child = spawn('bash', [helperPath], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
  return child
}

/**
 * Bash helper body. The helper only triggers the launcher, which owns the
 * kill: it finds the listening PID, kills it, then relaunches. The helper
 * itself does NOT kill the host — a helper-side kill would race the launcher
 * (which looks up the PID by the listening port) and leave it with no PID to
 * target, so the service would stay down. The helper runs detached and exits
 * on its own once the launcher is spawned.
 */
function buildHelperSource(config: Required<RestartHarnessConfig>): string {
  // Single-quote interpolated paths so spaces/metacharacters survive in bash.
  const quote = (s: string): string => `'${s.replace(/'/gu, "'\\''")}'`
  const log = quote(config.logFile)
  const launcher = quote(config.launcherScript)
  // Milliseconds -> decimal seconds (GNU sleep accepts fractional values).
  const killSleep = (config.killDelayMs / 1000).toFixed(3)
  return [
    '#!/bin/bash',
    'set -u',
    `LOG=${log}`,
    // Double-fork guard: re-exec ourselves through setsid nohup so the helper
    // runs in its own session, outside the host's process tree (host teardown
    // signal-funnels that tree but cannot reach a new session).
    'if [ "${DSH_RESTART_DETACHED:-}" != "1" ]; then',
    '  export DSH_RESTART_DETACHED=1',
    '  setsid nohup bash "$0" >> "$LOG" 2>&1 < /dev/null &',
    '  WORKER=$!',
    // Keep the re-entry guard locked while the worker runs: this guard copy
    // is still in the host's tree, so once the worker kills the host the
    // host teardown funnels this copy down and the /exit handler releases
    // `pending`. Until then `pending` stays true, so another tab cannot stack
    // a second restart into the same window.
    '  wait "$WORKER" 2>/dev/null',
    '  exit 0',
    'fi',
    `sleep ${killSleep}`,
    // Fire-and-forget the launcher so the helper itself never lingers. The
    // launcher owns the kill + relaunch; the helper must NOT kill first.
    `setsid nohup bash ${launcher} >> "$LOG" 2>&1 < /dev/null &`,
    'exit 0',
  ].join('\n') + '\n'
}

/** Append one line to the log; never throws. */
function logHost(config: Required<RestartHarnessConfig>, message: string): void {
  try {
    appendFileSync(config.logFile, new Date().toISOString() + ' host: ' + message + '\n', 'utf8')
  } catch {
    // Logging must never break the endpoint; nothing else can reach here.
  }
}

/** Simple JSON response writer (no server-framework dependency). */
function respond(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
