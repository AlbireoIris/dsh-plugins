# DSH 本地侵入式修改补丁集 — master@ce7073d 基线（0.2.2-alpha.2）

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 master 顶端基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（master@22ddee37 基线，自报 0.2.1-rc.3）见 `../dsh-master-22ddee37/`。两版**不是增量关系**——中间隔了 **988 个提交**，补丁是在新基线上**重做**的。本轮两笔能力被合并进了**一个本地提交**（升级会话一次性提交），因此本目录只有一个 `.patch` 文件。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`ce7073d51254c26cd63b22a60835b8f948deb447`（`Merge pull request #7552 from deepseek-harness/fix/webworker-live-import-bindings`，2026-10-30 00:13:15 +0800）
- **对应上游版本**：基线树根 `package.json` 的 `version` 为 **`0.2.2-alpha.2`**；构建戳自报同名版本。
- **基线认定依据**：
  1. `git log ce7073d512..master` 只有本地提交 `f9366a0a85` 一笔，基线即其父提交；
  2. 本地 master 相对 `origin/master` 恰好领先 1 个提交，与上游无分叉；
  3. 构建戳 `DSH_CLIENT_COMMIT_HASH=ce7073d` 与基线短哈希一致（构建发生在提交之前，见「验证」）。
- **目录命名说明**：基线不是 tag，沿用上一轮惯例按提交 SHA 命名 `dsh-master-ce7073d`，避免与任何官方 tag 混淆。

**适用性**：补丁可直接 `git am` 到基线 `ce7073d512`（本轮即在该基线上落地），通常也可 am 到其后一段时间内的上游提交；更晚的上游版本按文末「维护：在新上游版本上重放」处理。

### 本轮跨度与兼容性（事后核对）

- **跨度**：`22ddee3792..ce7073d512` = **988 个提交**。
- **补丁触碰面在上游的改动**：四个源码文件与上一轮相比，上游均无改动（本轮重放零冲突）；测试文件 hunk 偏移 **+2**（`276→278`、`317→319`、`1034→1036`，由上游在该文件新增 2 行引起）。
- **代码逐字一致（已复核）**：把本轮提交的 diff body 与上一轮两笔提交分别归一化比对（去掉 `index` 行与 `@@` hunk 头），四个源码文件、两个包的 README 三件套、测试文件均**逐字一致**。差异只有 blob index 哈希与上述 hunk 偏移。
- **语义安全性**：基线自身的 `CatalogRows` 仍直接迭代 `catalog.entries`（无排序反转），反转只有我们这一份；构建产物 `ui-subagent/lib/client.js` 全文件 `toReversed` **仅 1 处**（第 179 行），不存在双重反转。

## 补丁清单

### `0001-feat-agent-team-spawn-model-and-web-master-ce7073d.patch`

- **标题**：`feat: 恢复本地补丁并适配 0.2.2-alpha.2 基线`
- **本轮提交**：`f9366a0a85f4e069da01dc56ff2c8e7ab57e2acf`（作者 zhululin1 `<zhululin1@xiaomi.com>`，2026-11-02 10:06:49 +0800）
- **规模**：11 文件，+67 / −15
- **文件哈希**：sha256 `c2b11a4939036f837e7052afa4b7dc11859d64b218955bb806481f29275f4d8e`（19012 B）
- **承接**：
  - 能力 A（agent-team）：上一轮 `02e1353301`，再往上是 `bc7752bbec`（rc.2）、`a7dc1cf236`（alpha.4）、`72a0787be6`（alpha.2）、`466851f7e4`（0.2.0-rc.1）、`69f0612d5b`（0.1.2）
  - 能力 B（web 目录排序）：上一轮 `a24711a4d8`，再往上是 `6e80f60415`（rc.2）、`17bc6c1e0f`（alpha.4）、`9350ffe1d7`（alpha.2）、`80a85c5d0a`（0.2.0-rc.1）、`a1148836a3`（0.1.x）

#### 能力 A：`spawn_teammate` 支持可选 `model` / `reasoning_effort`

让 Agent Teams 的 `spawn_teammate` 支持为单个子代理指定模型与推理强度。三层透传：

