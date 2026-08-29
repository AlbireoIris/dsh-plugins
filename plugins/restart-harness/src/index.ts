/**
 * Restart Harness host half — one-click restart of the running dsh web
 * service. The POST endpoint replies BEFORE any kill happens and spawns a
 * DETACHED helper that sleeps, kills THIS process by PID, then re-runs the
 * logon launcher script, so the service comes back exactly as on boot.
 *
 * Carrier note (measured on one Windows machine, kept as hard knowledge):
 * DETACHED console-subsystem children (node/powershell/cmd) died at
 * process-creation without executing their body, while detached
 * GUI-subsystem wscript.exe ran fully. The community flow is unchanged; the
 * helper interpreter is wscript/VBS, whose kill primitive is PowerShell
 * `Stop-Process` launched through WshShell.Run — the same chain the logon
 * autostart uses — so the helper survives the host's death by design.
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
  /** Log file for host/helper events. Default: %TEMP%/dsh-restart/restart-harness.log */
  logFile?: string
  /** PowerShell launcher executed after the kill. Default: <home>/.dsh/bin/start-dsh-web.ps1 */
  launcherScript?: string
  /** Delay (ms) between the 200 response and the kill. Default: 800 */
  killDelayMs?: number
  /** Delay (ms) between the kill and the relaunch. Default: 1000 */
  relaunchDelayMs?: number
}

export function apply(ctx: Context): void {
  const config = resolveConfig(ctx)
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
function resolveConfig(ctx: Context): Required<RestartHarnessConfig> {
  const overrides = (ctx.config ?? {}) as Partial<RestartHarnessConfig>
  return {
    logFile: overrides.logFile ?? join(tmpdir(), 'dsh-restart', 'restart-harness.log'),
    launcherScript: overrides.launcherScript ?? join(homedir(), '.dsh', 'bin', 'start-dsh-web.ps1'),
    killDelayMs: overrides.killDelayMs ?? 800,
    relaunchDelayMs: overrides.relaunchDelayMs ?? 1000,
  }
}

/**
 * Write a self-contained VBScript helper to the temp dir and spawn it via
 * wscript.exe, detached. The helper sleeps, kills THIS process by PID through
 * PowerShell Stop-Process, then runs the launcher script to bring the service
 * back. Every step writes to the log file so a partial failure is visible,
 * and the re-entry guard clears on spawn error/exit.
 */
function launchRestartHelper(config: Required<RestartHarnessConfig>): ChildProcess {
  const dir = join(tmpdir(), 'dsh-restart')
  mkdirSync(dir, { recursive: true })
  const helperPath = join(dir, `restart-helper-${process.pid}.vbs`)
  writeFileSync(helperPath, buildHelperSource(config), 'utf8')
  logHost(config, 'helper script written: ' + helperPath)
  const child = spawn('wscript.exe', ['//nologo', helperPath], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
  })
  child.unref()
  return child
}

/**
 * VBScript helper body. Kill = PowerShell `Stop-Process` via WshShell.Run
 * (the logon autostart chain); relaunch = the same chain running the launcher
 * script. Errors are tolerated (On Error Resume Next) so a partial failure
 * still logs and exits; the script reaches its end and wscript exits on its
 * own — no lingering process.
 */
function buildHelperSource(config: Required<RestartHarnessConfig>): string {
  // VBScript string literals do not process backslash escapes; a doubled
  // backslash here only serves Windows path tolerance, so single is fine.
  const log = config.logFile
  const pid = process.pid
  const launcher = config.launcherScript
  return [
    'Option Explicit',
    'On Error Resume Next',
    'Dim fso, f, ts, sh',
    'Set fso = CreateObject("Scripting.FileSystemObject")',
    'Set sh = CreateObject("WScript.Shell")',
    `If fso.FileExists("${log}") Then`,
    '  Set f = fso.GetFile("' + log + '")',
    '  Set ts = f.OpenAsTextStream(8, -2)',
    `  ts.WriteLine Now & " helper: started pid=${pid}"`,
    '  ts.Close',
    'End If',
    `WScript.Sleep ${config.killDelayMs}`,
    `sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -Command ""Stop-Process -Id ${pid} -Force -ErrorAction SilentlyContinue""", 0, True`,
    `If fso.FileExists("${log}") Then`,
    '  Set f = fso.GetFile("' + log + '")',
    '  Set ts = f.OpenAsTextStream(8, -2)',
    `  ts.WriteLine Now & " helper: kill issued for pid=${pid}"`,
    '  ts.Close',
    'End If',
    `WScript.Sleep ${config.relaunchDelayMs}`,
    'sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""' + launcher + '""", 0, False',
  ].join('\r\n')
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
