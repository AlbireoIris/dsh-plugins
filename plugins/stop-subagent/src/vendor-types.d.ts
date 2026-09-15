/**
 * Minimal local declarations for the harness packages this plugin touches.
 * At runtime the host provides the real services; this repo stays buildable
 * standalone by declaring only the surface the source reads. Every harness
 * import stays type-only, so lib/index.js carries no runtime dependency.
 */
declare module '@deepseek-ai/cordis' {
  export interface Context {
    /** 注册一个随本插件 fiber 卸载而释放的副作用，返回副作用产物。 */
    effect<T>(execute: () => T, label?: string): T
    tools: import('./index').ToolsRegistry
    subagents: import('./index').SubagentsService
  }
}
