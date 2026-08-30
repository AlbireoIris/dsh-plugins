/**
 * Minimal local declarations for the dsh packages this plugin type-imports.
 * At runtime the dsh web host provides the real packages; this repo stays
 * buildable standalone by declaring only what the source reads.
 */
declare module '@deepseek-ai/cordis' {
  /** Route spec accepted by the webServer registry. */
  export interface WebRoute {
    kind: 'exact'
    path: string
    handler: (
      req: import('node:http').IncomingMessage,
      res: import('node:http').ServerResponse,
    ) => void | Promise<void>
  }

  export interface Context {
    /** Row config object supplied by cordis.yml, when present. */
    config: unknown
    /** Register a side effect disposed with this plugin fiber. */
    effect<T>(dispose: () => T, label?: string): T
    /** Optional service read (undefined when the service is not active). */
    get<T>(name: string): T | undefined
    /** Slot registry service (provided by the web shell). */
    slots: {
      inject(name: string, contribute: () => unknown): void
      register(spec: unknown, component: unknown): () => void
    }
    /** webServer service (provided by the dsh web host). */
    webServer: {
      register(route: WebRoute): () => void
    }
  }
}

declare module '@deepseek-ai/dsh-client-ui-renderer/client' {
  // Real package augments service maps; nothing is read here.
}

declare module '@deepseek-ai/dsh-client-ui-conversation/client' {
  // Real package augments the SlotMap; nothing is read here.
}

declare module '@deepseek-ai/dsh-host-webserver' {
  // Real package augments the webServer service map; nothing is read here.
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

declare module '@deepseek-ai/dsh-client-ui-slots' {
  /** Minimal runtime-props share of a root-scope slot (owner facts only). */
  export type PropsRuntime<K extends string> = { readonly [key in K]: unknown }
}

declare module '@deepseek-ai/dsh-client-ui-sidebar/client' {
  // Real package augments the SlotMap; nothing is read here.
}

declare module '@deepseek-ai/dsh-client-ui-chat/client' {
  // Real package augments the SlotMap; nothing is read here.
}
