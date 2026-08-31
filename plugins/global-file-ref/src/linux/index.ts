/**
 * Global file reference host half: answers the client `@` source with
 * mounted roots and one-level shell-like tab completion across the whole
 * filesystem. Read-only listing; every request is cap-bounded. No roots
 * whitelist: the whole machine is the point (loopback + same-origin trust).
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
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
        const candidates = listCandidates(query)
        respond(res, 200, { candidates })
      } catch (error) {
        respond(res, 500, { ok: false, message: String(error instanceof Error ? error.message : error) })
      }
    },
  }), 'global-file-ref: POST /dsh/ref-list')
}

/**
 * Shell-like tab completion, one level at a time:
 * - ''                -> all mounted roots (the "/" root + real volumes)
 * - '/'               -> "/" direct children (dirs first)
 * - '/home'           -> 'home'-matching children of "/" (segment contains, case-insensitive)
 * - '/home/mi/'      -> '/home/mi' direct children (dirs first)
 */
function listCandidates(query: string): FileCandidate[] {
  const normalized = query.replace(/\\/gu, '/')
  if (normalized === '') return roots()
  // A bare "/" (or trailing-slash root) is the root directory itself: list its children.
  if (normalized === '/') return listDirectory('/')

  const lastSep = normalized.lastIndexOf('/')
  const base = lastSep >= 0 ? normalized.slice(0, lastSep + 1) : ''
  const segment = lastSep >= 0 ? normalized.slice(lastSep + 1).toLowerCase() : normalized.toLowerCase()
  // Show dot-prefixed entries only when the user typed a "." in this segment;
  // otherwise hidden files/dirs stay out of the list (like a file browser).
  const showHidden = segment.includes('.')

  if (base === '') {
    // 'home'-style queries without a leading slash: complete against the mounted roots.
    return roots().filter(root => root.path.toLowerCase().includes(segment))
  }
  if (!existsDir(base)) return []

  return listDirectory(base, segment === '' ? undefined : segment, showHidden)
}

/**
 * Enumerate the real mounted filesystem roots (the Linux analog of drive
 * letters). Reading /proc/mounts yields the top-level targets; virtual/snap
 * filesystems are noise for file reference, so they are skipped. The "/" root
 * is always first; a read failure degrades to exactly "/".
 */
function roots(): FileCandidate[] {
  const out: FileCandidate[] = []
  const seen = new Set<string>()
  try {
    for (const line of readFileSync('/proc/mounts', 'utf8').split('\n')) {
      if (line === '') continue
      const parts = line.split(' ')
      if (parts.length < 3) continue
      const target = parts[1]!
      const fstype = parts[2]!
      if (SKIPPED_TARGETS.has(target)) continue
      if (VIRTUAL_FSTYPES.has(fstype)) continue
      if (!seen.has(target) && existsDir(target)) {
        seen.add(target)
        out.push({ path: target, name: target, kind: 'directory' })
      }
    }
  } catch {
    // /proc/mounts unreadable: fall back to the single "/" root.
    out.length = 0
  }
  if (!seen.has('/')) out.unshift({ path: '/', name: '/', kind: 'directory' })
  out.sort((a, b) => (a.path === '/' ? -1 : b.path === '/' ? 1 : a.path.localeCompare(b.path)))
  return out.slice(0, MAX_RESULTS)
}

/** Mount targets that are not user-visible storage and never belong in the list. */
const SKIPPED_TARGETS = new Set([
  '/snap', '/var/snap', '/run', '/proc', '/sys', '/dev', '/boot/efi',
])
/** Kernel/virtual filesystem types that are not real user storage. */
const VIRTUAL_FSTYPES = new Set([
  'proc', 'sysfs', 'cgroup', 'cgroup2', 'devpts', 'tmpfs', 'devtmpfs',
  'overlay', 'squashfs', 'mqueue', 'shm', 'securityfs', 'debugfs',
  'tracefs', 'pstore', 'efivarfs', 'fusectl', 'configfs', 'bpf',
  'autofs', 'binfmt_misc', 'ramfs', 'hugetlbfs', 'nsfs', 'fuse',
  'fuseblk', 'fuse.portal',
])

function existsDir(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

/** One directory's direct children (no recursion), directories first, capped.
 *  Dot-prefixed entries are hidden by default; set `showHidden` to include
 *  them (the caller turns it on when the user typed a "."). When `filter` is
 *  given, only names containing it are kept AND the cap applies after the
 *  filter, so a match far down a huge directory is still found. */
function listDirectory(path: string, filter?: string, showHidden = false): FileCandidate[] {
  let entries: string[]
  try {
    entries = readdirSync(path)
  } catch {
    return []
  }
  const out: FileCandidate[] = []
  const needle = filter === undefined ? undefined : filter.toLowerCase()
  for (const name of entries) {
    if (out.length >= MAX_RESULTS) break
    if (!showHidden && name.startsWith('.')) continue
    if (needle !== undefined && !name.toLowerCase().includes(needle)) continue
    const full = path.endsWith('/') ? path + name : path + '/' + name
    let kind: 'file' | 'directory'
    try {
      kind = statSync(full).isDirectory() ? 'directory' : 'file'
    } catch {
      continue
    }
    out.push({ path: full, name, kind })
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
