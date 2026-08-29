# restart-harness

「重启」按钮：一键重启 dsh web 服务。按钮显示在对话标题栏（对话历史导出按钮右侧），
点击后服务真实重启（按 PID 杀当前进程 → 重新拉起启动脚本），成功后页面自动刷新；
按钮状态如实反映每个阶段，失败时显示原因并解锁重试。

## 功能与状态

点击后按钮依次显示（判断依据是宿主进程真实身份 bootId 的变化，不是猜测）：

| 状态 | 含义 |
|---|---|
| 正在发起重启… | 请求已发出 |
| 重启准备中… | 宿主已受理 |
| 服务已停止，正在重新启动… | 旧服务已终止，等待新进程 |
| 重启成功，页面即将自动刷新… | bootId 已变化 = 重启真的发生，随后页面自动刷新 |
| 重启未生效，请重试 | 60 秒内 bootId 未变（杀进程或拉起失败），按钮解锁可重试 |
| 请求失败，请重试 | POST 本身失败，按钮解锁 |
| 重启已经在进行中，请稍候 | 另一标签页已触发，保持锁定等待 |

服务重启期间按 PID 杀进程、杀后执行配置的启动脚本。辅助进程为脱离的 wscript+VBS，
跑完即退，无常驻进程。

## 配置（cordis.yml 行内 config，均可选）

```yaml
- id: restart-harness
  name: '@deepseek-ai/dsh-client-restart-harness'
  inject: [webServer]
  config:
    # 日志文件（宿主事件与辅助进程每一步都写这里）
    logFile: 'C:\Users\<you>\AppData\Local\Temp\dsh-restart\restart-harness.log'
    # 杀进程后执行的启动脚本（默认 ~/.dsh/bin/start-dsh-web.ps1）
    launcherScript: 'C:\Users\<you>\.dsh\bin\start-dsh-web.ps1'
    # 200 响应到杀进程的延迟（毫秒，默认 800）
    killDelayMs: 800
    # 杀进程到执行启动脚本的延迟（毫秒，默认 1000）
    relaunchDelayMs: 1000
```

## 工作原理

- `POST /dsh/restart-harness`：先回 200，再派生**脱离**的 wscript+VBS 辅助进程；
  VBS 睡 `killDelayMs` → PowerShell `Stop-Process` 终止本进程 → 等待
  `relaunchDelayMs` → 执行 `launcherScript` → 脚本结束自动退出。
- `GET /dsh-health`：返回本进程唯一的 `bootId`。浏览器端轮询，bootId 一变即
  判定重启成功并刷新页面；60 秒不变则判定失败。
- 为什么用 wscript+VBS（实测结论）：在一台 Windows 机器上，宿主进程直接派的
  **脱离的控制台子进程**（node/powershell/cmd）会"启动即退出、一行不执行"，
  而 GUI 子系统的 wscript.exe 可完全执行——该机器的开机自启也走
  wscript→powershell→ps1 链。因此保留社区重启流程（先应答、按 PID 杀、原样拉起），
  仅载体换成本机已验证的 wscript/VBS。

## 安装

见仓库根 README「安装插件到 dsh web」。

## 日志

- 宿主/辅助进程事件：`logFile`（默认 `%TEMP%/dsh-restart/restart-harness.log`）
- 服务启动记录：启动脚本自身的输出（如 `tmp/boot.log`）

排查顺序：点一次重启 → 看日志里是否有 `helper: started` → `helper: kill issued` →
启动脚本是否执行 → 新进程是否出现。
