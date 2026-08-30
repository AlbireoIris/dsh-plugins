/**
 * Minimal local declarations for the dsh packages this plugin type-imports.
 * At runtime the dsh web host provides the real packages; this repo stays
 * buildable standalone by declaring only what the source reads.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    /** Register a side effect disposed with this plugin fiber. */
    effect<T>(dispose: () => T, label?: string): T
    logger: { info(message: string): void; warn(message: string): void }
  }
}

declare module '@deepseek-ai/schemastery' {
  export default class z<T = unknown> {
    constructor(schema?: unknown)
    static object(schema: unknown): any
    static array(schema: unknown): any
    static string(): any
    static number(): any
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    commands: import('@deepseek-ai/dsh-commands').CommandRuntime
    tokenMeter: import('@deepseek-ai/dsh-token-meter').TokenMeter
    sessions: import('@deepseek-ai/dsh-session').SessionStore
  }
}

declare module '@deepseek-ai/dsh-commands' {
  import type { Agent } from '@deepseek-ai/dsh-agent'

  export interface CommandInvocation {
    readonly agent: Agent
    readonly rawInput: string
    readonly signal: AbortSignal
    readonly commandId?: string
  }

  export type CommandResult =
    | { readonly kind: 'success'; readonly text?: string; readonly sourceEventSeq?: number }
    | { readonly kind: 'error'; readonly text: string }

  export interface CommandDefinition {
    readonly name: string
    readonly description: string
    readonly recordInput?: boolean
    readonly handler: (invocation: CommandInvocation) => CommandResult | Promise<CommandResult>
  }

  export interface CommandRuntime {
    register(definition: CommandDefinition): () => void
  }
}

declare module '@deepseek-ai/dsh-commands/brand' {
  export type CommandId = string
}

declare module '@deepseek-ai/dsh-agent' {
  import type { Session } from '@deepseek-ai/dsh-session'

  export interface Agent {
    readonly session: Session
    readonly options: { readonly provider?: string; readonly model?: string }
  }
}

declare module '@deepseek-ai/dsh-session' {
  export type SessionId = string

  export interface SessionEvent {
    readonly type: string
    readonly seq: number
  }

  export interface Session {
    readonly id: SessionId
    readonly header: { readonly cwd?: string }
    readonly events: readonly SessionEvent[]
    readonly surface: { readonly nodes: readonly number[] }
  }

  export interface SessionStore {
    flush(session: Session): Promise<unknown>
  }
}

declare module '@deepseek-ai/dsh-llm' {
  export interface ContentBlock {
    readonly type: string
    readonly text?: string
  }
}

declare module '@deepseek-ai/dsh-token-meter' {
  export interface TokenMeter {
    measure(session: unknown): unknown
    estimateMessage(message: unknown): number
  }
}

declare module '@deepseek-ai/dsh-compaction' {
  export function toolPairingBalancedBefore(session: { readonly events: readonly unknown[] }, seq: number): boolean
}

declare module '@deepseek-ai/dsh-compaction-basic/src/region.ts' {
  import type { Session } from '@deepseek-ai/dsh-session'
  import type { Agent } from '@deepseek-ai/dsh-agent'
  import type { TokenMeter } from '@deepseek-ai/dsh-token-meter'
  import type { SummaryResult } from '@deepseek-ai/dsh-compaction-basic/src/summarizer.ts'

  export interface CompactionResult {
    readonly compactionId: string
    readonly startSeq: number
    readonly summarySeq: number
    readonly summary: readonly unknown[]
    readonly shadowedRange: { readonly start: number; readonly end: number }
    readonly shadowedSeqs: readonly number[]
    readonly shadowedTokenCount: number
    readonly endSeq: number
  }

  export interface CompactTransactionOptions {
    readonly owner: 'current-turn' | null
    readonly stability: 'whole-surface' | 'selected-span'
    readonly flush?: () => Promise<void>
    readonly sourceCommandId?: string
  }

  export function compactSurfaceRegion(
    dependencies: {
      meter: TokenMeter
      summarize: (input: unknown, agent: Agent, signal?: AbortSignal) => Promise<SummaryResult>
    },
    session: Session,
    start: number,
    end: number,
    agent: Agent,
    options: CompactTransactionOptions,
    signal?: AbortSignal,
  ): Promise<CompactionResult>
}

declare module '@deepseek-ai/dsh-compaction-basic/src/summarizer.ts' {
  import type { ContentBlock } from '@deepseek-ai/dsh-llm'

  export interface SummaryResult {
    readonly summary: readonly ContentBlock[]
    readonly provider: string
    readonly model: string
  }
}
