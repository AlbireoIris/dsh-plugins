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

declare module '@deepseek-ai/cordis' {
  interface Context {
    sessions: import('./client/index').SessionsService
  }
}

declare module './client/index' {
  export interface SessionsService {
    readonly list: {
      getSnapshot(): {
        readonly current?: string
        readonly byId: Readonly<Record<string, { readonly running: boolean }>>
      }
    }
    binding(id: string): { session: { cancel(): Promise<unknown> } } | undefined
  }
}
