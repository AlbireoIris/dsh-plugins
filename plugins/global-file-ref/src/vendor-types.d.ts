/**
 * Minimal local declarations for the dsh packages this plugin type-imports.
 * At runtime the dsh web host provides the real packages; this repo stays
 * buildable standalone by declaring only what the source reads.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    /** Register a side effect disposed with this plugin fiber. */
    effect<T>(dispose: () => T, label?: string): T
    /** Optional service read (undefined when the service is not active). */
    get<T>(name: string): T | undefined
    /** webServer service (provided by the dsh web host). */
    webServer: {
      register(route: {
        kind: 'exact'
        path: string
        handler: (
          req: import('node:http').IncomingMessage,
          res: import('node:http').ServerResponse,
        ) => void | Promise<void>
      }): () => void
    }
  }
}

declare module '@deepseek-ai/dsh-host-webserver' {
  // Real package augments the webServer service map; nothing is read here.
}

declare module '@deepseek-ai/dsh-client-ui-input-trigger/client' {
  // Minimal shapes of the input-trigger contract this plugin reads.
  export interface InputTriggerCandidate {
    readonly name: string
    readonly description?: string
    readonly icon?: 'file' | 'folder' | 'session'
    readonly hint?: string
    readonly section?: string
    readonly value?: string
    readonly drill?: boolean
  }

  export interface InputTriggerPick {
    readonly candidate: InputTriggerCandidate
    readonly action: 'pick' | 'drill'
  }

  export type PickOutcome =
    | { readonly text: string }
    | undefined

  export interface ClientSessionContext {
    readonly sessionId: string
  }

  export interface CandidateRequest {
    readonly query: string
    readonly signal: AbortSignal
  }

  export interface InputTriggerSource {
    readonly trigger: '@' | '/'
    readonly name: string
    readonly order?: number
    readonly showGroupTitle?: boolean
    candidates(
      session: ClientSessionContext,
      req: CandidateRequest,
    ): Promise<readonly InputTriggerCandidate[]>
    onPick(pick: InputTriggerPick): PickOutcome
  }
}
