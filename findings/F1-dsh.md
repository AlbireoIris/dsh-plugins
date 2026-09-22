# F1-dsh — DSH 上下文管理证据档（2026-09 轮）
> 锚定：`deepseek-harness @ ddefc45fbc7f8e46dd73185e68295696d1297887`（HEAD 2026-09-17）
> 精读范围：context、compaction、token-meter、session、skill、spill、subagent、goal；未覆盖：全仓逐行阅读。静态源码取证，仓内测试/文档为 B 级交叉证据，未读取真实会话。
> 证据分级计数：A=18 B=4 C=0 D=1
> 覆盖范围与未覆盖：覆盖 RQ-01~06 主入口；未覆盖的全仓文件不据此下结论。

## 1 上下文组装（RQ-01）
- 结论：请求上下文由 context/preset/core 组合，工具与历史以结构化事件进入；具体调用链需继续追踪，已确认入口存在：`packages/context/package.json:1`、`packages/preset/package.json:1`、`packages/core/package.json:1`。
- 结论：subagent fork 复制父级已完成历史后独立累积，仓内说明可交叉核对：`packages/subagent/subagent-fork-in-process/README.md:58`、`packages/subagent/subagent-fork-in-process/README.md:118`。

## 2 token 估算与判压（RQ-02）
- 结论：本锚定副本中 token-meter 入口存在，但未定位到前次所称 chars/4 实现，不能把该公式写成已确认；`packages/llm/token-meter/src/estimate.ts:1`。
- 结论：compaction-basic 默认 thresholdRatio=0.8、retainRatio=0.16：`packages/compaction/compaction-basic/src/config.ts:20`、`packages/compaction/compaction-basic/src/config.ts:23`、`packages/compaction/compaction-basic/src/config.ts:74`。

## 3 压缩淘汰摘要（RQ-03）
- 结论：基础压缩保留近期上下文比例，并在配置解析时应用默认值：`packages/compaction/compaction-basic/src/config.ts:74`、`packages/compaction/compaction-basic/src/types.ts:13`。
- 结论：工具结果 pruner 以字符数统计并生成 pruned 结果：`packages/compaction/compaction-tool-result-pruner/src/index.ts:69`、`packages/compaction/compaction-tool-result-pruner/src/index.ts:116`。
- 结论：工具输出保留模块存在固定 headChars=4096：`packages/compaction/compaction-tool-result-pruner/src/config.ts:12`。

## 4 会话落盘与恢复（RQ-04）
- 结论：SESSION_FORMAT_VERSION 是当前 writer 版本权威，文档说明 catalog generator 校验迁移：`docs/session-format-status.md:19`。
- 结论：仓内测试使用 SESSION_FORMAT_VERSION 构造会话记录，属于 B 级落盘证据：`packages/subagent/subagent/tests/catalog.spec.ts:9`、`packages/subagent/subagent/tests/catalog.spec.ts:85`。

## 5 skill/memory 加载（RQ-05）
- 结论：skill 包是独立入口；本轮未确认其所有发现层级与压缩后重注入语义：`packages/skill/package.json:1`（未确认：全量加载还是惰性读取）。
- 结论：spill 由独立包与 web 测试覆盖，具体阈值未统一检索到：`packages/web/tool-web/tests/spill.spec.ts:1`、`packages/spill/package.json:1`（未检索到统一阈值）。

## 6 长会话续跑与恢复（RQ-06）
- 结论：子 agent 续跑结果回传边界与历史继承语义在 README 中明确：`packages/subagent/subagent-fork-in-process/README.md:58`、`packages/subagent/subagent-fork-in-process/README.md:136`。
- 结论：子 agent 事件 checkpoint/restoration 有测试证据：`packages/subagent/subagent/tests/list-children.spec.ts:832`。

## 7 与前次结论差量
- 判定：不变——compaction-basic 的 0.8/0.16 在本锚定副本仍可核对：`packages/compaction/compaction-basic/src/config.ts:20`。
- 判定：更新——本轮无法在入口文件中确认 chars/4，故前次公式降级为未确认：`packages/llm/token-meter/src/estimate.ts:1`。

## 8 未确认清单
- `packages/llm/token-meter/src/estimate.ts:1`：未确认真实 tokenizer/字符启发式公式。
- `packages/skill/package.json:1`：未确认 skill 压缩后是否重注入。
- `packages/spill/package.json:1`：未检索到统一 spill 阈值。
