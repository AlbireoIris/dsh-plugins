# session-clear

`/clear` 命令（Claude Code 风格）：把会话里最近 N 轮（默认 10 轮）**之外**的
旧对话折叠成一条清理标记，模型上下文立刻变小、继续对话不受影响，命令自动
出现在 `/` 命令菜单。

## 用法

输入框输入 `/clear` 回车即可（命令菜单里也会看到）。可选参数暂不支持，
保留轮数由配置项控制：

```yaml
- id: session-clear
  name: '@deepseek-ai/dsh-session-clear'
  inject: [commands, tokenMeter, sessions]
  config:
    keepTurns: 10        # 保留最近几轮（1-50，默认 10）
```

## 工作原理

- 通过官方命令注册表（`ctx.commands.register`）定义 `/clear`，UI 自动发现
- 走 harness 官方的 compaction 表面事务：`compaction/start` →
  `compaction/summary` → 检查点 `user/message`（`surfaceOp: replace` 替换旧范围）
  → `compaction/end`，持久日志保持 append-only、连续无断档
- 边界按 **turn 序号** 在表面节点上定位（compaction 检查点会让可见 seq 非单调，
  不能按数值比较）；范围两侧要求工具调用对平衡，否则中止并保留原会话
- 检查点用**确定性摘要**（"此前对话已通过 /clear 清理"），不调 LLM、即时完成；
  更早的历史不在日志中删除，但模型上下文从检查点之后开始

## 注意

- 只影响模型上下文（surface），持久日志保持不变——这是官方 compaction 的
  语义，绝不损坏会话文件；如需彻底删除日志旧内容，可用会话导出/备份后另行处理
- 会话正忙（已有折叠任务在进行）或旧历史边界与工具调用对不平衡时会中止，
  稍后重试即可
