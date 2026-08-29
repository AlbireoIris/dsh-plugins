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
import type {} from '@deepseek-ai/dsh-host-webserver'

export const name = 'file-reference'

/** Required services: the Web carrier supplies the HTTP route. */
export const inject = ['webServer']

/** Deployment-varying knobs, each optional in the cordis.yml row config. */
export interface FileReferenceConfig {
  /** Root directories scanned for candidates. Default: home, Desktop, Documents, Downloads. */
  roots?: string[]
  /** Subdirectory names never entered (each may be relative or absolute). Default: node_modules, .git, .pnpm-store. */
  excludeDirs?: string[]
  /** Maximum directory depth below a root (default 3). */
  maxDepth?: number
  /** Maximum candidates returned (default 50). */
  maxResults?: number
}

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

export function apply(ctx: Context): void {
  const config = resolveConfig(ctx)
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
        const candidates = scanCandidates(config, query)
        respond(res, 200, { candidates })
      } catch (error) {
        respond(res, 500, { ok: false, message: String(error instanceof Error ? error.message : error) })
      }
    },
  }), 'file-reference: POST /dsh/file-candidates')
}

/** Merge row config over the defaults. */
function resolveConfig(ctx: Context): Required<FileReferenceConfig> {
  const overrides = (ctx.config ?? {}) as Partial<FileReferenceConfig>
  const home = homedir()
  const defaults = {
    roots: [home, join(home, 'Desktop'), join(home, 'Documents'), join(home, 'Downloads')],
    excludeDirs: ['node_modules', '.git', '.pnpm-store'],
    maxDepth: 3,
    maxResults: 50,
  }
  return {
    roots: (overrides.roots && overrides.roots.length > 0 ? overrides.roots : defaults.roots)
      .map(root => (root.includes('%USERPROFILE%') ? root.replace('%USERPROFILE%', home) : root)),
    excludeDirs: overrides.excludeDirs ?? defaults.excludeDirs,
    maxDepth: overrides.maxDepth ?? defaults.maxDepth,
    maxResults: overrides.maxResults ?? defaults.maxResults,
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