1. `packages/experimental/tool-agent-team/src/index.ts`：工具入参新增可选 `model`、`reasoning_effort`，执行时仅在调用方给出时才写入请求字段（`reasoning_effort → reasoningEffort` 映射，类型断言 `ReasoningEffortId`）。
2. `packages/experimental/agent-team/src/types.ts`：`SpawnTeammateRequest` 新增 `model?: string` 与 `reasoningEffort?: ReasoningEffortId`。
3. `packages/experimental/agent-team/src/roster.ts`：创建子代理时注入 `agentOptions`，两值均省略时保持上游原行为（`resolveChildAgentOptions` 继承 Team Lead 路由）。

#### 能力 B：子代理目录行按最新创建优先排序

会话头 lineage 下拉里的子代理目录行改为**最新创建排在最上**。实现只动呈现层：`packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx` 里 `const rows = catalog.entries.toReversed()`，渲染与 `reserveDisclosure` 都用 `rows`；service 侧 `catalog.ts` 的**创建升序契约原样不动**。键盘导航按 DOM 顺序遍历，反转后呈现与导航天然一致。

#### 涉及文件（11）

- `packages/experimental/tool-agent-team/src/index.ts` / `README.md` / `README.zh.md` / `README.i18n.yaml`
- `packages/experimental/agent-team/src/types.ts` / `src/roster.ts`
- `packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx`
- `packages/client/ui-subagent/tests/conversation-ui.client.spec.tsx`
- `packages/client/ui-subagent/README.md` / `README.zh.md` / `README.i18n.yaml`

#### 如何应用

`git am`（保留提交信息与作者），在 **deepseek-harness 仓库根目录**执行：

```sh
cd <deepseek-harness 检出>
git checkout ce7073d512   # 或包含该基线的分支
git am <本目录>/0001-feat-agent-team-spawn-model-and-web-master-ce7073d.patch
```

冲突时可用 `git apply -3` 先落地再手工解冲突（本轮升级会话即 `git apply -3` 后提交）。

#### 风险与冲突点

- 最大冲突面仍是 `tool-agent-team/src/index.ts` 的 `execute`：上游继续演进该函数结构时此 hunk 必冲突，需按新结构重新叠加透传字段。本轮该处上游未动。
- **`agentOptions` 的能力门是「存在即要求」**：`packages/subagent/subagent/src/index.ts` 的门条件为 `{ when: request.agentOptions !== undefined, cap: 'agentOptions' }`——触发条件是**字段是否存在**，不是**是否有内容**。因此「只在调用方指名路由时才写入对应字段」是刻意写法，不要"优化"成无条件写入。两个默认 provider（`subagent-spawn-in-process`、`subagent-fork-in-process`）当前都声明了该能力。
- `agent-team/src/types.ts` 的 `ReasoningEffortId` **必须从 `@deepseek-ai/dsh-llm` 直接导入**（定义在 `packages/llm/llm/src/brand.ts`），经 `dsh-agent` 主入口导入会把 host 侧 `Session` service 声明拉进 Client 编译程序，连锁破坏 `mount.ts`。
- `roster.ts` 的 `agentOptions` 字面量插在 `request.prompt/parent` 与 `signal` 之间；上游重排 spawn 调用参数时需手工合入。
- README 三件套改动后**务必**重跑 `pnpm run verify-translation-pairing --write` 重录配对 hash（本轮 i18n hash 已更新）。
- ⚠️ 本笔（能力 A）**不含单测与 Agent Note**；本轮测试文件的改动属于能力 B。
- ⚠️ 本轮**两笔能力合并在一个提交里**：`git format-patch` 只能出一个文件；如果下一轮希望恢复成两笔独立提交，按两个能力分别 `git add` 后提交即可，代码本身无需改动。

### ⚠️ 能力 B 与插件 `subagent-newest-first` 互斥（保持退役）

`plugins/subagent-newest-first`（`@deepseek-ai/dsh-client-subagent-newest-first`）意图与本补丁一致，但**两者不能共存**（它 `priority: -1` 全量 shadow 单值槽位 `conversation.session.header.lineage`，且编译在 0.1.x API 上，开会话即抛 TypeError）。该插件自 2026-09-29 起已从 `~/.dsh/profiles/web/cordis.patch.yml` 退役，本轮复核：配置里**只有一条退役说明注释**（第 120 行），**无任何活跃条目**。

## 0.2.2-alpha.2 破坏性变更与本机核对

