# session-clear

`/clear` 命令（Claude Code 风格）：只保留会话最近的 N 轮对话（默认 10 轮），
更早的历史从**持久会话日志**中截断（含备份），命令自动出现在 `/` 命令菜单。

## 用法

输入框输入 `/clear` 回车即可（命令菜单里也会看到）。可选参数暂不支持，
保留轮数由配置项控制：

```yaml
- id: session-clear
  name: '@deepseek-ai/dsh-session-clear'
  inject: [commands]
  config:
    keepTurns: 10        # 保留最近几轮（1-50，默认 10）
    logRoot: 'C:\Users\Iris\.dsh\sessions'
```

## 工作原理

- 通过官方命令注册表（`ctx.commands.register`）定义 `/clear`，UI 自动发现
- 处理时：`scanLog` 解码该会话的 zstd JSONL 日志 → 按 `turn/start` 边界
  定位最近 N 轮 → 同一 header + 事件重编码（单帧 zstd）→ **先校验暂存文件**
  （事件数一致）→ 原子替换（原文件留 `.clear-bak` 备份）
- 校验失败则中止，原文件不动；轮数已少于上限时提示无需清理

## 注意

- 截断的是持久日志（重启/复现/后续轮次都从截断后开始）；当前进程内的上下文不
  会被立刻丢弃——要彻底生效可在 `/clear` 后重启会话/刷新页面。
- 备份文件 `session.jsonl.zstd.clear-bak` 保留在会话目录（下次 `/clear` 前
  手动删除即可；也可随时从备份恢复）。
