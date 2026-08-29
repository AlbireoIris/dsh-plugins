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
    /** Slot registry service (provided by the web shell). */
    slots: {
      inject(name: string, contribute: () => unknown): void
      register(spec: SlotSpec, component: unknown): () => void
    }
    /** webServer service (provided by the dsh web host). */
    webServer: {
      register(route: WebRoute): () => void
    }
  }

  /** Slot registration spec understood by the shell registry. */
  export interface SlotSpec {
    name: string
    id: string
    order?: number
    inject?: () => unknown
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