本轮上游带 6 份升级指南（`docs/upgrade-guide/v0.2.2-alpha.2/`），逐项核对如下：

| 指南 | 变更要点 | 本机影响 |
|---|---|---|
| `context-menu-target` | `MenuTarget` → `ContextMenuTarget`（无兼容别名）；`menuTarget` / `useMenuTarget` → `contextMenuTarget` / `useContextMenuTarget`；动作图标改为 `{ key, src? }` 经 `contextMenu.icon` Slot 渲染 | 插件源码扫描 **零命中**，无需改 |
| `schedule-agent-tools` | 工具改为 `schedule_create` / `schedule_list` / `schedule_view` / `schedule_edit`；`schedule_update` / `schedule_delete` 移除；`schedule_create` 只收 `rrule` + `target`（`this_session`/`new_once`/`new`） | 插件源码扫描 **零命中**；`~/.agents/skills/startup/SKILL.md` 已迁移为 RRULE 新语法（mtime 10:08:16，格式已对照 `tool-schedule` 的 `RRULE_HELP` 校验） |
| `schedule-remote-host-tasks` | Schedule 域**写 v2、读 v1**；存储布局不变；**首次成功的 v2 写会把 unit 标成 v2，之后 v1 二进制拒绝打开**，降级必须恢复备份 | 本机 `~/.dsh/storages/schedule.json` 仍为 v1（mtime 08:58，早于升级），54 条任务未被改动；**尚未备份**，见「遗留风险」 |
| `sdk-run-commands` | SDK `run()` 接受原生命令输入并始终返回 `RunResult` | 本机插件不涉及 SDK run，无影响 |
| `llm-request-purpose-declarations` | 辅助 LLM 请求的 `purpose` 改为声明合并，`compaction`/`session-title` 不再由共享包声明 | 本机插件不构造辅助 LLM 请求，无影响 |
| `forge-git-permissions` | Forge Git 查询改用 Session 沙箱权限、禁用配置的 diff helper | 本机插件不调用 Forge Git，无影响 |

**插件侧实测**：`~/.dsh/profiles/web/node_modules/@deepseek-ai/` 下 **13 条 symlink，13/13 `import` OK**；重启后两个 stdio MCP（`gerrit-mcp`、`feishu-mcp-pro`）均由新 dsh 拉起（pid 2293178 / 2293280→2293281）。其余 MCP 是 streamable-http，无本地进程，不适用进程检查。

## 验证（2026-11-02 已跑通）

- `pnpm install`：6.3s，`EXIT=0`
- `tsx scripts/clean.ts`：removed **381** paths
- `tsx scripts/build.ts`：**10 gates 全过**（88.11s），记录 **366** 个 client artifact，`EXIT=0`
- 构建戳 `.dsh-build/client-build-environment.json`：
  - `DSH_CLIENT_COMMIT_HASH=ce7073d`（构建在 10:05 运行，本地提交 10:06:49 才创建，故戳记基线哈希而非 `f9366a0a85`）
  - `DSH_CLIENT_GIT_DIRTY=true`（构建时本地改动尚未提交；且仓库根有未跟踪的 `out/`、`gfxinfo_investigation_report.md`，git status 仍会判 dirty）
  - `DSH_CLIENT_VERSION=0.2.2-alpha.2`；`fileCount=366`，`sha256=b01e09dafad7458b2d929227f051ef0ff02c6b581a294d2cd22c7d70a03aad3d`
- 定向测试：`npx vitest run packages/client/ui-subagent packages/experimental/agent-team packages/experimental/tool-agent-team` → **8 文件 / 180 用例全过**（3.72s），`EXIT=0`
- 服务健康矩阵（新进程）：pid **2293115**，启动 10:12:09，bootId **`6fa17b97-29ad-476a-9030-6bbead5a74db`**（旧 `c25c063a-784c-447f-ac1e-d983c64232fd`）；3080 监听；无 token=401、带 token=303、跟随后 200 + `text/html`（42887 B，HTML 含 `0.2.2-alpha.2`）；进程持续存活。
- 看板：8090 / 8092 / 8093 / 8094 / 8095 / 8099 全 **HTTP 200**（由独立 systemd user unit 承载，不受 dsh 重启影响）。

### 产物校验点（下次快速核对，行号可能随上游漂移）

