/**
 * File-reference browser client half: registers a `@` trigger source that
 * lists local file/directory candidates (queried from the Host scan) and, on
 * pick, inserts the `@path` mention — quoted `@"path with spaces"` when the
 * path contains whitespace, per the shared reference grammar; picking a
 * directory keeps its trailing slash so the user can descend further.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the SlotRegistry service merge (ctx.slots) and the
// conversation header-utilities SlotMap member.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'

/** The Host endpoint answering candidate queries. */
const CANDIDATES_PATH = '/dsh/file-candidates'

/** One candidate row as the Host returns it. */
export interface FileCandidate {
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'directory'
  readonly size: number
  readonly mtime: number
}

export const inject = ['inputTriggers']

/** Register the `@` file candidate source. */
export function apply(ctx: Context): void {
  const inputTriggers = ctx.get('inputTriggers') as {
    registerSource(source: InputTriggerSource): () => void
  } | undefined
  if (inputTriggers === undefined) {
    // The slash pipeline is optional; without it the reference feature is inert.
    return
  }
  const source: InputTriggerSource = {
    trigger: '@',
    name: 'file',
    order: 3,
    async candidates(_session, { query }) {
      try {
        const response = await fetch(CANDIDATES_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        if (!response.ok) return []
        const body = (await response.json()) as { candidates?: FileCandidate[] }
        return (body.candidates ?? []).map(candidate => ({
          name: candidate.name,
          description: candidate.path,
          icon: candidate.kind === 'directory' ? 'folder' as const : 'file' as const,
          value: candidate.path,
        }))
      } catch {
        return []
      }
    },
    onPick({ candidate }) {
      const path = candidate.value ?? ''
      return { text: formatMention(path, candidate.icon === 'folder') }
    },
  }
  ctx.effect(() => {
    const unregister = inputTriggers.registerSource(source)
    return unregister
  }, 'file-reference: @ source')
}

/**
 * Format a selected path as prompt text: whitespace uses the quoted
 * `@"path"` grammar; a directory keeps that quote open after its trailing
 * slash so completion can descend another level.
 */
function formatMention(path: string, directory: boolean): string {
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return `@${path}`
  if (directory) {
    return path.includes(' ') ? `@"${path}/` : `@${path}/`
  }
  return path.includes(' ') ? `@"${path}"` : `@${path}`
}
