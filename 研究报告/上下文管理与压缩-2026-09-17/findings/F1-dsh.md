# F1 — deepseek-harness (dsh)

Local source-only research of `H:\deepseek-harness` (TypeScript monorepo, "Everything is a Plugin" / Cordis).

## Architecture overview

dsh keeps conversation history as an **append-only event log** (`Session`) plus a derived **surface** (ordered view of message-producing events). Compaction never deletes log events: it appends log-only `compaction/*` bookkeeping and a `user/message` with `surfaceOp: { op: 'replace' }` that shadows an older surface span with one checkpoint summary. Replay from the log is deterministic.

Context assembly is layered: (1) system prompt via `ctx.systemPrompt` assembly → `system/message` surface node 0 (or in-history append); (2) tool schemas via `request/header`; (3) conversation surface via `session.deriveMessages()`; (4) injected plugin context (AGENTS.md, skills catalog, runtime context, session references) as durable sourced `user/message` events. Token pressure is measured by a replay-aware singleton `ctx.tokenMeter`.

Compression has three stacked mechanisms: **model-free tool-result pruning** (head/marker/tail by Unicode code points), **LLM summarization of an oldest balanced span** (pressure or context-overflow), and **manual fold commands** (`/compact` summarized; `/clear` in `session-clear` deterministic clear). Persistence is per-session JSONL (optionally Zstandard frames); compaction payloads live inside those logs.

## Context assembly pipeline

| Stage | Source |
|---|---|
| Prompt sections/variables/tools registry | `packages/core/system-prompt/src/index.ts` — ordered sections, `{{var}}` interpolation, tool schemas, waterfall `system-prompt/assemble` |
| Prompt render + admission | `packages/core/agent-loop/src/agent.ts` ~240–379: `assemble` → `renderPrompt` → `systemPrompt.project` → `session.append('system/message')` |
| Surface projection | `packages/core/session/src/surface.ts` — `deriveEventMessage`; only `system/message`, `user/message`, `assistant/message`, `tool/result` with `surfaceOp` |
| Model history | `packages/core/session` `deriveMessages()` over surface nodes |
| Request envelope | `request/header` (tools, call config); system prompt is NOT in the header — it is a surface node |
| AGENTS.md chain | `packages/context/agent-instructions` — baseline + refresh as sourced `user/message`, byte-budgeted |
| Skills catalog | `packages/skill/tool-skill` — durable user-role catalog before first request; full body via `skill` tool |
| Cross-session refs | `packages/context/session-reference` — bounded untrusted snapshot after citing message |
| Runtime context | `packages/core/agent-loop/src/runtime-context.ts` + `renderContextSections` |

System-prompt order highlights (`packages/core/system-prompt/src/index.ts` ~121–150): harness identity −1000, persona 0/10200, tool guidance 1000–2900, SDK 5000, structured output 9900.

## Token budget & thresholds

### Heuristic estimator (`packages/llm/token-meter/src/estimate.ts`)
- `CHARS_PER_TOKEN = 4` (L13)
- `BLOCK_OVERHEAD = 4`, `ROLE_OVERHEAD = 4`
- Text/reasoning: `ceil(chars/4) + 4`; tools: name+args; system: chars/4 + ROLE_OVERHEAD
- Tools schemas: `ceil(JSON.stringify(tools)/4) + 4`
- Underprices CJK and JSON Schema (documented limitation)

### Pressure measurement (`packages/llm/token-meter/src/types.ts`)
- `totalTokens` = request+response pressure (provider-usage anchored when envelope matches)
- `surfaceTokens` / `nodes[].tokens` = route-priced surface
- `nodes[].heuristicTokens` = fixed-heuristic price (shadow-price protocol)
- Projections: `tokenUsage`, `contextPressure` (`pressureTokens`, `projectedTokens`, `contextWindow`), `contextBreakdown` (`systemTokens`, `toolsTokens`, `messageTokens`)

### Compaction policy (`packages/compaction/compaction-basic/src/config.ts`)
| Key | Default | Formula / meaning |
|---|---|---|
| `thresholdRatio` | `0.8` | `thresholdTokens = floor(contextWindow × ratio)` (L144) |
| `retainRatio` | `0.16` | `retainTokens = floor(contextWindow × ratio)` unless absolute `retainTokens` |
| `retainTokens` | — | absolute; must be `< thresholdTokens` |
| `maxTokens` (summarizer) | `8192` | generation cap |
| `compactionRetries` | `1` | extra summarize attempts while above threshold |
| `maxOverflowRetries` | `1` | retries after `CONTEXT_WINDOW_EXCEEDED` |
| `auto` | `true` | pressure + overflow listeners |
| `modelPolicies[]` | `[]` | exact `{provider,model}` overrides |

Capacity comes from adapter `resolveModelInfo().context.contextWindow` — not model discovery.

