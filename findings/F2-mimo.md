# F2-mimo — MiMo-Code 上下文管理证据档（2026-09 轮）
> 锚定：`MiMo-Code @ 1592084b2e1fa64dc5a115708d0b5124bb9a3581`（HEAD 2026-09-20）
> 精读范围：packages/opencode/src/session、memory、tool、checkpoint；未覆盖：全仓逐行阅读。静态源码取证，未运行验证。
> 证据分级计数：A=22 B=3 C=0 D=1
> 覆盖范围与未覆盖：覆盖 RQ-01~06 入口及 OQ-4 预算线索；未覆盖文件不据此下结论。

## 1 上下文组装（RQ-01）
- 结论：session system/instruction/prompt 分层组装，入口文件分别存在：`packages/opencode/src/session/system.ts:1`、`packages/opencode/src/session/instruction.ts:1`、`packages/opencode/src/session/prompt.ts:1`。
- 结论：请求前缀与快照单独建模：`packages/opencode/src/session/llm-request-prefix.ts:1`、`packages/opencode/src/session/prefix-snapshot.ts:1`。

## 2 token 估算与判压（RQ-02）
- 结论：overflow 与 boundary 分别负责上下文超限判定和边界处理：`packages/opencode/src/session/overflow.ts:1`、`packages/opencode/src/session/boundary.ts:1`。
- 结论：前次所称 usable*0.9 本轮需以实现分支逐条重核；此档不把未读到的常量写成已确认：`packages/opencode/src/session/overflow.ts:1`（未确认具体公式）。

## 3 压缩淘汰摘要（RQ-03）
- 结论：压缩、摘要、尾部摘要、max-mode 分文件实现：`packages/opencode/src/session/compaction.ts:1`、`packages/opencode/src/session/summary.ts:1`、`packages/opencode/src/session/tail-digest.ts:1`、`packages/opencode/src/session/max-mode.ts:1`。
- 结论：prune 与 checkpoint 是独立路径：`packages/opencode/src/session/prune.ts:1`、`packages/opencode/src/session/checkpoint.ts:1`。
- 结论：工具输出截断/外溢需结合 src/tool 实现，当前未确认 50KB 是否仍为本锚定默认：`packages/opencode/src/tool:1`（未确认）。

## 4 会话落盘与恢复（RQ-04）
- 结论：会话 SQL、轨迹和 projector 分层存在：`packages/opencode/src/session/session.sql.ts:1`、`packages/opencode/src/session/trajectory.ts:1`、`packages/opencode/src/session/projectors.ts:1`。
- 结论：resume hooks 与 schema 提供恢复测试/结构依据：`packages/opencode/src/session/resume-test-hooks.ts:1`、`packages/opencode/src/session/schema.ts:1`。

## 5 skill/memory 加载（RQ-05）
- 结论：memory index/service/paths/write-gate/fts/reconcile 分层存在：`packages/opencode/src/memory/index.ts:1`、`packages/opencode/src/memory/service.ts:1`、`packages/opencode/src/memory/paths.ts:1`、`packages/opencode/src/memory/write-gate.ts:1`、`packages/opencode/src/memory/fts-query.ts:1`、`packages/opencode/src/memory/reconcile.ts:1`。
- 结论：skill catalog 独立入口存在，全文加载策略未确认：`packages/opencode/src/session/skill-catalog.ts:1`（未确认）。

## 6 长会话续跑与恢复（RQ-06）
- 结论：goal 与 boundary 共同参与长会话续跑：`packages/opencode/src/session/goal.ts:1`、`packages/opencode/src/session/boundary.ts:1`。
- 结论：兼容导入覆盖 claude/codex/opencode/external：`packages/opencode/src/session/claude-import.ts:1`、`packages/opencode/src/session/codex-import.ts:1`、`packages/opencode/src/session/opencode-import.ts:1`、`packages/opencode/src/session/external-import.ts:1`。

## 7 与前次结论差量
- 判定：更新/待确认——本文件已确认分层入口，但阈值与 checkpoint 11 段超限行为未完成逐分支重核：`packages/opencode/src/session/checkpoint.ts:1`（未确认）。

## 8 未确认清单
- `packages/opencode/src/session/overflow.ts:1`：判压精确公式未确认。
- `packages/opencode/src/tool:1`：50KB spill 是否为默认未确认。
- `packages/opencode/src/session/checkpoint.ts:1`：11 段预算每段语义及超限行为未确认。
