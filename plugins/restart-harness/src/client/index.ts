/**
 * Restart Harness session-header utility. Registers one pill into the
 * `conversation.session.header.utilities` slot — beside the Session-log
 * export button, one order step after it. Clicking it runs the full restart
 * flow: POST the Host endpoint, watch GET /dsh-health until the boot id
 * changes (the restart really happened), then reload the page automatically.
 * Every stage is reported back so the pill shows whether the restart
 * succeeded or failed and why.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the SlotRegistry service merge (ctx.slots) and the
// conversation header-utilities SlotMap member.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import { RestartButton } from './RestartButton.tsx'
// Type-only: import binds the injected face into this module's scope, and the
// re-export keeps it part of the package's public client API.
import type { RestartButtonInjected, RestartStatus } from './RestartButton.tsx'

export type { RestartButtonInjected, RestartStatus }

/** The Host endpoint answering RESTART requests. */
const RESTART_PATH = '/dsh/restart-harness'
/** Liveness probe returning the per-process boot id. */
const HEALTH_PATH = '/dsh-health'
/** Poll cadence (ms) while a restart is in flight. */
const POLL_MS = 1000
/** Give up after this long without a boot-id change (ms). */
const FAIL_AFTER_MS = 60000
/** Pause before the final reload so the success state is visible (ms). */
const SUCCESS_PAUSE_MS = 300

export const inject = ['slots']

/** Register the utility pill with the restart flow and boot-change reload. */
export function apply(ctx: Context): void {
  ctx.slots.inject('conversation.session.header.utilities', () => ctx.slots.register({
    name: 'conversation.session.header.utilities',
    id: 'restart-harness',
    order: 1,
    inject: (): RestartButtonInjected => ({
      restart: async (onStatus) => {
        onStatus('pending')
        try {
          const response = await fetch(RESTART_PATH, { method: 'POST' })
          if (response.status === 200) {
            onStatus('triggered')
            void watchForReboot(onStatus)
            return
          }
          if (response.status === 409) {
            // Another tab already started a restart; keep the pill locked —
            // its watcher (or ours, once boot id changes) reloads the page.
            onStatus('duplicate')
            return
          }
          console.error('[restart-harness] restart request failed:', response.status)
          onStatus('request-failed')
        } catch (error) {
          console.error('[restart-harness] restart request threw:', error)
          onStatus('request-failed')
        }
      },
    }),
  }, RestartButton))
}

/**
 * Poll /dsh-health until the boot id differs from the one this page loaded
 * under, then reload. The poll runs page-side, so it survives the host process
 * dying (the fetch errors until the new process listens again) and reloads
 * immediately on the new instance. If the boot id never changes within
 * FAIL_AFTER_MS — the host stayed alive (kill never happened) or never came
 * back (relaunch failed) — the flow reports 'restart-failed' so the pill can
 * unlock for a retry instead of waiting forever.
 */
async function watchForReboot(onStatus: (status: RestartStatus) => void): Promise<void> {
  let previous: string | undefined
  let hostDown = false
  try {
    const health = await fetch(HEALTH_PATH, { cache: 'no-store' })
    if (health.ok) previous = ((await health.json()) as { bootId?: string }).bootId
  } catch {
    // Host already down; nothing to compare yet.
  }
  const deadline = Date.now() + FAIL_AFTER_MS
  for (;;) {
    await new Promise(resolve => setTimeout(resolve, POLL_MS))
    if (Date.now() > deadline) {
      onStatus('restart-failed')
      return
    }
    try {
      const health = await fetch(HEALTH_PATH, { cache: 'no-store' })
      if (!health.ok) {
        if (!hostDown) {
          hostDown = true
          onStatus('dying')
        }
        continue
      }
      const bootId = ((await health.json()) as { bootId?: string }).bootId
      if (bootId !== undefined && bootId !== previous) {
        onStatus('success')
        setTimeout(() => window.location.reload(), SUCCESS_PAUSE_MS)
        return
      }
    } catch {
      // Host is down: report the first unreadable probe as dying, keep polling.
      if (!hostDown) {
        hostDown = true
        onStatus('dying')
      }
    }
  }
}