### Tool-result prune (`packages/compaction/compaction-tool-result-pruner/src/config.ts`)
| Key | Default |
|---|---|
| `thresholdChars` | `8192` Unicode code points |
| `headChars` | `4096` |
| `tailChars` | `1024` |
| Marker | `\n\n[... tool result middle pruned ...]\n\n` |

### Other budgets
| Area | Default | Path |
|---|---|---|
| AGENTS.md baseline | `maxBytes` required; base enables `65536` | `packages/context/agent-instructions` |
| AGENTS.md single file | `maxSourceBytes` `1_048_576` | same |
| Session-reference per source | `max(65536, floor(contextWindow × 4 × 0.2))` bytes; max 3 refs | `packages/context/session-reference/src/config.ts` |
| bash-local stream cap | `maxOutputBytes` `64_000` | `packages/shell/bash-local/src/index.ts` L109 |
| bash spill file | `maxSpillBytes` `64 * 1024 * 1024` | same L38 |
| bash-persistent chars | `maxOutputChars` `16_000` + clipped NOTE | `packages/shell/tool-bash-persistent` |
| Skill catalog description | `catalogDescriptionMaxLength` `500` | `packages/skill/tool-skill` |
| session-clear keep | `keepTurns` default `10` (1–50) | `packages/host/session-clear` |
| Web fetch truncate | head+footer | `packages/web/tool-web/src/fetch.ts` L265 |

## Compression mechanisms

### 1. Automatic pressure compaction
- **Trigger:** `agent/pre-step` listener when `measurement.totalTokens >= thresholdTokens` (`packages/compaction/compaction-basic/src/index.ts` L148–166, L259–333)
- **Does:** optional prune → remeasure → `selectCompactableRange` (oldest balanced span after system head, retain recent tail) → `compactRegion` → summarize → surface replace
- **Retry loop:** up to `compactionRetries+1` while still above threshold

### 2. Context-overflow recovery
- **Trigger:** `agent/request-error` with `CONTEXT_WINDOW_EXCEEDED` (L180–224)
- **Does:** prune first; `selectCompactableRange(..., retainTokens=0)` (maximal head reduction); retry only if `surface.replaceGeneration` advanced
- Cap: `maxOverflowRetries` (default 1)

### 3. LLM summarization (checkpoint)
- **Files:** `summarizer.ts` + `region.ts`
- Replays system head + tools + shadowed messages byte-for-byte for KV-cache reuse; appends `COMPACTION_INSTRUCTION` as final user message
- Fixed Markdown structure (Primary Request, Key Technical Concepts, Files and Code, Errors and Fixes, Pending Jobs, Current Work, Next Step, Critical Context)
- Output framed as `<compacted-summary>...</compacted-summary>` in replacement `user/message`
- Shrink check: framed summary tokens must be `<` shadowed route tokens (`region.ts` L399–407)
- Images in summary rejected (`UNSUPPORTED_CONTENT`); `maxTokens` truncation fails the attempt

### 4. Tool-result pruning (model-free)
- **Trigger:** only after a compaction trigger qualifies (pressure or overflow)
- **Does:** for each surface `tool/result` over budget: head + marker + tail; append `compaction/prune` (shadow price) then replacement `tool/result` with `surfaceOp: replace`
- May skip summarization if remeasured pressure drops below threshold

### 5. Manual `/compact`
- `packages/compaction/command-compact/src/index.ts` — `ctx.compaction.compactNow`; idle-only (`runMaintenance`); reports item count and ~tokens

### 6. Manual `/clear` (session-clear fold)
- **Plugin:** `packages/host/session-clear` (`@deepseek-ai/dsh-session-clear`)
- Folds everything older than last `keepTurns` visible turns into **one deterministic marker** (no LLM)
- Uses official `compactSurfaceRegion` with `owner: null` bracket; tool-pairing balanced boundary required
- User phrasing "session-clear: run the fold in manual mode" maps to this package: manual idle fold via `/clear`

### Transaction / lock protocol
All entry points share (`region.ts` L173–275):
1. Validate balanced surface span + no live unmatched `compaction/start`
2. Append `compaction/start` (lock)
3. Summarize
4. Revalidate (auto: whole-surface; manual: selected-span)
5. Append `compaction/summary` + `user/message` replace (the only surface mutation)
6. Exactly one `compaction/end` attempt (failed close leaves orphan lock)

Stale unmatched starts older than newest `session/end-seed` do not block.

## Tool output handling

