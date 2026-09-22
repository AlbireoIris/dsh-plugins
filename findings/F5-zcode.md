# F5-zcode — ZCode 上下文管理证据档（2026-09 轮）
> 锚定：`ZCode @ 872ad960de7ec172591f7e1952f7849229f94521`（HEAD 2026-09-21）
> 精读范围：context、runtime/methods、bootstrap zcode-protocol-v4、storage、contracts、skills；未覆盖：全仓逐行阅读。静态源码取证，未运行验证。
> 证据分级计数：A=25 B=4 C=0 D=1
> 覆盖范围与未覆盖：覆盖 RQ-01~07 入口及五维异同素材；未覆盖文件不据此下结论。

## 1 上下文组装（RQ-01）
- 结论：请求用户上下文由 context section builder 负责，并读取项目 memory index：`apps/zcode-cli/packages/core/src/context/sections/request-user-context.ts:1`、`apps/zcode-cli/packages/core/src/memory/index-content.ts:1`。
- 结论：context runtime 提供刷新与历史条目访问：`apps/zcode-cli/packages/runtime/src/methods/context.ts:1`、`apps/zcode-cli/packages/runtime/src/methods/context-refresh.ts:1`、`apps/zcode-cli/packages/runtime/src/methods/context-history-entries.ts:1`。

## 2 token 估算与判压（RQ-02）
- 结论：model token limits、context usage、compact usage log 分工存在：`apps/zcode-cli/packages/runtime/src/methods/model-token-limits.ts:1`、`apps/zcode-cli/packages/runtime/src/methods/context-usage.ts:1`、`apps/zcode-cli/packages/runtime/src/methods/context-usage-log-compact.ts:1`。
- 结论：usage breakdown helper 负责拆分统计：`apps/zcode-cli/packages/runtime/src/helpers/context-usage-breakdown.ts:1`（具体阈值未确认）。

## 3 压缩淘汰摘要（RQ-03）
- 结论：compact 与 microcompact 为独立 runtime 方法：`apps/zcode-cli/packages/runtime/src/methods/compact.ts:1`、`apps/zcode-cli/packages/runtime/src/methods/microcompact.ts:1`。
- 结论：preservation、media、post-reminders、selection 是压缩辅助策略：`apps/zcode-cli/packages/runtime/src/helpers/compact-preservation.ts:1`、`apps/zcode-cli/packages/runtime/src/helpers/compact-media.ts:1`、`apps/zcode-cli/packages/runtime/src/helpers/compact-post-reminders.ts:1`、`apps/zcode-cli/packages/runtime/src/helpers/compact-selection.ts:1`。
- 结论：本地 TTFT 压缩与 goal compact 有独立入口：`apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/local-ttft-compaction.ts:1`、`apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/commands/handlers/goal-compact.ts:1`。

## 4 会话落盘与恢复（RQ-04）
- 结论：SQLite session store、session target、repositories 与 migrations 构成持久化层：`apps/zcode-cli/packages/adapters/src/storage/session-store/sqlite-session-store.ts:1`、`apps/zcode-cli/packages/adapters/src/storage/session-store/session-target.ts:1`、`apps/zcode-cli/packages/adapters/src/storage/session-store/repositories/sessions.ts:1`、`apps/zcode-cli/packages/adapters/src/storage/session-store/migrations:1`。
- 结论：session event retention 定义事件生命周期，in-memory store 实现事件存储：`apps/zcode-cli/packages/contracts/src/events/session-event-retention.ts:1`、`apps/zcode-cli/packages/contracts/src/events/in-memory-session-event-store.ts:1`。

## 5 skill/memory 加载（RQ-05）
- 结论：skills、skill command overrides、reference catalog、skill tool 与 skills-lock 共同构成技能加载面：`apps/zcode-cli/packages/bootstrap/src/skills.ts:1`、`apps/zcode-cli/packages/bootstrap/src/skill-command-overrides.ts:1`、`apps/zcode-cli/packages/bootstrap/src/zcode-protocol/skill-reference-catalog.ts:1`、`apps/zcode-cli/packages/contracts/src/tools/skill.ts:1`、`apps/zcode-cli/skills-lock.json:1`。
- 结论：journal-memory 提供工作流记忆入口：`apps/zcode-cli/packages/dynamic-workflow/src/engine/journal-memory.ts:1`。

## 6 长会话续跑与恢复（RQ-06）
- 结论：cold-session-resume 负责冷恢复协调，session resident pool/residency 管理常驻会话：`apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/cold-session-resume.ts:1`、`apps/zcode-cli/packages/bootstrap/src/zcode-protocol/session-resident-pool.ts:1`、`apps/zcode-cli/packages/bootstrap/src/zcode-protocol/session-residency.ts:1`。
- 结论：turn output token continuation 与 subagent context builder 支撑续跑/子代理：`apps/zcode-cli/packages/runtime/src/methods/turn-output-token-continuation.ts:1`、`apps/zcode-cli/packages/core/src/subagent/context-builder.ts:1`。

## 7 RQ-07 异同矩阵素材
| 维度 | ZCode 与其他四家关系 | 证据 |
|---|---|---|
| 组装 | 同样分层组装；ZCode 以 sections + runtime context 管理 | `apps/zcode-cli/packages/core/src/context/sections/request-user-context.ts:1` |
| token | 同样有 usage/limits；ZCode 独立 breakdown | `apps/zcode-cli/packages/runtime/src/methods/context-usage.ts:1` |
| 压缩 | 同有 compact；ZCode 另有 microcompact/preservation | `apps/zcode-cli/packages/runtime/src/methods/microcompact.ts:1` |
| 落盘 | 同有持久化；ZCode 明确 SQLite migrations + retention | `apps/zcode-cli/packages/adapters/src/storage/session-store/sqlite-session-store.ts:1` |
| 技能 | 同有 skill；ZCode 有 skills-lock/catalog | `apps/zcode-cli/packages/bootstrap/src/skills.ts:1` |
| 续跑 | 同有恢复；ZCode 有 cold resume/resident pool | `apps/zcode-cli/packages/bootstrap/src/zcode-protocol-v4/cold-session-resume.ts:1` |

## 8 谱系判定
- 有据承袭：本锚定材料暂未找到版权/依赖声明足以证明直接承袭；`NOTICE.md:1`、`THIRD-PARTY-NOTICES.md:1`。
- 仅形态相似：microcompact、post-reminders 与其他 harness 压缩概念形态相似，但仅凭命名不能判定来源：`apps/zcode-cli/packages/runtime/src/methods/microcompact.ts:1`。
- 无关：无证据把 ZCode 归为某家直接分支；`apps/zcode-cli/packages/adapters/src/model/opencode-session.ts:1` 仅证明存在兼容适配，不等于承袭。

## 9 与前次结论差量
- 判定：无继承基线。本轮新增 ZCode，所有结论均以本锚定 commit 为准：`apps/zcode-cli/packages/runtime/src/methods/compact.ts:1`。

## 10 未确认清单
- `apps/zcode-cli/packages/runtime/src/helpers/context-usage-breakdown.ts:1`：精确判压阈值未确认。
- `NOTICE.md:1`：未找到直接承袭声明，需进一步核读全文。
