/**
 * Minimal local declarations for the dsh packages this plugin type-imports.
 * At runtime the dsh web host provides the real packages; this repo stays
 * buildable standalone by declaring only what the source reads.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    /** Register a side effect disposed with this plugin fiber. */
    effect<T>(dispose: () => T, label?: string): T
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
  }
}

declare module '@deepseek-ai/dsh-commands' {
  import type { SessionId } from '@deepseek-ai/dsh-session'
  import type { AbortSignal } from 'node:abort_controller'

  export interface AgentStub {
    readonly sessionId: SessionId
    readonly session: {
      readonly id: SessionId
      readonly header: { readonly cwd?: string }
    }
  }

  export interface CommandInvocation {
    readonly agent: AgentStub
    readonly rawInput: string
    readonly signal: AbortSignal
  }

  export type CommandResult =
    | { readonly kind: 'success'; readonly text?: string }
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

declare module '@deepseek-ai/dsh-session' {
  export type SessionId = string
  export interface SessionEvent {
    readonly type: string
  }
  export interface Session {
    readonly id: SessionId
    readonly header: { readonly cwd?: string }
  }
}

declare module '@deepseek-ai/dsh-session-persistence-jsonl/src/format.ts' {
  import type { SessionEvent } from '@deepseek-ai/dsh-session'
  export type JsonlCompression = 'zstd' | 'none'
  export interface SessionHeader {
    readonly cwd?: string
  }
  export interface SessionLogScan {
    readonly meta: SessionHeader
    readonly events: readonly SessionEvent[]
    readonly committedBytes: number
  }
  export function logPath(
    root: string,
    cwd: string | undefined,
    id: string,
    compression: JsonlCompression,
  ): string
  export function toHeaderLine(header: SessionHeader): string
  export function eventLines(events: readonly SessionEvent[], packChunks: boolean): string
  export function scanLog(buffer: Buffer): SessionLogScan
}

declare module '@deepseek-ai/dsh-session-persistence-jsonl/src/zstd.ts' {
  export function compressZstdFrame(input: Buffer | string): Promise<Buffer>
}
