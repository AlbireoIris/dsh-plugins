/**
 * Standalone build config: Node half (lib/index.js, ESM) plus the browser
 * client (lib/client.js, CJS wrapped in the dsh ModuleLoader handoff).
 *
 * Unlike a plugin whose client half only type-imports the harness, this one
 * renders real primitives and owns a CSS Modules stylesheet, so the config
 * carries two things the workspace preset would otherwise supply:
 *
 * - `@deepseek-ai/*` and react stay external. The web shell answers them from
 *   the module table seeded by `PLATFORM_MODULES` in
 *   packages/client/web/src/platform.ts — ui-slots, ui-primitives, and cordis
 *   are seed words, so `require` resolves them synchronously at boot.
 * - `.module.css` compiles through the `dsh-css-modules-inline` plugin below,
 *   a faithful port of the same plugin in packages/client/tsdown.client.ts.
 *   It emits one module carrying the minified stylesheet, a style injector,
 *   and the hashed class map, so the component's `css.<local>` reads work
 *   unchanged and class names stay collision-proof against the in-tree
 *   original this plugin shadows.
 */
import { isBuiltin } from 'node:module'
import { readFile } from 'node:fs/promises'
import { basename, dirname, resolve as resolvePath } from 'node:path'
import type { TsdownPlugin } from 'tsdown'
import { defineConfig } from 'tsdown'
import { transform } from 'lightningcss'

const id = '@deepseek-ai/dsh-client-subagent-newest-first'

/** Virtual-id wrapper keeping module CSS away from tsdown's own css pipeline. */
const CSS_VIRTUAL_PREFIX = '\0dsh-css:'
const CSS_VIRTUAL_SUFFIX = '.mjs'

/** Specifiers the dsh web shell supplies at runtime rather than the bundle. */
function suppliedByShell(specifier: string): boolean {
  return specifier === 'react'
    || specifier === 'react-dom'
    || specifier === 'react/jsx-runtime'
    || specifier.startsWith('@deepseek-ai/')
}

/** Emit one plugin-owned style injector and the CSS Modules export. */
function styleInjectionModule(
  pluginId: string,
  fileId: string,
  css: string,
  classMap?: Readonly<Record<string, string>>,
): string {
  const source = [
    `const css = ${JSON.stringify(css)};`,
    `const tagId = ${JSON.stringify(`${pluginId}/${basename(fileId)}`)};`,
    'if (typeof document !== \'undefined\' && document.querySelector(\'style[data-plugin-css=\' + JSON.stringify(tagId) + \']\') === null) {',
    '  const tag = document.createElement(\'style\');',
    `  tag.dataset.plugin = ${JSON.stringify(pluginId)};`,
    '  tag.dataset.pluginCss = tagId;',
    '  tag.textContent = css;',
    '  document.head.appendChild(tag);',
    '}',
  ]
  source.push(classMap === undefined ? 'export {};' : `export default ${JSON.stringify(classMap)};`)
  return source.join('\n')
}

/** Inline `.module.css` as a stylesheet string plus its hashed class map. */
function cssModulesInline(): TsdownPlugin {
  return {
    name: 'dsh-css-modules-inline',
    resolveId(source: string, importer: string | undefined) {
      if (!source.endsWith('.module.css')) return null
      const abs = importer !== undefined ? resolvePath(dirname(importer), source) : source
      return CSS_VIRTUAL_PREFIX + abs + CSS_VIRTUAL_SUFFIX
    },
    async load(virtualId: string) {
      if (!virtualId.startsWith(CSS_VIRTUAL_PREFIX)) return null
      const fileId = virtualId.slice(CSS_VIRTUAL_PREFIX.length, -CSS_VIRTUAL_SUFFIX.length)
      // The virtual id otherwise hides the physical stylesheet from Rolldown's watch graph.
      this.addWatchFile(fileId)
      const source = await readFile(fileId)
      const { code, exports: cssExports } = transform({
        filename: fileId,
        code: source,
        cssModules: { pattern: '[hash]_[local]' },
        minify: true,
      })
      const classMap: Record<string, string> = {}
      const exportEntries = Object.entries(cssExports ?? {})
        .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      for (const [local, exp] of exportEntries) classMap[local] = exp.name
      return styleInjectionModule(id, fileId, code.toString(), classMap)
    },
  }
}

export default defineConfig([
  {
    name: id,
    entry: ['lib/types/index.js'],
    outDir: 'lib',
    format: ['esm'],
    platform: 'node',
    target: 'es2024',
    fixedExtension: false,
    dts: false,
    clean: false,
    deps: {
      neverBundle: (specifier) => isBuiltin(specifier),
      alwaysBundle: (specifier) => !isBuiltin(specifier),
    },
  },
  {
    name: `${id}/client`,
    entry: { client: 'src/client/index.ts' },
    outDir: 'lib',
    format: 'cjs',
    platform: 'browser',
    target: 'es2024',
    dts: false,
    sourcemap: true,
    clean: false,
    deps: {
      neverBundle: suppliedByShell,
      alwaysBundle: (specifier) => !suppliedByShell(specifier),
    },
    plugins: [cssModulesInline()],
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