| Layer | Behavior |
|---|---|
| bash-local / pwsh-local | Keep last `maxOutputBytes` (64KB default) per stream; overflow to spill file up to `maxSpillBytes` (64MB); truncated + `spillPath` reported |
| tool-bash-persistent | Cap `maxOutputChars` (16k); append `<response clipped><NOTE>…grep -n…</NOTE>` |
| tool-result-pruner | After pressure: rewrite over-budget tool results on the surface (full original stays in log) |
| web-fetch | Head + `(Content truncated…)` footer |
| fs read | Fail `FS_TOO_LARGE` rather than truncate unbounded files |

## Persistence

- **Format:** logical session format v3 (`SESSION_FORMAT_VERSION = 3` in `packages/core/session/src/types.ts` L88)
- **Backend:** `packages/session/session-persistence-jsonl` — per-session directory
- **Layout:**
  ```
  <root>/<normalized-cwd>/<encoded-session-id>/
    session.v3.jsonl.zstd   # current (default zstd frames)
    session.v2.jsonl.zstd   # historical generations kept
    session.jsonl           # if compression: 'none'
  ```
- Header line: `{ type:'session', version, id, createdAt, cwd?, parentSession?, isSeeded, delegationDepth, agentPreset? }`
- Then one JSON row per durable event; `sourceEventSeqs` stored as run-length pairs when long
- Compaction events (`compaction/start|summary|end|prune`) are durable log-only rows; the surface replace is a durable `user/message` row
- Crash: torn tail recovered; committed events never rewritten
- `ctx.sessions.flush(session)` is the durability barrier (manual compaction flushes before releasing admission)

## Key code snippets

**Heuristic density** (`estimate.ts`):
```ts
const CHARS_PER_TOKEN = 4
tokens += Math.ceil(block.text.length / CHARS_PER_TOKEN) + BLOCK_OVERHEAD
```

**Pressure threshold** (`compaction-basic/config.ts`):
```ts
const thresholdTokens = Math.floor(contextWindow * policy.thresholdRatio)
const retainTokens = policy.retainTokens ?? Math.floor(contextWindow * policy.retainRatio)
```

**Surface replace** (`compaction-basic/region.ts` ~491):
```ts
session.append('user/message', checkpointMessage, {
  surfaceOp: { op: 'replace', startSeq: start, endSeq: end },
  sourceEventSeqs: [startEvent.seq, summaryEvent.seq, ...shadowedSeqs],
})
```

**Prune marker** (`compaction-tool-result-pruner/config.ts`):
```ts
export const PRUNE_MARKER = '\n\n[... tool result middle pruned ...]\n\n'
// defaults: threshold 8192, head 4096, tail 1024 code points
```

**Range selection** (`region.ts` `selectCompactableRange`): skip system head at node 0; walk backward accumulating `retainTokens`; snap cut to `toolPairingBalancedBefore`.

## Mermaid diagram suggestion

```mermaid
flowchart TB
  subgraph assembly [Per-step assembly]
    SP[SystemPrompt assemble + renderPrompt]
    TH[request/header tools + config]
    SYS[system/message surface node 0 or in-history]
    INJ[Injected user messages: AGENTS.md, skills catalog, runtime context, session refs]
    SURF[surface.deriveMessages]
    SP --> SYS
    SYS --> SURF
    INJ --> SURF
    TH --> REQ[LLM request messages + tools]
    SURF --> REQ
  end

  subgraph measure [TokenMeter]
    M[measure session<br/>totalTokens / nodes]
    H[4 chars/token heuristic + provider usage anchor]
    M --- H
  end

  subgraph compress [Compression]
    T1[pre-step pressure]
    T2[CONTEXT_WINDOW_EXCEEDED]
    T3[/compact or /clear]
    P[ToolResultPruner<br/>head+marker+tail]
    R[selectCompactableRange<br/>balanced + retain tail]
    S[LLM summarize<br/>structured checkpoint]
    REP[user/message surfaceOp replace]
    T1 --> P
    T2 --> P
    T3 --> R
    P --> R --> S --> REP
  end

  REQ --> M
  M -->|>= 0.8 × contextWindow| T1
  M -->|overflow| T2
  REP --> SURF

  subgraph persist [Persistence]
    LOG[Append-only session JSONL / zstd]
    LOG -->|replay| SURF
    REP -.-> LOG
  end
```

## Confidence notes

**Found in source (high confidence):** all packages, defaults, formulas, transaction order, event payloads, surface replace mechanism, session-clear fold, token heuristic, persistence layout, system-prompt/AGENTS.md/skill injection paths.

**Inferred / partial:** exact adapter overflow classification wording beyond `CONTEXT_WINDOW_EXCEEDED_CODE` (DeepSeek adapters normalize); no standalone "memory" package (agent memory beyond AGENTS.md/skills/session refs was not found under `packages/**/memory*`); image route pricing depends on adapter-declared `requestImage` pricing (not fully enumerated here).

**Not present:** model-facing compaction tool (explicitly deferred); semantic middle selection for pruner; exact provider tokenizer (deferred to 4-char heuristic).
