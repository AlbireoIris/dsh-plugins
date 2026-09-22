# 研究简报：四套 Coding Agent 的上下文管理与压缩

## 研究问题

DeepSeek Harness（dsh）、MiMo-Code、OpenCode、Codex CLI 这四个开源 coding agent，分别是怎样：

1. 组装发给模型的上下文（system prompt、AGENTS.md、工具结果、历史消息）
2. 算 token / 判断上下文快满了
3. 压缩 / 淘汰 / 摘要历史，让对话能继续
4. 持久化会话（磁盘格式、恢复）

## 范围边界

**纳入**
- 会话消息队列结构
- token 预算与阈值
- compact / summarize / trim / drop 机制
- 工具输出截断
- 记忆（memory / AGENTS.md / notes）是否参与压缩
- 会话落盘与恢复

**排除**
- 模型本身的 attention / 推理优化
- UI 展示层
- 定价与计费

## 假设

- 源码为准（本地 clone，2026-09-17）
- 仓库路径：
  - dsh: `H:\deepseek-harness`
  - mimo: `H:\MiMo-Code`
  - opencode: `H:\opencode`
  - codex: `H:\codex`
- 深度：standard（4 个并行子任务，1 轮补查）

## Angles（研究角度）

1. **F1 — dsh**：deepseek-harness 的 session / context / compact 实现
2. **F2 — mimo**：MiMo-Code 的 memory / session / compact 实现
3. **F3 — opencode**：opencode 的 message / context / summarize 实现
4. **F4 — codex**：codex 的 conversation / compact / token budget 实现
5. **F5 — 横向对比**（我汇总时写）：四者机制对照表 + 示意图

## 读者画像

- 有轻度阅读障碍倾向：短段落、要点清晰、多图少墙
- 需要「先看懂结论，再看细节」的结构
- 报告语言：中文
- 格式：Markdown + mermaid 示意图（必要时 HTML）
