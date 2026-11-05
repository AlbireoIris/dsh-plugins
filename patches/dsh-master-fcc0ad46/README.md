# DSH 本地侵入式修改补丁集 — master@fcc0ad46 基线（0.2.2-rc.1）

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 master 顶端基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（master@ce7073d 基线，自报 0.2.2-alpha.2）见 `../dsh-master-ce7073d/`。两版**不是增量关系**——中间隔了 **926 个提交**，补丁是在新基线上**重做**的。本轮**只剩一笔本地补丁**：能力 A（`spawn_teammate` 的 `model` / `reasoning_effort` 透传）因上游删除该工具而**退役**，不再重放。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159`（`Merge pull request #7873 from deepseek-harness/merge/release-dsh-0.2.2-rc.1-to-master`，2026-11-04 16:40:00 +0800）
- **对应上游版本**：基线树根 `package.json` 的 `version` 为 **`0.2.2-rc.1`**；构建戳自报同名版本。
- **基线认定依据**：
  1. `git log fcc0ad4621..master` 只有本地提交 `7c28adbd28` 一笔，基线即其父提交；
  2. 本地 master 相对 `origin/master` 恰好领先 1 个提交、落后 0 个，与上游无分叉；
  3. 构建戳 `DSH_CLIENT_COMMIT_HASH=7c28adb` 与本地提交一致（本轮先提交后构建，树是干净的）。
- **目录命名说明**：基线不是 tag，沿用惯例按提交 SHA 命名 `dsh-master-fcc0ad46`。

**适用性**：补丁可直接 `git am` 到基线 `fcc0ad4621`（本轮即在该基线上落地），通常也可 am 到其后一段时间内的上游提交；更晚的上游版本按文末「维护：在新上游版本上重放」处理。

### 本轮跨度

`ce7073d512..fcc0ad4621` = **926 个提交**。

## 补丁清单

### `0001-feat-ui-subagent.patch`

- **标题**：`feat(ui-subagent): 目录行按最新创建优先`
- **本地提交**：`7c28adbd28d23aad20a703ebe3bfa250e25fd41c`（作者 zhululin1 `<zhululin1@xiaomi.com>`，2026-11-05 17:29:23 +0800）
- **规模**：5 文件，+33 / −14
- **文件哈希**：sha256 `d7885b7a119cb6d7d944ccee3cea5c96c6b1ce03688bb66b601fb1229cc6f671`（16556 B）
- **承接**：上一版 `f9366a0a85` 中的能力 B；再往上是 `a24711a4d8`（22ddee37）、`6e80f60415`（rc.2）、`17bc6c1e0f`（alpha.4）、`9350ffe1d7`（alpha.2）、`80a85c5d0a`（0.2.0-rc.1）、`a1148836a3`（0.1.x）

#### 能力：子代理目录行按最新创建优先排序

会话头 lineage 下拉里的子代理目录行改为**最新创建排在最上**。实现只动呈现层：

```ts
// packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx
// The durable listing contract orders entries by creation time ascending
// (SubagentListEntry); the catalog presents that order reversed, so the
// newest child leads every level.
const rows = catalog.entries.toReversed()
```

渲染与 `reserveDisclosure` 都用 `rows`；service 侧 `catalog.ts` 的**创建升序契约原样不动**。键盘导航按 DOM 顺序遍历，反转后呈现与导航天然一致。

#### 涉及文件（5）

- `packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx`
- `packages/client/ui-subagent/tests/conversation-ui.client.spec.tsx`
- `packages/client/ui-subagent/README.md` / `README.zh.md` / `README.i18n.yaml`

#### 如何应用

`git am`（保留提交信息与作者），在 **deepseek-harness 仓库根目录**执行：

```sh
cd <deepseek-harness 检出>
git checkout fcc0ad4621   # 或包含该基线的分支
git am <本目录>/0001-feat-ui-subagent.patch
```

冲突时可用 `git apply -3` 先落地再手工解冲突。

#### 风险与冲突点

- **上游已动过这个文件**：`SubagentHeaderLineage.tsx` 在 0.2.2 里新增了 `entryName` / `completedEntry` / `catalogProgress` 等 helper，下一轮冲突概率继续升高。冲突时保留上游 helper，只把 `const rows = catalog.entries.toReversed()` 和渲染处的 `rows.map` 重新叠回去。
- **测试期望必须跟着改**：上游键盘导航测试假设创建升序（第一行是 worker）。反转后要改成 reviewer 优先——本轮 `it.each` 表被改成 `ArrowDown`/`Home → reviewer`、`ArrowUp`/`End → worker`，compact-catalog 用例的首行断言也一并改。**不改就是 5 个用例红。**
- README 三件套改动后**务必**重跑 `pnpm run verify-translation-pairing --write` 重录配对 hash。
- 上游那个独立遍历测试（约 line 770）本来就期望 reviewer 优先，无需改。

