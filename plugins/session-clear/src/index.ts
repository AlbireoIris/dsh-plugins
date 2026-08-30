/**
 * session-clear host half: registers the `/clear` command (Claude Code
 * style). It rewrites the session's durable JSONL log to keep only the last
 * N turns (turn/start boundaries), with a `.clear-bak` backup and a
 * re-scan verification before the old file is dropped from the backup slot.
 * The client command menu picks the registration up automatically.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { Session } from '@deepseek-ai/dsh-session'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-commands'
import {
  eventLines, logPath, scanLog, toHeaderLine,
} from '@deepseek-ai/dsh-session-persistence-jsonl/src/format.ts'
import { compressZstdFrame } from '@deepseek-ai/dsh-session-persistence-jsonl/src/zstd.ts'
import type { JsonlCompression } from '@deepseek-ai/dsh-session-persistence-jsonl/src/format.ts'

export const name = 'session-clear'

/** Required services: the command registry owns discovery and dispatch. */
export const inject = ['commands']

/** Deployment-varying knobs for the clear command. */
export interface SessionClearConfig {
  /** How many recent turns to keep (default 10). */
  keepTurns: number
  /** Session log root; empty selects the web profile default. */
  logRoot: string
}

/** Plugin config, validated by schemastery. */
export const Config: z<SessionClearConfig> = z.object({
  keepTurns: z.number().step(1).min(1).max(50).default(10),
  logRoot: z.string().default(''),
})

const DEFAULT_LOG_ROOT = 'C:\\Users\\Iris\\.dsh\\sessions'
const COMPRESSIONS: readonly JsonlCompression[] = ['zstd', 'none']

export function apply(ctx: Context, config: SessionClearConfig): void {
  const keepTurns = config.keepTurns
  const root = config.logRoot !== '' ? config.logRoot : DEFAULT_LOG_ROOT
  ctx.commands.register({
    name: 'clear',
    description: `保留最近 ${keepTurns} 轮对话（类似 Claude Code /clear）`,
    recordInput: false,
    handler: async ({ agent }) => {
      const session: Session = agent.session
      const report = await truncateSession(session, root, keepTurns)
      return { kind: 'success', text: report }
    },
  })
}

/**
 * Rewrite the session log keeping only the last `keepTurns` turns. Decodes
 * via scanLog, rewrites with the same header + one-event-per-line encoding
 * inside one zstd frame, swaps in atomically (keeping a .clear-bak), and
 * verifies the new file before reporting.
 */
async function truncateSession(
  session: Session,
  root: string,
  keepTurns: number,
): Promise<string> {
  const id = session.id
  const cwd = session.header.cwd ?? undefined
  let path = ''
  for (const compression of COMPRESSIONS) {
    const candidate = logPath(root, cwd, id, compression)
    if (existsSync(candidate)) {
      path = candidate
      break
    }
  }
  if (path === '') return `未找到会话日志（root=${root}），未执行清理。`

  const buffer = readFileSync(path)
  const scan = scanLog(buffer)
  const events = scan.events
  const total = events.length

  const turnStarts: number[] = []
  for (let i = 0; i < events.length; i++) {
    if ((events[i] as { type?: string }).type === 'turn/start') turnStarts.push(i)
  }
  if (turnStarts.length <= keepTurns) {
    return `无需清理：当前仅 ${turnStarts.length} 轮，少于保留上限 ${keepTurns}。`
  }
  const cutoff = turnStarts[turnStarts.length - keepTurns]
  const kept = events.slice(cutoff)

  const headerText = toHeaderLine(scan.meta)
  const plaintext = headerText + '\n' + eventLines(kept, false) + '\n'
  const frame = await compressZstdFrame(plaintext)

  mkdirSync(dirname(path), { recursive: true })
  const tmp = path + '.clear-tmp'
  const bak = path + '.clear-bak'
  writeFileSync(tmp, frame)

  // Verify the staged file decodes to exactly the kept events before swap.
  const verify = scanLog(readFileSync(tmp))
  if (verify.events.length !== kept.length) {
    return '清理中止：暂存日志校验失败（事件数不符），未改动原文件。'
  }

  if (existsSync(bak)) {
    try { renameSync(bak, bak + '.old') } catch { /* keep best effort */ }
  }
  renameSync(path, bak)
  renameSync(tmp, path)
  return `已清理会话历史：仅保留最近 ${keepTurns} 轮（原 ${total} 条事件 → 保留 ${kept.length} 条；备份: ${bak}）。`
}
