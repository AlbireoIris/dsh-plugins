/**
 * Standalone build config: Node half (lib/index.js, ESM). Host-only plugin;
 * all dsh-value imports stay external (provided by the web host).
 */
import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-session-clear'
const EXTERNAL = ['@deepseek-ai/dsh-commands', '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-persistence-jsonl/src/format.ts',
  '@deepseek-ai/dsh-session-persistence-jsonl/src/zstd.ts',
]

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
      neverBundle: (specifier) => isBuiltin(specifier) || EXTERNAL.includes(specifier),
      alwaysBundle: (specifier) => !isBuiltin(specifier) && !EXTERNAL.includes(specifier),
    },
  },
])
