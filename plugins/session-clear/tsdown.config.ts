/**
 * Standalone build config: Node half (lib/index.js, ESM). Host-only plugin;
 * all dsh-value imports stay external (provided by the web host).
 */
import { isBuiltin } from 'node:module'
import { defineConfig } from 'tsdown'

const id = '@deepseek-ai/dsh-session-clear'
const EXTERNAL = ['@deepseek-ai/schemastery', '@deepseek-ai/dsh-commands', '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-compaction',
  '@deepseek-ai/dsh-compaction-basic/src/region.ts',
  '@deepseek-ai/dsh-compaction-basic/src/summarizer.ts',
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
