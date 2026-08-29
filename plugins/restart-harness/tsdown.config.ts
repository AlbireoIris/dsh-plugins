/**
 * Standalone build config: Node half (lib/index.js, ESM) plus the browser
 * client (lib/client.js, CJS wrapped in the dsh ModuleLoader handoff).
 * React stays external — the dsh web shell supplies it through its module
 * table. The client bundle's CSS is already inlined as a string in
 * src/client/css-text.ts, so no CSS pipeline is needed here.
 */
import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-client-restart-harness'

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
      neverBundle: (specifier) => specifier === 'react' || specifier === 'react/jsx-runtime',
      alwaysBundle: (specifier) => specifier !== 'react' && specifier !== 'react/jsx-runtime',
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
