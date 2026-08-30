/**
 * Standalone build config: Node half (lib/index.js, ESM) plus the browser
 * client (lib/client.js, CJS wrapped in the dsh ModuleLoader handoff).
 * The client bundle imports nothing external at runtime.
 */
import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-client-global-file-ref'

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
      neverBundle: (specifier) => isBuiltin(specifier) || specifier === 'koffi',
      alwaysBundle: (specifier) => !isBuiltin(specifier) && specifier !== 'koffi',
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
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
