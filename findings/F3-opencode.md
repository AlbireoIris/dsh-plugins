# F3-opencode — OpenCode 上下文管理证据档（2026-09 轮）
> 锚定：`opencode @ 70a24697ea0028e19f22712fd63059538cb4bee7`（HEAD 2026-09-21）
> 精读范围：packages/opencode/src/session、packages/core/src/session；未覆盖：全仓逐行阅读。静态源码取证，未运行验证。
> 证据分级计数：A=20 B=2 C=0 D=1
> 覆盖范围与未覆盖：覆盖 RQ-01~06 与 OQ-1 双 session 树入口；未覆盖处明确未确认。

## 1 上下文组装（RQ-01）
- 结论：opencode session 有 system/instruction/prompt 分层：`packages/opencode/src/session/system.ts:1`、`packages/opencode/src/session/instruction.ts:1`、`packages/opencode/src/session/prompt.ts:1`。
- 结论：core 侧也有 prompt 入口，形成双树接口：`packages/core/src/session/prompt.ts:1`。

## 2 token 估算与判压（RQ-02）
- 结论：overflow 模块依赖 Config、ProviderTransform，并负责超限路径入口：`packages/opencode/src/session/overflow.ts:1`。
- 结论：前次 20k buffer 本轮未逐分支重核，标未确认：`packages/opencode/src/session/overflow.ts:1`（未确认具体 buffer 值）。

## 3 压缩淘汰摘要（RQ-03）
- 结论：opencode 侧 compaction、summary、reminders、overflow 分工明确：`packages/opencode/src/session/compaction.ts:1`、`packages/opencode/src/session/summary.ts:1`、`packages/opencode/src/session/reminders.ts:1`、`packages/opencode/src/session/overflow.ts:1`。
- 结论：core 侧 compaction 与 context epoch 共同存在：`packages/core/src/session/compaction.ts:1`、`packages/core/src/session/context-epoch.ts:1`。

## 4 会话落盘与恢复（RQ-04）
- 结论：core session 提供 store/sql/history/projector/message-updater 多层持久化入口：`packages/core/src/session/store.ts:1`、`packages/core/src/session/sql.ts:1`、`packages/core/src/session/history.ts:1`、`packages/core/src/session/projector.ts:1`、`packages/core/src/session/message-updater.ts:1`。
- 结论：opencode 侧 revert/run-state/schema 负责恢复相关状态：`packages/opencode/src/session/revert.ts:1`、`packages/opencode/src/session/run-state.ts:1`、`packages/opencode/src/session/schema.ts:1`。

## 5 skill/memory 加载（RQ-05）
- 结论：本轮在主 session 入口未确认专门 skill/memory 服务；必须继续关键词定位，不能写成不存在：`packages/opencode/src/session/prompt.ts:1`（未检索到主入口定义）。

## 6 长会话续跑与恢复（RQ-06）
- 结论：context epoch、run coordinator、execution、runner 共同构成长会话运行路径：`packages/core/src/session/context-epoch.ts:1`、`packages/core/src/session/run-coordinator.ts:1`、`packages/core/src/session/execution:1`、`packages/core/src/session/runner:1`。

## 7 与前次结论差量
- 判定：更新——双树并存可核对，但哪棵是生产默认入口需追 import 链，本档暂标未确认：`packages/core/src/session/prompt.ts:1`、`packages/opencode/src/session/prompt.ts:1`。

## 8 未确认清单
- `packages/opencode/src/session/overflow.ts:1`：20k buffer 未确认。
- `packages/core/src/session/prompt.ts:1`：生产默认路径未确认。
- `packages/opencode/src/session/prompt.ts:1`：skill/memory 入口未确认。
