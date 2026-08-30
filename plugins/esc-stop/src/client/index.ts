/**
 * esc-stop client half: ESC while the session shown on screen is generating
 * cancels it, mirroring Claude Code's stop gesture.
 *
 * Layering: an open popup / command / @ menu consumes ESC first — the
 * composer keymap preventDefaults a consumed Escape — so an unconsumed ESC
 * (no menu open, no composition, editor focus or not) is the stop gesture.
 * Cancel routes through the exact Stop-button path (`Session.cancel`), so
 * failures land in the same promptError channel.
 */
import type { Context } from '@deepseek-ai/cordis'

/** Read face of the client sessions service (ui-conversation's own source). */
interface SessionsService {
  readonly list: {
    getSnapshot(): {
      readonly current?: string
      readonly byId: Readonly<Record<string, { readonly running: boolean }>>
    }
  }
  binding(id: string): { session: { cancel(): Promise<unknown> } } | undefined
}

export const inject = ['sessions']

/** Register the window-level ESC-to-stop listener. */
export function apply(ctx: Context): void {
  const sessions = ctx.sessions

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Escape' || event.repeat) return
    // IME composition and its late keyCode-229 cousin must not cancel typing.
    // oxlint-disable-next-line typescript/no-deprecated -- the legacy signal is the documented IME guard
    if (event.isComposing || event.keyCode === 229) return
    // An open popup/menu already claimed this Escape (composer keymap
    // preventDefaults consumed escapes): let it close, do not stop.
    if (event.defaultPrevented) return

    const state = sessions.list.getSnapshot()
    const current = state.current
    if (current === undefined) return
    const row = state.byId[current]
    if (row === undefined || !row.running) return

    event.preventDefault()
    void sessions.binding(current)?.session.cancel()
  }

  window.addEventListener('keydown', onKeyDown)
  ctx.effect(() => () => window.removeEventListener('keydown', onKeyDown))
}
