/**
 * Standalone build: Node half (lib/index.js) + browser client (lib/client.js)
 * wrapped in the dsh ModuleLoader handoff. React and ui-primitives stay
 * external — the dsh web shell module table supplies them. CSS ships as a
 * string in client/css-text.ts.
 */
import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-client-mimo-image'
const clientExternal = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  '@deepseek-ai/dsh-client-ui-primitives',
])

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
      neverBundle: (specifier) => clientExternal.has(specifier),
      alwaysBundle: (specifier) => !clientExternal.has(specifier),
    },
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
