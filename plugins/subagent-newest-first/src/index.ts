/**
 * subagent-newest-first host half: no host behavior — the catalog ordering is
 * purely a browser-client presentation concern. The node half exists so the
 * package resolves as a row in the web composition and ships the client
 * bundle (same shape as esc-stop).
 */
import type { Context } from '@deepseek-ai/cordis'

export const name = 'subagent-newest-first'

/** Intentional no-op; see the header comment. */
export function apply(_ctx: Context): void {}
