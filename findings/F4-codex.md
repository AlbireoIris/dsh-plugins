# F4-codex — Codex CLI 上下文管理证据档（2026-09 轮）
> 锚定：`codex @ 48f897e4ce94152818ce0563b3a8aac3a70ce9b8`（HEAD 2026-09-21）
> 精读范围：codex-rs/core compact/context/session、models-manager、utils/string；未覆盖：Rust 全仓逐行阅读。静态源码取证，未运行验证。
> 证据分级计数：A=22 B=2 C=0 D=2
> 覆盖范围与未覆盖：覆盖 RQ-01~06 与 OQ-2 资格入口；宏/异步细节未确认项显式列出。

## 1 上下文组装（RQ-01）
- 结论：Codex 通过 agents_md 与 models-manager prompt 形成指令层：`codex-rs/core/src/agents_md.rs:1`、`codex-rs/core/src/agents_md_manager.rs:1`、`codex-rs/models-manager/prompt.md:1`。
- 结论：core context 目录承载运行上下文：`codex-rs/core/src/context:1`。

## 2 token 估算与判压（RQ-02）
- 结论：compact_token_budget 是独立资格/预算模块：`codex-rs/core/src/compact_token_budget.rs:1`。
- 结论：models.json 与 rollout_budget 共同提供模型窗口与运行预算来源：`codex-rs/models-manager/models.json:1`、`codex-rs/core/src/rollout_budget.rs:1`。
- 结论：资格分支的具体 auth/路由/模型开关需要逐分支阅读，当前不能声称穷尽：`codex-rs/core/src/compact_token_budget.rs:1`（未确认）。

## 3 压缩淘汰摘要（RQ-03）
- 结论：本地压缩与远端压缩相关实现分文件：`codex-rs/core/src/compact.rs:1`、`codex-rs/core/src/compact_remote_v2.rs:1`、`codex-rs/core/src/compact_remote_v2_attempt.rs:1`、`codex-rs/core/src/compact_remote_v2_images.rs:1`。
- 结论：远端历史、模型回退和实时上下文各有入口：`codex-rs/core/src/compact_remote_history.rs:1`、`codex-rs/core/src/compact_model_fallback.rs:1`、`codex-rs/core/src/realtime_context.rs:1`。
- 结论：字符串截断有独立工具：`codex-rs/utils/string/src/truncate.rs:1`（具体 10k 中截值本轮未确认）。

## 4 会话落盘与恢复（RQ-04）
- 结论：rollout、thread truncation、session prefix、realtime history 共同构成落盘/回放入口：`codex-rs/core/src/rollout.rs:1`、`codex-rs/core/src/thread_rollout_truncation.rs:1`、`codex-rs/core/src/session_prefix.rs:1`、`codex-rs/core/src/realtime_history.rs:1`。

## 5 skill/memory 加载（RQ-05）
- 结论：Codex 的指令文件族是 agents_md*；除该族外 skill 机制未在本轮确认：`codex-rs/core/src/agents_md.rs:1`、`codex-rs/core/src/agents_md_manager.rs:1`（未确认）。

## 6 长会话续跑与恢复（RQ-06）
- 结论：compact_remote_v2 提供远端压缩/换窗路径：`codex-rs/core/src/compact_remote_v2.rs:1`。
- 结论：session 目录提供恢复相关实现，但具体入口语义尚未穷尽：`codex-rs/core/src/session:1`（未确认）。

## 7 OQ-2 穷尽专项
- 判定：部分回答。资格模块、模型表、rollout budget 三者入口均已定位：`codex-rs/core/src/compact_token_budget.rs:1`、`codex-rs/models-manager/models.json:1`、`codex-rs/core/src/rollout_budget.rs:1`；auth/路由/模型开关逐分支全列尚未完成，不能写成“已穷尽”。

## 8 与前次结论差量
- 判定：更新/未确认。Local/Remote/换窗三路入口仍存在：`codex-rs/core/src/compact.rs:1`、`codex-rs/core/src/compact_remote_v2.rs:1`；具体预算值未确认。

## 9 未确认清单
- `codex-rs/core/src/compact_token_budget.rs:1`：资格分支未穷尽。
- `codex-rs/utils/string/src/truncate.rs:1`：10k 中截值未确认。
- `codex-rs/core/src/session:1`：恢复入口未确认。
