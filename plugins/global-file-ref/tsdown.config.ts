/**
 * Standalone build config: Node half (lib/index.js, ESM) plus the browser
 * client (lib/client.js, CJS wrapped in the dsh ModuleLoader handoff).
 * The client bundle imports nothing external at runtime.
 */
import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-client-global-file-ref'

// Host half: pick the platform entry at build time so each platform ships
// the logic it actually runs (win: drive roots + backslashes; linux:
// /proc/mounts mounted roots, dot-entries hidden by default).
const hostEntry = process.platform === 'win32'
  ? ['lib/types/win/index.js']
  : ['lib/types/linux/index.js']

export default defineConfig([
  {
    name: id,
    entry: hostEntry,
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
