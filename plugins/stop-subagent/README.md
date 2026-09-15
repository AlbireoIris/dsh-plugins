# stop-subagent

`stop_subagent` 工具插件：对后台子代理的强停止。`graceful` 中断其当前模型轮次并保留排队工作；`force` 在此之上对调用方显式给出的进程组（`pgids`）升级 SIGTERM→grace→SIGKILL，用于收割卡在外部、忽略信号的进程里的工具调用。

## 为什么是插件

旧版 `tool-subagent-stop` 依赖 harness 仓库本地补丁提供的 `ctx.subagents.processGroupsOf(target)`，上游没有该 API，随 sync 丢失。本插件去掉服务侧反查，改为调用方显式传 `pgids`；同时零 harness 运行时导入（类型全部 type-only，本地 vendor 声明），构建产物 `lib/index.js` 自包含，不随 harness 仓库 sync 丢失。

## 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `subagent_id` | string | 是 | 后台子代理 id |
| `mode` | `graceful` \| `force` | 是 | graceful 只中断模型轮次；force 追加强杀进程组 |
| `grace_ms` | number | 否 | force 模式 SIGTERM 后等待毫秒数，默认 2000，上限 30000 |
| `pgids` | array | force 必传 | 进程组列表，元素 `{ pid, started? }`；`pid` 为进程组 id（信号目标是 `-pid`），`started` 为可选的 /proc starttime 围栏值，缺省由工具在发信号前自行捕获 |

安全设计：

- 只对 `-pid` 进程组发信号，绝不触碰 DSH host pid 或其他 worker 的组
- 每次发信号前用 `/proc/<pid>/stat` starttime 围栏校验 PID 是否被重用，不一致直接跳过（`staleGroups` 计数）
- 非 Linux 平台读不到 starttime 时仍照发信号
- `interrupt` 走上游 `{ kind: 'ancestor', agent: exec.agent }` 授权，lineage 校验由服务侧完成

## 挂载方式

在 agent preset 的 cordis.yml 行分组里追加：

```yaml
- id: tool-stop-subagent
  name: /home/mi/ssd/task_dsh-plugins/dsh-plugins/plugins/stop-subagent/lib/index.js
```

工具名与 agent-team 的 `interrupt_agent` / `send_message` 刻意不同名，可共存于同一 composition。

## 构建

```sh
pnpm install --ignore-scripts
pnpm --filter @deepseek-ai/dsh-tool-stop-subagent run build
```
