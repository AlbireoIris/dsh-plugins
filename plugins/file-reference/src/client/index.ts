/**
 * File-reference browser client half, v2: a sidebar "文件" foot action opens a
 * file-tree panel (host-scanned roots, lazy expansion); picking a file appends
 * its `@path` mention to the current session's draft through the official
 * `conversation.input` resolver. The `@` trigger source stays for keystroke
 * browsing.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the SlotRegistry service merge (ctx.slots) and the
// conversation header-utilities SlotMap member.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the sidebar SlotMap merge (the footer-action hole).
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { FileBrowserButton } from './FileBrowserButton.tsx'

/** The Host endpoints answering candidate and directory queries. */
const CANDIDATES_PATH = '/dsh/file-candidates'
const ROOTS_PATH = '/dsh/file-roots'
const LIST_DIR_PATH = '/dsh/list-dir'

import type { FileBrowserInjected } from './FileBrowserButton.tsx'

export type { FileBrowserInjected }

/** One candidate row as the Host returns it. */
export interface FileCandidate {
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'directory'
  readonly size: number
  readonly mtime: number
}

export const inject = ['slots', 'inputTriggers']

/** Register the `@` candidate source and the sidebar file-browser action. */
export function apply(ctx: Context): void {
  registerAtSource(ctx)
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'file-browser',
    order: 2,
    inject: (): FileBrowserInjected => ({
      rootsPath: ROOTS_PATH,
      listPath: LIST_DIR_PATH,
      insertFile: (path, directory) => void insertMention(ctx, path, directory),
      openPath: (path) => void post('/dsh/open-path', { path }),
      renamePath: async (path, newName) => {
        const response = await post('/dsh/rename-path', { path, newName })
        return response.ok
      },
      deletePath: async (path) => {
        const response = await post('/dsh/delete-path', { path })
        return response.ok
      },
    }),
  }, FileBrowserButton))
}

/** Register the `@` file candidate source (keystroke browsing). */
function registerAtSource(ctx: Context): void {
  const inputTriggers = ctx.get('inputTriggers') as {
    registerSource(source: InputTriggerSource): () => void
  } | undefined
  if (inputTriggers === undefined) return
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

/** Minimal session/input service facets (provided by the dsh web shell). */
interface SessionsFace {
  list: { getSnapshot(): { current?: string } }
  scope(id: string): unknown
}
interface ConversationInputFace {
  for(actx: unknown): {
    setDraft(text: string): void
    state: { getSnapshot(): { draft: string } }
  }
}

/**
 * Append the selected file's mention to the current session's draft via the
 * official `conversation.input` resolver. No-op when the services or a
 * current session are unavailable.
 */
function insertMention(ctx: Context, path: string, directory: boolean): void {
  const sessions = ctx.get('sessions') as SessionsFace | undefined
  const conversationInput = ctx.get('conversation.input') as ConversationInputFace | undefined
  if (sessions === undefined || conversationInput === undefined) return
  const current = sessions.list.getSnapshot().current
  if (current === undefined) return
  const actx = sessions.scope(current)
  const shell = conversationInput.for(actx)
  const mention = formatMention(path, directory)
  const draft = shell.state.getSnapshot().draft
  shell.setDraft(draft === '' ? mention : /(?:^|\s)$/u.test(draft) ? draft + mention : draft + ' ' + mention)
}

/**
 * Format a selected path as prompt text: whitespace uses the quoted
 * `@"path"` grammar; a directory keeps that quote open after its trailing
 * slash so completion can descend another level.
 */

/** POST JSON to one host endpoint (loopback, keep-alive error-tolerant). */
async function post(path: string, body: unknown): Promise<Response> {
  return await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => new Response(null, { status: 0 }))
}

function formatMention(path: string, directory: boolean): string {
  if (/[\u0000-\u001f\u007f-\u009f"]/u.test(path)) return `@${path}`
  if (directory) {
    return path.includes(' ') ? `@"${path}/` : `@${path}/`
  }
  return path.includes(' ') ? `@"${path}"` : `@${path}`
}
