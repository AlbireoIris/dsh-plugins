/**
 * Global file reference host half: answers the client `@` source with
 * drive roots and one-level shell-like tab completion across every disk.
 * Read-only listing; every request is cap-bounded. No roots whitelist: the
 * whole machine is the point (loopback + same-origin trust).
 */
import { readdirSync, statSync } from 'node:fs'
import type { ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'global-file-ref'

/** Required services: the Web carrier supplies the HTTP route. */
export const inject = ['webServer']

/** Maximum candidates per request (drives stay small; directories cap). */
const MAX_RESULTS = 200

/** One candidate row, serialized for the client. */
export interface FileCandidate {
  readonly path: string
  readonly name: string
  readonly kind: 'file' | 'directory'
  /** Windows volume label, drives only. */
  readonly label: string | undefined
}

export function apply(ctx: Context): void {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh/ref-list',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        respond(res, 405, { ok: false, message: 'Use POST' })
        return
      }
      let query = ''
      try {
        const body = await readBody(req)
        const parsed = JSON.parse(body) as { query?: unknown }
        if (typeof parsed.query === 'string') query = parsed.query.trim()
      } catch {
        // Empty query is valid; a malformed body is treated as empty too.
      }
      try {
        const candidates = await listCandidates(query)
        respond(res, 200, { candidates })
      } catch (error) {
        respond(res, 500, { ok: false, message: String(error instanceof Error ? error.message : error) })
      }
    },
  }), 'global-file-ref: POST /dsh/ref-list')
}

/**
 * Shell-like tab completion, one level at a time:
 * - ''                -> all drive roots
 * - 'C:'              -> the C:\ root (when it exists)
 * - 'C:\'             -> C:\ direct children (dirs first)
 * - 'C:\Us'           -> 'Us'-matching children of C:\ (segment contains, case-insensitive)
 */
async function listCandidates(query: string): Promise<FileCandidate[]> {
  const normalized = query.replace(/\//gu, '\\')
  if (normalized === '') return await drives(true)

  if (/^[a-zA-Z]:$/u.test(normalized)) {
    const root = normalized.toUpperCase() + '\\'
    return existsDir(root) ? [{ path: root, name: root, kind: 'directory', label: undefined }] : []
  }

  const lastSep = normalized.lastIndexOf('\\')
  const base = lastSep >= 0 ? normalized.slice(0, lastSep + 1) : ''
  const segment = lastSep >= 0 ? normalized.slice(lastSep + 1).toLowerCase() : normalized.toLowerCase()

  if (base === '') {
    // 'c' / 'use'-style queries: complete against the drive letters.
    return (await drives(false)).filter(drive => drive.path.toLowerCase().includes(segment))
  }
  if (!existsDir(base)) return []

  const children = listDirectory(base)
  if (segment === '') return children
  return children.filter(child => child.name.toLowerCase().includes(segment))
}

/** Enumerate every existing drive root (A:-Z:). */
async function drives(includeLabels: boolean): Promise<FileCandidate[]> {
  const labels = includeLabels ? await readVolumeLabels() : {}
  const out: FileCandidate[] = []
  for (let code = 'A'.charCodeAt(0); code <= 'Z'.charCodeAt(0); code++) {
    const root = String.fromCharCode(code) + ':\\'
    if (existsDir(root)) out.push({ path: root, name: root, kind: 'directory', label: labels[root] })
  }
  return out
}

/** Volume-label cache (5-minute TTL; labels change rarely). */
let labelCache: { at: number; labels: Record<string, string> } | null = null

/**
 * Read volume labels through GetVolumeInformationW (koffi -> kernel32).
 * Lazy-imported so non-Windows hosts never load koffi; any failure degrades
 * to an empty label map (drives still list without names).
 */
async function readVolumeLabels(): Promise<Record<string, string>> {
  if (labelCache !== null && Date.now() - labelCache.at < 5 * 60 * 1000) return labelCache.labels
  try {
    const koffi = (await import('koffi')).default as unknown as {
      load(path: string): { func(convention: string, name: string, result: string, args: string[]): (...args: unknown[]) => unknown }
      alloc(type: string, length: number): unknown
      decode(ptr: unknown, type: string): unknown
    }
    const kernel32 = koffi.load('kernel32.dll')
    const probe = kernel32.func('__stdcall', 'GetVolumeInformationW', 'bool', [
      'str16', 'void *', 'uint', 'void *', 'void *', 'void *', 'void *', 'uint',
    ])
    const labels: Record<string, string> = {}
    for (let code = 'A'.charCodeAt(0); code <= 'Z'.charCodeAt(0); code++) {
      const root = String.fromCharCode(code) + ':\\'
      if (!existsDir(root)) continue
      const nameBuf = koffi.alloc('char', 512)
      const fsBuf = koffi.alloc('char', 128)
      const ok = probe(root, nameBuf, 256, null, null, null, fsBuf, 128)
      if (ok === true) {
        const label = koffi.decode(nameBuf, 'str16') as unknown
        if (typeof label === 'string' && label.trim() !== '') labels[root] = label.trim()
      }
    }
    labelCache = { at: Date.now(), labels }
    return labels
  } catch {
    labelCache = { at: Date.now(), labels: {} }
    return {}
  }
}

function existsDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** One directory's direct children (no recursion), directories first, capped. */
function listDirectory(path: string): FileCandidate[] {
  let entries: string[]
  try {
    entries = readdirSync(path)
  } catch {
    return []
  }
  const out: FileCandidate[] = []
  for (const name of entries) {
    if (out.length >= MAX_RESULTS) break
    const full = path.endsWith('\\') || path.endsWith('/') ? path + name : path + '\\' + name
    let kind: 'file' | 'directory'
    try {
      kind = statSync(full).isDirectory() ? 'directory' : 'file'
    } catch {
      continue
    }
    if (kind === 'file' && out.length >= MAX_RESULTS) continue
    out.push({ path: full, name, kind, label: undefined })
  }
  out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1))
  return out.slice(0, MAX_RESULTS)
}

/** Read the request body as UTF-8 text (bounded, never throws). */
function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: string | Buffer) => {
      data += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      if (data.length > 32 * 1024) {
        req.destroy()
        reject(new Error('request body too large'))
      }
    })
    req.on('end', () => resolve(data))
    req.on('error', reject)
  })
}

/** Simple JSON response writer (no server-framework dependency). */
function respond(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}
