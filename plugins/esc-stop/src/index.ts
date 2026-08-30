/**
 * esc-stop host half: no host behavior — the ESC-to-stop logic lives entirely
 * in the browser client. The node half exists so the package resolves as a
 * row in the web composition and ships the client bundle.
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'esc-stop'

/** Intentional no-op; see the header comment. */
export function apply(_ctx: Context): void {}