- `packages/client/ui-subagent/lib/client.js:179` → `catalog.entries.toReversed()`；全文件 `toReversed` **仅 1 处**
- `packages/experimental/tool-agent-team/lib/index.js:274` / `:278` → `model` / `reasoning_effort` 入参；`:297` → `reasoningEffort` 透传
- `packages/experimental/agent-team/lib/index.js:1043` → `agentOptions: {`

## ★本轮事故：重启脚本被 cgroup 连带杀死（已修复）

**现象**：升级会话在 10:09 安排 `/tmp/dsh-upgrade-restart.sh`（sleep 60s 后调 `~/.dsh/tools/restart-dsh.sh`）。10:10:14 重启脚本杀掉了旧 dsh（pid 2525002）后**自身消失**：日志停在 `[restart-dsh] API key: ok(长度51)`，没有「旧进程退出 / 新进程已拉起」，3080 无监听、无 `bin.ts` 进程——服务一直停着。

**根因**：该重启脚本由 **dsh 会话内的 bash 作业**启动；`setsid nohup` 只能脱离会话/终端，**脱不出 cgroup**。脚本仍住在 dsh 自己的 scope 里，旧 dsh 一退出，systemd 拆 scope 把整棵树（包括正在执行的重启脚本）一起杀掉，新服务来不及拉起。

**修复**：从 dsh 外部（Claude Code 的 shell）执行 `~/tools/start_dsh.sh`，10:12:09 拉起新 pid 2293115，全部健康判据通过。

**教训（已写入 memory）**：**永远不要从 dsh 会话内部安排它的重启**。需要延迟/自动重启时，用 `systemd-run --user --unit=...` 瞬态 unit，或从 dsh 之外的 shell 执行；`setsid` + `nohup` 挡不住 cgroup teardown。

## 遗留风险

1. **Schedule 存储 v1→v2**：`~/.dsh/storages/schedule.json` 目前仍是 v1、未被本轮写动；**首次 v2 写后旧二进制将拒绝打开**。建议在任何 schedule 写操作前先 `cp schedule.json schedule.json.v1-backup`。
2. **旧定时任务仍在**：54 条 v1 任务保留原有时机与投递目标；其中指向旧会话的任务仍会向旧会话投递，是否清理需单独判断。
3. **`api.deepseek.com` 模型列表不可达**：启动日志有 `[llm-deepseek-account] model listing ... failed; using the bundled catalog`，非致命（用内置目录），但模型清单可能不是最新。
4. **客户端插件仅静态验证**：13/13 `import` 成功只证明模块可加载；`dsh-client-*` 插件真正生效需在 Web UI 操作验证（参见 `reference_dsh_plugin_shadow_verification` 的假阳性教训）。
5. **能力 A 未跑真机 spawn**：agent-team 只在 auto-mode 预设启用，本轮仍只验到产物层。
6. **备份分支**：`backup/local-features-20261102`（`a24711a4d8`）等旧分支确认稳定后可删。

## 维护：在新上游版本上重放

1. 备份当前 `schedule.json`（若新版本跨越 v2 存储变更）。
2. `git fetch origin && git checkout <新基线>`；记录新基线 SHA 与自报版本。
3. `git am <本目录>/0001-*.patch`；冲突用 `git apply -3` 后手工合入，重点看 `tool-agent-team/src/index.ts` 的 `execute` 与 `SubagentHeaderLineage.tsx` 的 `CatalogRows`。
4. 解冲突后重跑 `pnpm run verify-translation-pairing --write`（README 三件套）。
5. `pnpm install && pnpm run clean && pnpm run build`，核对构建戳与 artifact 数。
6. 定向测试三个包；确认 `toReversed` 全文件仅 1 处、`agentOptions` 能力门未被改坏。
7. 提交（建议按能力拆成两笔，避免再次合并）；按新基线 SHA 建 `patches/dsh-master-<sha>/` 归档并更新本 README。

## 时间戳说明

本轮提交是升级会话在基线上直接 `git apply -3` 后 `git commit` 产生的，**author date 就是真实提交时间**（2026-11-02 10:06:49 +0800），没有使用 `commit-tree` 重建；后续重放若要保留身份连续性，可按上一轮做法用 `commit-tree` 保留原作者与日期。
