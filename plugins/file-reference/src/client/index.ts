/**
 * File-reference browser client half, version A: the NAVI-aligned sidebar
 * panel now has a second entry point in the composer tool row (official
 * `conversation.input.left` slot, 28px icon button style), both toggling one
 * shared panel. Picking a file smart-routes: images go into the official
 * draft attachment rail (host reads bytes -> createDraftImages) when the
 * official channel is available, everything else inserts the `@path` mention
 * into the current session's draft. The `@` trigger source stays.
 */
import type { Context } from '@deepseek-ai/cordis'
// Type-only: pulls the SlotRegistry service merge (ctx.slots) and the
// conversation header-utilities SlotMap member.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the sidebar footer-action and composer input.left slot maps.
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { FileBrowserButton } from './FileBrowserButton.tsx'
import { ComposerFileButton } from './ComposerFileButton.tsx'
import type { FileBrowserInjected } from './FileBrowserButton.tsx'

export type { FileBrowserInjected }

/** The Host endpoints answering candidate and directory queries. */
const CANDIDATES_PATH = '/dsh/file-candidates'
const ROOTS_PATH = '/dsh/file-roots'
const LIST_DIR_PATH = '/dsh/list-dir'
const READ_FILE_PATH = '/dsh/read-file'

export interface FileCandidate {
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'directory'
  readonly size: number
  readonly mtime: number
}

export const inject = ['slots', 'inputTriggers']

/** Register the `@` candidate source and both browser entry points. */
export function apply(ctx: Context): void {
  registerAtSource(ctx)

  const browserInjected = (): FileBrowserInjected => ({
    rootsPath: ROOTS_PATH,
    listPath: LIST_DIR_PATH,
    insertFile: (path, directory) => {
      if (directory || !isImage(path)) {
        insertMention(ctx, path, directory)
        return
      }
      void attachImage(ctx, path).then(attached => {
        if (!attached) insertMention(ctx, path, false)
      })
    },
    openPath: (path) => void post('/dsh/open-path', { path }),
    renamePath: async (path, newName) => (await post('/dsh/rename-path', { path, newName })).ok,
    deletePath: async (path) => (await post('/dsh/delete-path', { path })).ok,
  })

  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'file-browser',
    order: 2,
    inject: browserInjected,
  }, FileBrowserButton))

  // Composer tool row: same panel, one 28px icon button (official slot).
  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'file-browser',
    order: 1,
    inject: () => ({}),
  }, ComposerFileButton))
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

/** Whether a path looks like an image the official attachment lane handles. */
function isImage(path: string): boolean {
  return /\.(?:png|jpe?g|webp|gif)$/iu.test(path)
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
interface ConversationFace {
  createDraftImages?(files: File[]): unknown
}

/**
 * Read the file bytes from the Host and hand them to the official draft
 * attachment rail (auto file_id on send). Feature-detected and error-tolerant:
 * any failure returns false so the caller falls back to a plain mention.
 */
async function attachImage(ctx: Context, path: string): Promise<boolean> {
  const conversation = ctx.get('conversation') as ConversationFace | undefined
  if (conversation?.createDraftImages === undefined) return false
  try {
    const response = await post(READ_FILE_PATH, { path })
    if (!response.ok) return false
    const body = await response.json() as { name?: string; mime?: string; base64?: string }
    if (typeof body.base64 !== 'string' || typeof body.name !== 'string') return false
    const bytes = base64ToBytes(body.base64)
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: body.mime ?? 'image/png' })
    const file = new File([blob], body.name, { type: body.mime ?? 'image/png' })
    conversation.createDraftImages([file])
    return true
  } catch {
    return false
  }
}

/** Append the selected file's mention to the current session's draft. */
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

/** POST JSON to one host endpoint (loopback, keep-alive error-tolerant). */
async function post(path: string, body: unknown): Promise<Response> {
  return await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(() => new Response(null, { status: 0 }))
}

/** Base64 to bytes (browser atob path). */
function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
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
