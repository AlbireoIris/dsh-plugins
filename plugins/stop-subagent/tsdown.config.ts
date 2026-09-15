/**
 * Standalone build config: host half only (lib/index.js, ESM). The bundle
 * imports nothing external at runtime — node builtins stay external and the
 * harness packages it type-imports are erased, so lib/index.js is
 * self-contained and can be mounted by bare path from any cordis.yml.
 */
import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-tool-stop-subagent'

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
])
