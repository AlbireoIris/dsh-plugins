/**
 * Global file reference client half: registers an additional `@` source
 * (order 0, above the official workspace-reference source) that completes
 * drive roots and one-level directory children across every disk, with the
 * last-used picks pinned at the very top. Coexists with the official
 * ui-reference source; picking inserts the shared `@path` mention grammar.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'

/** The Host endpoint answering completion queries. */
const LIST_PATH = '/dsh/ref-list'
/** localStorage key for the recent-picks pin. */
const RECENT_KEY = 'dsh-global-ref-recent'
/** Max recent entries pinned at the top. */
const RECENT_MAX = 8

export interface FileCandidate {
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'directory'
  readonly label?: string
}

export const inject = ['inputTriggers']

/** Register the `@` global-file completion source. */
export function apply(ctx: Context): void {
  const inputTriggers = ctx.get('inputTriggers') as {
    registerSource(source: InputTriggerSource): () => void
  } | undefined
  if (inputTriggers === undefined) return

  const source: InputTriggerSource = {
    trigger: '@',
    name: 'global-file',
    order: 0,
    showGroupTitle: false,
    async candidates(_session, { query }) {
      const recent = query === '' ? recentPicks() : []
      let rows: Array<{ name: string; description: string; icon: 'file' | 'folder'; value: string }> = []
      try {
        const response = await fetch(LIST_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        })
        if (response.ok) {
          const body = await response.json() as { candidates?: FileCandidate[] }
          rows = (body.candidates ?? []).map(candidate => ({
            name: candidate.name,
            description: typeof candidate.label === 'string' && candidate.label !== ''
              ? `${candidate.path} · ${candidate.label}`
              : candidate.path,
            icon: candidate.kind === 'directory' ? 'folder' as const : 'file' as const,
            value: candidate.path,
          }))
        }
      } catch {
        // Host unreachable: the recent pins alone still render.
      }
      const pinned = recent.map(entry => ({
        name: entry.name,
        description: `最近使用 · ${entry.path}`,
        icon: entry.kind === 'directory' ? 'folder' as const : 'file' as const,
        value: entry.path,
      }))
      return [...pinned, ...rows]
    },
    onPick({ candidate }) {
      const path = candidate.value ?? ''
      const directory = candidate.icon === 'folder'
      rememberPick({ path, name: candidate.name, kind: directory ? 'directory' : 'file' })
      return { text: formatMention(path, directory) }
    },
  }
  ctx.effect(() => {
    const unregister = inputTriggers.registerSource(source)
    return unregister
  }, 'global-file-ref: @ source')
}

interface RecentPick {
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'directory'
}

/** Read the pinned recent list (corrupt entries dropped). */
function recentPicks(): RecentPick[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as RecentPick[]
    return raw.filter(entry => typeof entry.path === 'string' && entry.path !== '').slice(0, RECENT_MAX)
  } catch {
    return []
  }
}

/** Remember one pick at the front of the recent pin (dedup by path). */
function rememberPick(pick: RecentPick): void {
  try {
    const current = recentPicks().filter(entry => entry.path !== pick.path)
    const next = [pick, ...current].slice(0, RECENT_MAX)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage unavailable: the pin simply does not persist.
  }
}

/**
 * Format a selected path as prompt text, mirroring the official grammar:
 * whitespace uses the quoted `@"path"` form; a directory keeps that quote
 * open after its trailing slash so completion can descend another level.
 */
function formatMention(path: string, directory: boolean): string {
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return `@${path}`
  if (directory) {
    return path.includes(' ') ? `@"${path}/` : `@${path}/`
  }
  return path.includes(' ') ? `@"${path}"` : `@${path}`
}
