/**
 * Minimal local declarations for the dsh packages this plugin type-imports.
 * Runtime packages are provided by the dsh web host.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    effect<T>(dispose: () => T, label?: string): T
    slots: {
      inject(name: string, contribute: () => unknown): void
      register(spec: SlotSpec, component: unknown): () => void
    }
  }

  export interface SlotSpec {
    name: string
    key?: string
    id?: string
    locale?: string
    order?: number
    children?: Record<string, { kind: string; scope: string }>
    inject?: () => unknown
  }
}

declare module '@deepseek-ai/dsh-client-ui-slots' {}
declare module '@deepseek-ai/dsh-client-ui-primitives' {}
declare module '@deepseek-ai/dsh-client-ui-primitives/client' {}

