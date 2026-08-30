/**
 * session-clear host half: registers the `/clear` command (Claude Code
 * style). It folds all conversation older than the last N turns into ONE
 * checkpoint message through the official compaction surface transaction
 * (`compaction/start` → `compaction/summary` → checkpoint `user/message`
 * replace → `compaction/end`), so the model context shrinks immediately while
 * the durable event log stays append-only and gap-free. The checkpoint uses a
 * deterministic marker summary (no LLM call): the old span is replaced, not
 * summarized.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-commands'
import { toolPairingBalancedBefore } from '@deepseek-ai/dsh-compaction'
import { compactSurfaceRegion } from '@deepseek-ai/dsh-compaction-basic/src/region.ts'
import type { SummaryResult } from '@deepseek-ai/dsh-compaction-basic/src/summarizer.ts'
import type {} from '@deepseek-ai/dsh-token-meter'
import type { CommandId } from '@deepseek-ai/dsh-commands/brand'

export const name = 'session-clear'

/** Required services: the command registry owns discovery and dispatch; the token meter prices the shrink. */
export const inject = ['commands', 'tokenMeter', 'sessions']

/** Deployment-varying knobs for the clear command. */
export interface SessionClearConfig {
  /** How many recent turns to keep (default 10). */
  keepTurns: number
}

/** Plugin config, validated by schemastery. */
export const Config: z<SessionClearConfig> = z.object({
  keepTurns: z.number().step(1).min(1).max(50).default(10),
})

/** Deterministic checkpoint body: the old span is cleared, not summarized. */
function markerSummary(keepTurns: number): ContentBlock[] {
  return [{
    type: 'text',
    text: `The user ran /clear: all conversation older than the last ${keepTurns} turns was cleared. `
      + 'Continue from the remaining turns and apply their constraints as before; do not treat the cleared span as missing work.',
  }]
}

export function apply(ctx: Context, config: SessionClearConfig): void {
  const keepTurns = config.keepTurns
  ctx.commands.register({
    name: 'clear',
    description: `保留最近 ${keepTurns} 轮对话（类似 Claude Code /clear）`,
    recordInput: false,
    handler: async (invocation) => {
      const { agent, signal, commandId } = invocation
      const session: Session = agent.session
      try {
        return await clearNow(ctx, session, agent, keepTurns, signal, commandId)
      } catch (error: unknown) {
        if (signal.aborted) return { kind: 'error', text: '清理已取消。' }
        const detail = error instanceof Error ? error.message : String(error)
        if (detail.includes('compaction already in progress') || detail.includes('already has an open turn')) {
          return { kind: 'error', text: '会话正忙（已有折叠任务进行中），请稍后再试。' }
        }
        if (detail.includes('not a balanced boundary')) {
          return { kind: 'error', text: '清理中止：旧历史边界与当前工具调用对不平衡，未能安全折叠，请稍后重试。' }
        }
        return { kind: 'error', text: `清理失败：${detail}` }
      }
    },
  })
}

/**
 * Fold every turn older than the last `keepTurns` into one checkpoint message.
 * The replacement target is the surface span that ends immediately before the
 * first kept turn; the official transaction validates balance, records the
 * `compaction/*` markers, and appends the single replace.
 */
async function clearNow(
  ctx: Context,
  session: Session,
  agent: Agent,
  keepTurns: number,
  signal: AbortSignal | undefined,
  commandId: CommandId | undefined,
): Promise<{ kind: 'success'; text: string; sourceEventSeq?: number } | { kind: 'error'; text: string }> {
  const events: readonly SessionEvent[] = session.events
  const turnStarts: number[] = []
  for (let i = 0; i < events.length; i++) {
    if (events[i]!.type === 'turn/start') turnStarts.push(i)
  }
  const nodes = session.surface.nodes
  if (nodes.length === 0) {
    return { kind: 'success', text: '无需清理：会话还没有可折叠的消息。' }
  }
  if (turnStarts.length <= keepTurns) {
    return { kind: 'success', text: `无需清理：当前共 ${turnStarts.length} 轮，未超过保留上限 ${keepTurns}。` }
  }

  // Surface order is chronological of visible messages, but compaction
  // checkpoints make visible seqs non-monotonic — boundary by TURN index
  // (event seqs of turn/start are strictly increasing), never by seq compare.
  const turnIndexOf = (seq: number): number => {
    let lo = 0
    let hi = turnStarts.length - 1
    let ans = -1
    while (lo <= hi) {
      const mid = (lo + hi) >> 1
      if (turnStarts[mid]! <= seq) {
        ans = mid
        lo = mid + 1
      } else {
        hi = mid - 1
      }
    }
    return ans
  }

  // The tail is measured against the turns actually VISIBLE on the surface:
  // the harness's automatic compaction may already have folded older turns
  // away, leaving only their checkpoint node (visible seqs non-monotonic,
  // turns far above the surface's historical span). Counting log turns instead
  // finds a boundary that does not exist on the surface.
  const visibleTurns = [...new Set(nodes.map(seq => turnIndexOf(seq)).filter(turn => turn >= 0))]
    .sort((a, b) => a - b)
  if (visibleTurns.length <= keepTurns) {
    return {
      kind: 'success',
      text: `无需清理：可见对话共 ${visibleTurns.length} 轮（更早内容已被压缩成检查点），未超过保留上限 ${keepTurns}。`,
    }
  }
  const boundaryTurn = visibleTurns[visibleTurns.length - keepTurns]!

  // First retained surface node: the first message of the kept tail.
  let keepFromIdx = nodes.findIndex(seq => turnIndexOf(seq) >= boundaryTurn)
  if (keepFromIdx === -1) keepFromIdx = nodes.length
  while (keepFromIdx > 0 && keepFromIdx < nodes.length
    && !toolPairingBalancedBefore(session, nodes[keepFromIdx]!)) {
    keepFromIdx -= 1
  }
  if (keepFromIdx === 0) {
    return { kind: 'error', text: '清理中止：无法找到可保留尾段的安全边界（工具调用对不闭合），请稍后重试。' }
  }

  const start = nodes[0]!
  const end = nodes[keepFromIdx - 1]!
  const meter = ctx.tokenMeter

  const summarize = async (): Promise<SummaryResult> => ({
    summary: markerSummary(keepTurns),
    provider: '',
    model: '',
  })
  const result = await compactSurfaceRegion(
    { meter, summarize },
    session,
    start,
    end,
    agent,
    {
      // A human command runs while the agent is IDLE (no open turn): the
      // standalone manual-compaction bracket, exactly the /compact path.
      owner: null,
      stability: 'whole-surface',
      ...commandId === undefined ? {} : { sourceCommandId: commandId },
      flush: async () => { await ctx.sessions.flush(session) },
    },
    signal,
  )
  return {
    kind: 'success',
    text: `已清理：保留最近 ${keepTurns} 轮，更早的 ${result.shadowedSeqs.length} 条消息已折叠为一条清理标记。`,
    sourceEventSeq: result.summarySeq,
  }
}
