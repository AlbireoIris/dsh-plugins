/**
 * The `stop_subagent` tool: a strong stop for one continuable child, in two
 * modes. `graceful` reuses `ctx.subagents.interrupt()` — aborting the child's
 * current model turn and parking its queued work. `force` first asks for that
 * graceful interrupt, then escalates to a process-group kill of exactly the
 * process groups the caller names via `pgids`, so a tool call stuck in an
 * external, signal-ignoring process can be reaped without killing the host or
 * any other worker.
 *
 * 为什么由调用方显式传 `pgids`：上游 subprocess Service 没有"某次运行拉起的
 * 进程组"归属登记 API（旧版依赖的 `ctx.subagents.processGroupsOf(target)` 是
 * 当时 harness 仓库的本地补丁，未进上游），插件无法从服务侧反查目标进程组，
 * 只能由调用方列出。工具只对 `-pid` 进程组发信号，绝不触碰 DSH host pid 或
 * 其他 worker 的组；每次发信号前用 /proc starttime 围栏校验 PID 是否已被重用
 * （围栏判定不一致的组直接跳过，宁可少杀不误杀）。
 *
 * 工具名 `stop_subagent` 与 agent-team 的 `interrupt_agent` / `send_message`
 * 刻意不同名，可挂载在已提供 agent-team 控制工具的 composition 上而不冲突。
 *
 * 本插件零 harness 运行时导入：harness 类型全部 type-only（见
 * vendor-types.d.ts 本地声明），构建产物 lib/index.js 自包含，可直接以绝对
 * 路径挂进任意 cordis.yml 行。
 *
 * @module dsh-tool-stop-subagent
 */

import { readFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'
import type { Context } from '@deepseek-ai/cordis'

export const name = 'tool-stop-subagent'
export const inject = ['tools', 'subagents']

const DEFAULT_GRACE_MS = 2000
const MAX_GRACE_MS = 30_000

/**
 * 结构化引用宿主 Agent 实例：vendor 声明只描述插件消费的最小面（无成员），
 * 运行时值是宿主真实 Agent 对象，本插件只透传给 interrupt，从不访问其成员。
 */
export interface SubagentAgentRef {
  readonly id: string
}

/** 中断授权：对齐上游 `SubagentInterruptAuthority` 的 ancestor 分支。 */
export interface StopInterruptAuthority {
  readonly kind: 'ancestor'
  readonly agent: SubagentAgentRef
}

/** 子代理服务面：本插件只消费同步的 interrupt。 */
export interface SubagentsService {
  interrupt(targetSessionId: string, authority: StopInterruptAuthority): void
}

/** 工具注册表面：本插件只消费 register，返回注册 disposer。 */
export interface ToolsRegistry {
  register(definition: StopToolDefinition): () => void
}

/** 工具执行上下文中本插件消费的最小面。 */
export interface StopToolRunContext {
  /** 调用方 Agent（agent loop 注入）；ancestor 授权必需。 */
  readonly agent: SubagentAgentRef | undefined
  /** 调用方取消信号；本工具的等待窗口不对其响应（强杀意图即等待）。 */
  readonly signal: AbortSignal
}

/** 工具成功输出（output.schema 的 narrow 形态）。 */
export interface StopToolOutputValue {
  readonly mode: 'graceful' | 'force'
  readonly interrupted: boolean
  readonly signalledGroups: number
  readonly staleGroups: number
}

/** 手工构造的工具定义：对齐上游 ToolDefinition 的自包含子集。 */
export interface StopToolDefinition {
  readonly name: string
  readonly description: string
  /** 标准 JSON Schema（required 数组在顶层），registry 原样透传给模型。 */
  readonly parameters: Record<string, unknown>
  readonly output: {
    /** 标准 JSON Schema（enforced subset），registry 据此校验成功输出。 */
    readonly schema: Record<string, unknown>
    readonly render: (args: unknown, value: StopToolOutputValue) => readonly { type: 'text'; text: string }[]
  }
  readonly execute: (args: unknown, exec: StopToolRunContext) => Promise<StopToolOutputValue>
}

/**
 * 窄化后的调用方入参；判别联合保证 force 分支的 pgids 已校验为非空。
 */
type StopToolArgs =
  | {
    readonly subagent_id: string
    readonly mode: 'graceful'
    readonly grace_ms?: number
    readonly pgids?: readonly PgidEntry[]
  }
  | {
    readonly subagent_id: string
    readonly mode: 'force'
    readonly grace_ms?: number
    readonly pgids: readonly PgidEntry[]
  }

/** 一个待强杀的进程组条目；started 是可选的 /proc starttime 围栏值。 */
interface PgidEntry {
  readonly pid: number
  readonly started?: string
}

/** SIGTERM→grace→SIGKILL 的一条围栏目标。 */
interface KillTarget {
  readonly pid: number
  /** 发信号前捕获的 starttime；undefined 表示不可读（非 Linux 或瞬读失败）。 */
  readonly started: string | undefined
  /** 被围栏判定为 PID 重用而跳过信号。 */
  stale: boolean
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * 对模型入参做手工 narrow（registry 契约是"工具自校验 schema"）；任何类型
 * 不符直接 throw，fail loud。
 * @param raw - registry 传入的 frozen 模型参数。
 * @returns 窄化后的入参。
 */
function narrowStopArgs(raw: unknown): StopToolArgs {
  if (!isRecord(raw)) {
    throw new Error('stop_subagent arguments must be an object')
  }
  const { subagent_id, mode, grace_ms, pgids } = raw
  if (typeof subagent_id !== 'string' || subagent_id.length === 0) {
    throw new Error('subagent_id must be a non-empty string')
  }
  if (mode !== 'graceful' && mode !== 'force') {
    throw new Error(`mode must be 'graceful' or 'force', received ${JSON.stringify(mode)}`)
  }
  if (grace_ms !== undefined
    && (typeof grace_ms !== 'number' || !Number.isFinite(grace_ms) || grace_ms < 0)) {
    throw new Error('grace_ms must be a non-negative finite number')
  }
  let normalizedPgids: readonly PgidEntry[] | undefined
  if (pgids !== undefined) {
    if (!Array.isArray(pgids)) throw new Error('pgids must be an array')
    normalizedPgids = pgids.map((entry, index): PgidEntry => {
      if (!isRecord(entry)) throw new Error(`pgids[${index}] must be a { pid, started? } object`)
      const { pid, started } = entry
      if (typeof pid !== 'number' || !Number.isInteger(pid) || pid <= 0) {
        throw new Error(`pgids[${index}].pid must be a positive integer (the process-group id)`)
      }
      if (started !== undefined && typeof started !== 'string') {
        throw new Error(`pgids[${index}].started must be a string (the /proc starttime fence value)`)
      }
      return started === undefined ? { pid } : { pid, started }
    })
  }
  if (mode === 'force') {
    if (normalizedPgids === undefined || normalizedPgids.length === 0) {
      throw new Error('force mode requires a non-empty pgids array: the subprocess service has no attribution registry, so the tool cannot discover the subagent\'s process groups itself')
    }
    return { subagent_id, mode, grace_ms, pgids: normalizedPgids }
  }
  return { subagent_id, mode, grace_ms, pgids: normalizedPgids }
}

/**
 * 读取 pid 当前的内核启动身份（Linux starttime ticks），用于发信号前的
 * PID 重用围栏。
 * @param pid - 要检查的进程 id。
 * @returns 启动身份；不可用或非 Linux 平台返回 undefined。
 */
function readStarted(pid: number): string | undefined {
  if (process.platform !== 'linux') return undefined
  try {
    const text = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const open = text.indexOf('(')
    const close = text.lastIndexOf(')')
    if (open <= 0 || close <= open) return undefined
    // After `(comm)` the fields are 1-indexed from `state`; starttime is field 22.
    return text.slice(close + 2).trim().split(/\s+/)[19]
  } catch {
    return undefined
  }
}

/**
 * 向一个进程组发信号，发前用登记的启动身份围栏，重用过的 pid 永不发信号。
 * @param identity - pid 加发信号前捕获的启动身份。
 * @param signal - 发往该组的信号（`-pid` 命中整组）。
 * @returns `false` 表示 pid 已重用或组已不存在。
 */
function signalGroup(
  identity: { readonly pid: number; readonly started: string | undefined },
  signal: NodeJS.Signals,
): boolean {
  const current = readStarted(identity.pid)
  if (current !== undefined && current !== identity.started) return false
  try {
    process.kill(-identity.pid, signal)
    return true
  } catch {
    return false
  }
}

/**
 * PID 重用判定：现 starttime 与登记值不一致。登记值为 undefined（非 Linux
 * 首读即不可用，或 Linux 上瞬读失败）而现值存在时同样判重用——宁可少杀，
 * 不误杀一个恰好复用同号 pid 的无辜进程。
 */
function pidReused(target: KillTarget): boolean {
  const current = readStarted(target.pid)
  return current !== undefined && current !== target.started
}

/**
 * 把调用方的 grace 收敛为有界、非负的 kill 窗口；超过上限 clamp，负值在
 * narrow 阶段已拒绝。
 */
function graceMs(raw: number | undefined): number {
  if (raw === undefined) return DEFAULT_GRACE_MS
  return Math.min(raw, MAX_GRACE_MS)
}

/**
 * Register the `stop_subagent` tool on the session tool registry.
 * @param ctx - context carrying the tool registry and subagent service.
 */
export function apply(ctx: Context): void {
  ctx.effect(() => ctx.tools.register({
    name: 'stop_subagent',
    description:
      'Strongly stop one background subagent by its id. "graceful" aborts its current model turn '
      + 'and parks its queued work. "force" first performs that graceful interrupt, then escalates '
      + 'to a process-group kill of the caller-named pgids, so a tool call stuck in an external, '
      + 'signal-ignoring process can be reaped. Only the process groups you pass are signalled — '
      + 'never the host process or another worker. The subagent must be your direct or descendant child.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      required: ['subagent_id', 'mode'],
      properties: {
        subagent_id: {
          type: 'string',
          description: 'The subagent id returned when the background subagent was started.',
        },
        mode: {
          type: 'string',
          enum: ['graceful', 'force'],
          description: '"graceful" aborts the model turn only; "force" additionally process-group-kills the pgids you pass.',
        },
        grace_ms: {
          type: 'number',
          description: 'In force mode, milliseconds to wait after SIGTERM before escalating to SIGKILL. Default 2000, capped at 30000.',
        },
        pgids: {
          type: 'array',
          description: 'In force mode, REQUIRED non-empty list of process groups the subagent spawned, e.g. collected from the stuck process tree. Each item: { pid, started? } — pid is the process-group id (signals target -pid), started optionally pins the /proc starttime (field 22) recorded when the group was captured to guard against pid reuse; omit it to let the tool capture starttime itself right before signalling.',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['pid'],
            properties: {
              pid: { type: 'integer', description: 'The process-group id; a positive integer signalled as -pid.' },
              started: { type: 'string', description: 'Optional /proc starttime fence value captured at attribution time.' },
            },
          },
        },
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['mode', 'interrupted', 'signalledGroups', 'staleGroups'],
        properties: {
          mode: { type: 'string', enum: ['graceful', 'force'] },
          interrupted: { type: 'boolean' },
          signalledGroups: { type: 'number' },
          staleGroups: { type: 'number' },
        },
      },
      render: (rawArgs, value) => {
        // render 必须全函数且不抛：对 args 做防御性读取。
        const label = isRecord(rawArgs) && typeof rawArgs.subagent_id === 'string' ? rawArgs.subagent_id : '?'
        const mode = isRecord(rawArgs) && typeof rawArgs.mode === 'string' ? rawArgs.mode : '?'
        return [{
          type: 'text',
          text: `stop_subagent ${label} (${mode}): ${value.interrupted ? 'interrupt requested' : 'no live target'}; `
            + `${value.signalledGroups} process group${value.signalledGroups === 1 ? '' : 's'} signalled, ${value.staleGroups} stale skipped`,
        }]
      },
    },
    async execute(rawArgs, exec) {
      const args = narrowStopArgs(rawArgs)
      const caller = exec.agent
      if (!caller) {
        // ancestor 授权要求确切的存活调用方 Agent；缺失即静默越权，故 fail loud。
        throw new Error('stop_subagent requires a calling agent (exec.agent was undefined)')
      }
      // 服务侧自行校验调用方 lineage；插件不追加任何授权。interrupt 失败会
      // throw，因此走到这里 interrupted 恒为 true。
      ctx.subagents.interrupt(args.subagent_id, { kind: 'ancestor', agent: caller })

      let signalledGroups = 0
      let staleGroups = 0
      if (args.mode === 'force') {
        // pgids 显式来自调用方；未登记 started 的组在首个信号前现捕围栏值。
        const targets: KillTarget[] = args.pgids.map((entry) => ({
          pid: entry.pid,
          started: entry.started ?? readStarted(entry.pid),
          stale: false,
        }))
        // SIGTERM 整组：-pid 只命中该进程组，不触及 host pid 或其他 worker。
        for (const target of targets) {
          if (pidReused(target)) {
            target.stale = true
            continue
          }
          signalGroup(target, 'SIGTERM')
        }
        const wait = graceMs(args.grace_ms)
        if (targets.length > 0 && wait > 0) await sleep(wait)
        // SIGKILL 前重新围栏：SIGTERM 后组已退出时 kill 直接 ESRCH no-op，
        // 重用过的 pid 跳过。
        for (const target of targets) {
          if (pidReused(target)) {
            target.stale = true
            continue
          }
          if (signalGroup(target, 'SIGKILL')) signalledGroups += 1
        }
        staleGroups = targets.filter((target) => target.stale).length
      }

      return { mode: args.mode, interrupted: true, signalledGroups, staleGroups }
    },
  }), 'tool-stop-subagent.register()')
}