### ⚠️ 能力 A（`spawn_teammate` 模型透传）已退役

上一版的能力 A 给 `spawn_teammate` 加可选 `model` / `reasoning_effort`，三层透传：

1. `packages/experimental/tool-agent-team/src/index.ts`：工具入参新增可选 `model`、`reasoning_effort`；
2. `packages/experimental/agent-team/src/types.ts`：`SpawnTeammateRequest` 新增 `model?` / `reasoningEffort?`；
3. `packages/experimental/agent-team/src/roster.ts`：创建子代理时注入 `agentOptions`。

**0.2.2-rc.1 把整条链路删了**：

- `packages/experimental/agent-team` → `packages/team/agent-team`；
- `spawn_teammate` 工具、`TeamRoster`、`roster.ts` 一并删除；
- teammate 改由 subagent catalog 承载，按名字寻址、可续；
- `TeamService` 配置只剩 `maxTasks` / `defaultEnabled`，`maxMembers` / `maxMessageBytes` / `disposalTimeoutMs` 进 `REMOVED_CONFIG_KEYS` 直接抛 `TEAM_INVALID_CONFIG`。

**能力本身没丢**：现在给子代理指定模型/强度走 delegation 工具原生的 `modelSelectionSettings`（预设里 `tool-subagent` 已带 `modelSelectionSettings: true`），不需要本地补丁。本轮起该补丁**不再重放**，历史版本见 `../dsh-master-ce7073d/` 等目录。

## 本机预设迁移（auto-mode）

`~/.dsh/.agent-presets/auto-mode/agent.cordis.yml` 从 287 行降到 238 行，备份在 `/home/mi/ssd/tmp/dsh-preset-backup-20261105/agent.cordis.yml.bak`。改动：

1. **整段删除 Agent Teams**：`agent-team-service`（含 `maxMembers: 20000` / `maxTasks: 256` / `maxPendingMessagesPerMember` / `maxMessageBytes` / `disposalTimeoutMs`）与 `tool-agent-team`（含 `freshProvider` / `forkProvider`）连同注释块一起移除。
2. **启用 `tool-subagent-control`**：此前为了避开与 Agent Teams 的 `send_message` / `list_agents` / `interrupt_agent` 重名，它和它的 `list-agents` 子路径条目都是 `disabled: true`。Agent Teams 退场后它是唯一一份，必须启用。
3. **修正两条失效引用**（都是老版本遗留，不是本轮引入）：
   - 删除 `@deepseek-ai/dsh-tool-subagent-control/list-agents` 条目。该包 `exports` 只有 `.` / `./src/*` / `./package.json` / `./locale/*.json`，实测 `ERR_PACKAGE_PATH_NOT_EXPORTED`；`list_agents` 由主入口 `apply()` 里的 `registerListAgents(ctx)` 注册，主入口已覆盖。
   - `@deepseek-ai/dsh-workflow-worker-thread` → `@deepseek-ai/dsh-workflow-ptc`。上游把 workflow 编排迁进沙箱化 PTC 运行时（`35af8698c2`），worker-thread provider 包已不存在，实测 `ERR_MODULE_NOT_FOUND`；上游自带 preset（`packages/bundle/web-app/presets/*.patch.yml`）统一用 `workflow-ptc` + `provider: spawn`。

**静态校验**：预设 31 个条目、26 个唯一包名，在 workspace 389 个包里 **26/26 可解析**（含 `exports` 子路径检查与本地绝对路径文件存在性检查）。

## 0.2.2-rc.1 破坏性变更与本机核对

| 变更 | 要点 | 本机影响 |
|---|---|---|
| Agent Teams 重构 | 目录搬到 `packages/team/`，`spawn_teammate` / `TeamRoster` 删除，messaging 归 `tool-subagent-control` | 补丁①退役；预设删 Team 段并启用 `tool-subagent-control` |
| `TeamService` 配置收窄 | 三个 key 进 `REMOVED_CONFIG_KEYS`，出现即 `TEAM_INVALID_CONFIG` | 预设里这些 key 已随 Team 段整段删除 |
| Workflow → PTC runtime | `dsh-workflow-worker-thread` 包消失 | 预设改 `dsh-workflow-ptc` |
| `tool-subagent-control` 不再导出 `list-agents` 子路径 | 工具全在主入口 | 预设删该条目 |
| Schedule 存储 | `name: 'schedule', version: 2, compatibleVersions: [1]` | **与 alpha.2 相同，无需迁移**；本机 `~/.dsh/storages/schedule.json` 已是 v2（1.18 MB，mtime 11-05 16:58），旧备份 `schedule.json.v1-backup` 保留 |

