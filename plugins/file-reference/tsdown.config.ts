/**
 * Standalone build config: Node half (lib/index.js, ESM) plus the browser
 * client (lib/client.js, CJS wrapped in the dsh ModuleLoader handoff).
 * This plugin's client bundle imports nothing external at runtime.
 */
import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-client-file-reference'

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
      neverBundle: (specifier) => isBuiltin(specifier)
        || specifier === '@deepseek-ai/schemastery' || specifier === '@deepseek-ai/cordis',
      alwaysBundle: (specifier) => !isBuiltin(specifier)
        && specifier !== '@deepseek-ai/schemastery' && specifier !== '@deepseek-ai/cordis',
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
      neverBundle: (specifier) => specifier === "react" || specifier === "react/jsx-runtime",
      alwaysBundle: (specifier) => specifier !== "react" && specifier !== "react/jsx-runtime",
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
