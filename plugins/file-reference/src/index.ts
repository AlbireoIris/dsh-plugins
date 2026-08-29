/**
 * File-reference browser host half: answers candidate queries for the client
 * `@` trigger. Scans configured roots (depth-limited, capped) and returns
 * matching files/directories so the browser can pick one and insert the
 * `@path` mention. Loopback-only; the client owns all presentation.
 */
import { readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'file-reference'

/** Required services: the Web carrier supplies the HTTP route. */
export const inject = ['webServer']

/** Deployment-varying knobs, each optional in the cordis.yml row config. */
export interface FileReferenceConfig {
  /** Root directories scanned (default of [] selects home, Desktop, Documents, Downloads). */
  roots: string[]
  /** Subdirectory names never entered (default of [] selects node_modules, .git, .pnpm-store). */
  excludeDirs: string[]
  /** Maximum directory depth below a root (default 3). */
  maxDepth: number
  /** Maximum candidates returned (default 50). */
  maxResults: number
}

/** Plugin config, validated by schemastery; empty arrays select the built-in defaults. */
export const Config: z<FileReferenceConfig> = z.object({
  roots: z.array(z.string()).default([]),
  excludeDirs: z.array(z.string()).default([]),
  maxDepth: z.number().step(1).min(1).max(10).default(3),
  maxResults: z.number().step(1).min(1).max(200).default(50),
})

/** One candidate row, serialized for the client. */
export interface FileCandidate {
  /** Absolute filesystem path. */
  readonly path: string
  /** Base name (or the root label for a root directory). */
  readonly name: string
  readonly kind: 'file' | 'directory'
  readonly size: number
  readonly mtime: number
}

export function apply(ctx: Context, config: FileReferenceConfig): void {
  const cfg = resolveConfig(config)
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh/file-candidates',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        respond(res, 405, { ok: false, message: 'Use POST' })
        return
      }
      let query = ''
      try {
        const body = await readBody(req)
        const parsed = JSON.parse(body) as { query?: unknown }
        if (typeof parsed.query === 'string') query = parsed.query.trim().toLowerCase()
      } catch {
        // Empty query is valid; a malformed body is treated as empty too.
      }
      try {
        const candidates = scanCandidates(cfg, query)
        respond(res, 200, { candidates })
      } catch (error) {
        respond(res, 500, { ok: false, message: String(error instanceof Error ? error.message : error) })
      }
    },
  }), 'file-reference: POST /dsh/file-candidates')

  // Sidebar browser data endpoints. list-dir is restricted to the configured
  // roots so the panel cannot reach arbitrary absolute paths.
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh/file-roots',
    handler: async (_req, res) => {
      respond(res, 200, { roots: cfg.roots })
    },
  }), 'file-reference: GET /dsh/file-roots')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/dsh/list-dir',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        respond(res, 405, { ok: false, message: 'Use POST' })
        return
      }
      let path = ''
      try {
        const body = await readBody(req)
        const parsed = JSON.parse(body) as { path?: unknown }
        if (typeof parsed.path === 'string') path = parsed.path
      } catch {
        respond(res, 400, { ok: false, message: 'Bad request body' })
        return
      }
      if (!isInsideRoots(path, cfg.roots)) {
        respond(res, 403, { ok: false, message: 'Path outside configured roots' })
        return
      }
      const entries = listDirectory(path)
      respond(res, 200, { entries })
    },
  }), 'file-reference: POST /dsh/list-dir')
}

/** Whether an absolute path sits inside one of the configured roots. */
function isInsideRoots(path: string, roots: readonly string[]): boolean {
  const normalized = path.toLowerCase()
  return roots.some(root => {
    const r = root.toLowerCase()
    const separator = r.endsWith('\\') || r.endsWith('/') ? '' : '\\'
    return normalized === r || normalized.startsWith(r + separator)
  })
}

/** List one directory's children (no recursion), directories first. */
function listDirectory(path: string): FileCandidate[] {
  let entries: string[]
  try {
    entries = readdirSync(path)
  } catch {
    return []
  }
  const out: FileCandidate[] = []
  for (const name of entries) {
    const full = join(path, name)
    let kind: 'file' | 'directory'
    let size = 0
    let mtime = 0
    try {
      const stat = statSync(full)
      if (stat.isDirectory()) {
        kind = 'directory'
      } else if (stat.isFile()) {
        kind = 'file'
        size = stat.size
        mtime = stat.mtimeMs
      } else {
        continue
      }
    } catch {
      continue
    }
    out.push({ path: full, name, kind, size, mtime })
  }
  out.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1))
  return out
}

/** Complete the defaults the schema leaves undefined. */
function resolveConfig(config: FileReferenceConfig): Required<FileReferenceConfig> {
  const home = homedir()
  return {
    roots: (config.roots.length > 0
      ? config.roots
      : [home, join(home, 'Desktop'), join(home, 'Documents'), join(home, 'Downloads')])
      .map(root => root.replace('%USERPROFILE%', home)),
    excludeDirs: config.excludeDirs.length > 0
      ? config.excludeDirs
      : ['node_modules', '.git', '.pnpm-store'],
    maxDepth: config.maxDepth,
    maxResults: config.maxResults,
  }
}

/**
 * Depth-limited scan of the configured roots. Every entry is capped and all
 * filesystem errors are skipped, so a missing root or an unreadable subdir
 * degrades to fewer candidates instead of failing the request.
 */
function scanCandidates(config: Required<FileReferenceConfig>, query: string): FileCandidate[] {
  const out: FileCandidate[] = []
  const isExcluded = (name: string): boolean => {
    const lower = name.toLowerCase()
    return config.excludeDirs.some(excluded => lower === excluded.toLowerCase())
  }
  const match = (path: string): boolean => {
    if (query === '') return true
    if (path.toLowerCase().includes(query)) return true
    const base = path.toLowerCase().split(/[\\/]/).pop()
    return base !== undefined && base.includes(query)
  }

  const walk = (dir: string, depth: number): void => {
    if (out.length >= config.maxResults) return
    let entries: string[]
    try {
      entries = readdirSync(dir)
    } catch {
      return
    }
    for (const name of entries) {
      if (out.length >= config.maxResults) return
      const path = join(dir, name)
      if (isExcluded(name)) continue
      let kind: 'file' | 'directory'
      let size = 0
      let mtime = 0
      try {
        const stat = statSync(path)
        if (stat.isDirectory()) {
          kind = 'directory'
        } else if (stat.isFile()) {
          kind = 'file'
          size = stat.size
          mtime = stat.mtimeMs
        } else {
          continue
        }
      } catch {
        continue
      }
      if (match(path)) {
        out.push({ path, name, kind, size, mtime })
      }
      if (kind === 'directory' && depth < config.maxDepth) {
        walk(path, depth + 1)
      }
    }
  }

  for (const root of config.roots) {
    let isRootDir = false
    try {
      isRootDir = statSync(root).isDirectory()
    } catch {
      continue
    }
    if (isRootDir) walk(root, 0)
  }
  // Directories first, then newest files first; both within the cap.
  out.sort((a, b) => (a.kind === b.kind ? b.mtime - a.mtime : a.kind === 'directory' ? -1 : 1))
  return out.slice(0, config.maxResults)
}

/** Read the request body as UTF-8 text (bounded, never throws). */
function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk: string | Buffer) => {
      data += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      if (data.length > 64 * 1024) {
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