**插件侧**：`~/.dsh/profiles/web/node_modules/@deepseek-ai/` 下 **13 条 symlink，13/13 `package.json` 可读**。重启后两个 stdio MCP 都由新 dsh 拉起：`gerrit-mcp`（pid 416549）、`feishu-mcp-pro`（pid 416841→417175→417176）；两个 `mcp-http-bridge`（416560 / 416569）也正常。其余 MCP 是 streamable-http，无本地进程。

## 验证（2026-11-05 已跑通）

- **隔离 worktree**：`/home/mi/ssd/dsh-rc1-build`（补丁、构建、测试都在这里先跑，全程不碰运行中的 dsh）
- `pnpm install`：干净通过
- `pnpm run build`：**10 gates 全过**，记录 **369** 个 client artifact。另有一次主仓库构建记录 367（clean 残留差异），以最终构建戳为准。
- 构建戳 `.dsh-build/client-build-environment.json`：
  - `DSH_CLIENT_COMMIT_HASH=7c28adb`、`DSH_CLIENT_VERSION=0.2.2-rc.1`
  - `fileCount=369`，`sha256=56aaa85484152d9ad272109396acf1b3a8ec66af3300af1c087a5d76f64e5b03`
  - 树是干净的（无 `GIT_DIRTY` 标记）——仓库根那三个垃圾文件（`out/`、`gfxinfo_investigation_report.md`、`cmp_lapis_b.log`）已删
- 全量测试：`npx vitest run` → **18 文件 / 465 用例全过**（4.09s）
- 服务健康矩阵（新进程 pid **416466**）：
  - 3080 监听；无 token `401`；带 token `303` → 取 cookie 后 `200` + `text/html` 43456 B，HTML 含 `0.2.2-rc.1`
  - 启动日志无 `ERR_MODULE_NOT_FOUND` / `Cannot find` / `Failed to load`
  - `api.deepseek.com` 模型列表不可达（用内置 catalog），非致命，与上版一致
- 看板：8090 / 8092 / 8093 / 8094 / 8095 全 **HTTP 200**（独立 systemd user unit，不受 dsh 重启影响）

### 产物校验点（下次快速核对，行号可能随上游漂移）

- `packages/client/ui-subagent/lib/client.js` → 全文件 `toReversed` **仅 1 处**（`catalog.entries.toReversed()`）

## 重启

用 `~/tools/dsh-restart.sh`（v3），从 dsh 会话**外部**执行。本轮结果：

- 阶段1 停：闭包 10 个 PID 全属旧 dsh 树；断言①（本会话 MCP 不在闭包）与断言②（闭包内每个 PID 祖先链含旧 dsh）均通过；3080 释放，5 个看板全程在听
- 阶段2 起：`start_dsh.sh` 拉起 pid 416466，就绪
- 阶段4 健康判据：4 条全过

> **教训（沿用上一版）**：永远不要从 dsh 会话内部安排它的重启。`setsid` + `nohup` 脱不出 cgroup，旧 dsh 一退整棵树被一起拆掉。

## 遗留风险

1. **预设只做了静态校验**：26/26 包名可解析、`exports` 子路径都核过，但没有真正以该预设开一次会话。真正生效要等下次进 auto-mode 时验证（尤其 `workflow-ptc` 在 `isolate.workflowEngine` 域里的行为）。
2. **补丁能力只验到产物层**：`toReversed` 只在构建产物里确认了一处，没在 Web UI 里肉眼确认「最新在最上」。客户端插件/呈现类改动的静态验证有假阳性先例（见 `reference_dsh_plugin_shadow_verification`）。
3. **`api.deepseek.com` 不可达**：模型清单用内置 catalog，可能不是最新。
4. **13/13 插件只证明模块可读**：`dsh-client-*` 插件真正生效仍需 Web UI 操作验证。
5. **worktree 已清理**：`/home/mi/ssd/dsh-rc1-build` 已于 2026-11-05 用 `git worktree remove` 删除（删除前确认 HEAD 与主仓库一致、无未提交/未跟踪文件，释放 2.6 GB）。

## 维护：在新上游版本上重放

1. 备份当前 `schedule.json` 与 auto-mode 预设。
2. 在新上游基线上开隔离 worktree，`git am`（或 `git apply -3`）本目录的 patch。
3. 冲突集中在 `SubagentHeaderLineage.tsx` 与 `conversation-ui.client.spec.tsx`：保留上游新增 helper，重新叠 `rows = catalog.entries.toReversed()`；测试期望改成「最新优先」。
4. 跑 `pnpm run verify-translation-pairing --write` 重录 README 三件套 hash。
5. `pnpm install` → `pnpm run build`（10 gates）→ `npx vitest run`。
6. 核对该版本是否又有 `packages/experimental/*` 空壳目录残留（tsdown 会报 `Cannot find entry`，先 `rm -rf`）。
7. 从 dsh 会话外部执行 `~/tools/dsh-restart.sh`，跑健康矩阵。
