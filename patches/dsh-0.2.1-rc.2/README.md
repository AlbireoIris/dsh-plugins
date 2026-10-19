# DSH 本地侵入式修改补丁集 — 0.2.1-rc.2 基线

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 0.2.1-rc.2 基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（0.2.1-alpha.4 基线）见 `../dsh-0.2.1-alpha.4/`。两版**不是增量关系**——alpha.4 → rc.2 中间隔了 **49 个提交**，两笔补丁都是在新基线上**重做**的，不是 `cherry-pick` 过来的。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`687f282e86`（`Merge pull request #6408 from deepseek-harness/worktree/release-dsh-0.2.1-rc.2`，2026-10-17 15:22）
- **对应上游版本**：`0.2.1-rc.2`（基线树上根 `package.json` 的 `version`）
- **基线认定依据**：
  1. 本地 master 的两笔本地提交（`bc7752bbec`、`6e80f60415`）直接落在 `687f282e86` 之上，`git log origin/master..master` 仅这两笔，故基线点取父提交；
  2. `origin/master` 顶端**恰好**是 `687f282e86`，本地与上游 master 无分叉；
  3. tag `dsh-v0.2.1-rc.2` **正指向** `687f282e86`，即该版本的发布点就是基线本身。
  - 三条依据（本地父提交 / master 顶端 / tag 指向）**完全重合于同一个 SHA**，与前几版一样无歧义。

**适用性**：补丁可直接 `git am` 到基线 `687f282e86`（已验证，见下），通常也可 am 到其后一段时间内的上游提交；更晚的上游版本按文末"维护：在新上游版本上重放"处理。

### 本轮跨度与兼容性预判

- **跨度**：`86a402200d..687f282e86` = 49 个提交（非合并 32 个）。中间经过 `dsh-v0.2.1-alpha.5`（10-16 19:02）和 `dsh-v0.2.1-rc.1`（10-16 21:46）两个发布点。
- **升级前核实**（四条，全部为"无阻力"结论）：
  1. 两笔补丁碰过的 5 个文件在 49 个提交里**零改动** → 重放预期零冲突（实际也零冲突）。
  2. `packages/boot/app-boot/src/compatibility-preflight.ts` **一字未改** → 插件兼容预检行为不变。
  3. vendor 9 个包只去掉 `-alpha.2` 预发布后缀（11 文件 +104/−9，其中 93 行是升级计划文档），**源码零改动** → 插件 API 不变。
  4. 49 个提交信息里**没有 `breaking` 标记**。

## 补丁清单

### `0001-feat-agent-team-spawn-model-0.2.1-rc.2.patch`

- **标题**：`feat(agent-team): 恢复 spawn model 透传补丁并适配 0.2.1-rc.2 基线`
- **原始提交**：`bc7752bbec4371a7fa008ce8fe9c114b3c6d0569`（作者 zhululin1，树 `3555d4f29fdcc992358d6848829257d8768aa3d6`）
- **承接**：0.2.1-alpha.4 版 `0001`（原提交 `a7dc1cf236`）、0.2.1-alpha.2 版 `0001`（原提交 `72a0787be6`）、0.2.0-rc.1 版 `0001`（原提交 `466851f7e4`）、0.1.2 版 `0001`（原提交 `69f0612d5b`）
- **改了什么**：让 Agent Teams 的 `spawn_teammate` 工具支持为单个子代理指定 `model` 与 `reasoning_effort`（动机：如让评审 teammate 用与产出 teammate 不同的模型）。机制是三层透传：`tool-agent-team` 的 `spawn_teammate` 入参新增可选 `model` / `reasoning_effort`，经 `dsh-experimental-agent-team` 的 `SpawnTeammateRequest`（新增同名字段）传到 `TeamRoster` 创建子代理时的 `agentOptions`；两值均省略时保持上游原行为（`resolveChildAgentOptions` 继承 Team Lead 的路由）。
- **涉及的主要文件**（6 文件，+37/−4）：
  - `packages/experimental/tool-agent-team/src/index.ts`（工具入参 + `reasoning_effort → reasoningEffort` 映射 + 透传）
  - `packages/experimental/agent-team/src/types.ts`（`SpawnTeammateRequest` 新增字段）
  - `packages/experimental/agent-team/src/roster.ts`（`agentOptions` 注入）
  - `packages/experimental/tool-agent-team/README.md` / `README.zh.md` / `README.i18n.yaml`
- **如何应用**：`git am`（保留提交信息与作者），在 **deepseek-harness 仓库根目录**执行：

  ```sh
  cd <deepseek-harness 检出>
  git checkout 687f282e86   # 或包含该基线的分支
  git am <本目录>/0001-feat-agent-team-spawn-model-0.2.1-rc.2.patch
  ```

- **风险与冲突点**：
  - 最大冲突面仍是 `tool-agent-team/src/index.ts` 的 `execute`：后续上游继续演进该函数结构时此 hunk 必冲突，需按新结构重新叠加透传字段。本版该处**未动**，hunk 首行上下文仍是 `prompt: [{ type: 'text', text: args.prompt }],`。
  - **`agentOptions` 的能力门是"存在即要求"。** `packages/subagent/subagent/src/index.ts` 里该字段的门条件写作 `{ when: request.agentOptions !== undefined, cap: 'agentOptions' }`——触发条件是**字段是否存在**，不是**是否有内容**。所以一个"存在但为空"的 `agentOptions: {}` 同样会要求 provider 声明 `agentOptions` 能力。两值都省略时本补丁确实会构造出空对象，因此**只在调用方指名路由时才写入对应字段**是刻意写法、也是注释所描述的行为，不要"优化"成无条件写入。两个默认 provider（`subagent-spawn-in-process`、`subagent-fork-in-process`）当前都声明了该能力，故实测不受影响。
  - `agent-team/src/types.ts` 依赖 `@deepseek-ai/dsh-llm` 导出 `ReasoningEffortId`。**这是从 0.2.0-rc.1 起延续的坑**：原实现经 `dsh-agent` 主入口导入该类型，会把 **host 侧 `Session` service 声明**合并拉进 Client 编译程序，连锁破坏 `mount.ts` 的类型；必须从 `@deepseek-ai/dsh-llm` 直接导入（定义在 `packages/llm/llm/src/brand.ts`，经 `llm/src/index.ts` 的 `export * from './brand.ts'` 再导出）。
  - `roster.ts` 的 `agentOptions` 字面量插在 `request.prompt/parent` 与 `signal` 之间；上游重排 spawn 调用参数时需手工合入。
  - README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write` 重录配对 hash（记录的是 per-section hash）。
  - ⚠️ 自 0.2.0 重构起，本笔**不含单测与 Agent Note**（`tool-agent-team/tests/tool-team.spec.ts` 与对应 note 不在新树里）。重放时不需再找这两个文件。
  - **本笔代码跨版本逐字未变**：alpha.2 → alpha.4 → rc.2 三版相比，补丁代码零差异；rc.2 版与 alpha.4 版的差异**只在提交信息**（标题里的"适配 0.2.1-alpha.4 基线"改为"适配 0.2.1-rc.2 基线"，正文承接行改为"重做到 0.2.1-rc.2（687f282e86）"）。因此补丁文件从 9295 B 变成 9289 B，而 diffstat、树哈希与产物行号全部不变。

### `0002-feat-web.patch`

- **标题**：`feat(web): 子代理目录行按最新创建优先排序`
- **原始提交**：`6e80f60415738fef5cf3d1a99fb5914fd58586ff`（作者 zhululin1，树 `3c527a2505352c279a0a193d8a1c4ca5cf8689b3`）
- **承接**：0.2.1-alpha.4 版 `0002`（原提交 `17bc6c1e0f`）、0.2.1-alpha.2 版 `0002`（原提交 `9350ffe1d7`）、0.2.0-rc.1 版 `0002`（原提交 `80a85c5d0a`）、0.1.x 版 `a1148836a3`
- **改了什么**：会话头 lineage 下拉里的子代理目录行改为**最新创建排在最上**。实现分两处：先把反转结果落到局部变量 `const rows = catalog.entries.toReversed()`，再把该数组用于渲染（`rows.map(...)`）与 `reserveDisclosure` 的计算。service 侧 `packages/subagent/subagent/src/catalog.ts` 的**创建升序契约原样不动**，沿升序到达、以反转呈现。**键盘导航按 DOM 顺序遍历**，因此反转后的呈现与导航天然一致。
- **涉及的主要文件**（5 文件，+30/−11）：
  - `packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx`（呈现层反转）
  - `packages/client/ui-subagent/tests/conversation-ui.client.spec.tsx`（新增 `renders catalog rows newest-created first`；键盘遍历期望同步改动）
  - `packages/client/ui-subagent/README.md` / `README.zh.md` / `README.i18n.yaml`
- **如何应用**：同 `0001`，`git am` 到同一基线即可（两笔按序应用）：

  ```sh
  git am <本目录>/0001-*.patch <本目录>/0002-*.patch
  ```

- **风险与冲突点**：
  - `SubagentHeaderLineage.tsx` 的 `CatalogRows` 是上游活跃演进区，上游再动这块会冲突。
  - 测试 fixture 形状与 0.1.x 不同：`SubagentCatalogRow` 已无 `kind` / `hasChildren`，旧补丁的 fixture 不可用。另有一处**刻意偏差**——`newest` 那条设为 `inactive` 而非 `running`，因为触发器在有子代理运行时 `aria-label` 播报的是**运行数**而非总数。行为断言不变。
  - README 的 i18n 三件套改完同样要 `pnpm run verify-translation-pairing --write`。
  - **本版与 alpha.4 版逐字相同**（代码、测试、README 均无差异），仅提交 SHA 变化。
  - **文件名为何没有版本后缀**：本笔 subject 未追加"并适配 … 基线"（`0001` 有），故 `git format-patch` 自动派生的文件名就是 `0002-feat-web.patch`。`git am` 不依赖文件名，不影响应用。
  - ⚠️ **补丁原带的 Agent Note 不再回收**：该 note 已被上游归档到 `.agents/notes/archived/feature/2026-07-27-web-subagent-conversations.{md,zh.md,i18n.yaml}`。**归档件是冻结的，不得改写**（见仓库 `AGENTS.md` 的 archive policy），故本笔不动它。

### 关于两笔提交的时间戳

本轮是"新基线上重做"：两笔提交用 `git commit-tree` 按原树 + 原 author 身份/日期重建（`git rebase -i` 在本机不可用），因此 **author date 仍是 2026-10-16 16:55/16:56**，早于基线合并时间（10-17 15:22）。这是**刻意保留**——目的是让补丁身份（作者、日期）跨版本连续，便于追溯；提交内容以树哈希为准。

### ⚠️ 0002 与插件 `subagent-newest-first` 互斥（应用后必须退役插件）

`plugins/subagent-newest-first`（`@deepseek-ai/dsh-client-subagent-newest-first`）的*意图*与本补丁一致，但**两者不能共存**：

1. 它是以 `priority: -1` 抢占 `conversation.session.header.lineage` 的**全量 shadow**（~1300 行副本）。该槽位 `kind: 'single'`、`scope: 'session'`，slot 组合是**替换而非装饰**，所以 `-1` 就赢下格子、上游（本补丁）那份实现**永远不渲染**。
2. 它编译在 **0.1.x 的 API** 上（`lib/client.js` 调 `sessions.openSubagent` / `refreshSubagents` / `setSubagentCatalogOpen`，读 `subagentsByParent`），三者在 0.2.0 全仓 0 命中。实测在 0.2.0 上打开任一会话即抛 `TypeError: Cannot read properties of undefined (reading 'session-…')`。
3. 它的 `peerDependencies` **只声明 `react`**，没有任何 dsh 包 → 依赖检查/编译检查都抓不到这次 API 漂移。

**该插件自 2026-09-29 起已从 `~/.dsh/profiles/web/cordis.patch.yml` 退役**，能力改由本补丁承载。本次 rc.2 验收时核对过：活跃 profile 里 `subagent-newest-first` **只出现在退役注释中，无任何活跃行**。

## 与 `final-reply-guard` 的关系：本轮无变化

"回合末回复守卫"自 alpha.4 那轮起已**移植为外部插件**（本仓 `plugins/final-reply-guard/`，`@deepseek-ai/dsh-final-reply-guard` v0.1.0），与补丁集解耦。本轮升级**不涉及它**：清树只清 deepseek-harness 仓库，插件源码在本仓、profile 挂载在 `~/.dsh/profiles/web/cordis.patch.yml`，均未被触及。

rc.2 上对它的复核（本轮实测）：

| 项 | 结果 |
|---|---|
| profile 解析 | 守卫行仍解析到 `plugins/final-reply-guard/lib/index.js`（全 profile **28/28** 插件行解析成功，其中本仓 7 个） |
| 准入判定 | 对真实 profile 补丁层跑 `prepareProfileEntries` / `evaluatePluginCompatibility`：18 entry / 18 rows、**denial 0**、守卫行 `disabled` 未设；阳性对照**确实被拦** |
| 宿主日志 | 新宿主启动块无任何插件加载错误（`ERR_MODULE_NOT_FOUND` / `Cannot find` / `failed to load` 扫描为空） |

★ **denial 措辞又变了**（排障时的年代指纹，第三版）：alpha.2 是 `its declared peer dependencies cannot be validated: …`，alpha.4 是 `its declared dsh requirements cannot be validated: …`，**rc.2 改成** `Plugin <pkg>@<ver> is incompatible with dsh 0.2.1-rc.2: requirements {...}. Running it may cause crashes or data loss. …`。看到哪种措辞，就知道那段日志属于哪个年代的宿主。

## 验证（生成时点 2026-10-19 已跑通）

| 项 | 结果 |
|---|---|
| `git am` 到基线 `687f282e86`（在一次性 worktree 上重放） | 两笔全部干净通过，无 fuzz |
| am 后树哈希 vs 原始提交树 | **逐字节一致**：`0001` = `3555d4f29fdcc992358d6848829257d8768aa3d6`，`0002` = `3c527a2505352c279a0a193d8a1c4ca5cf8689b3`；worktree 用完即删 |
| 补丁文件校验 | `0001` 9289 B / sha256 `5c711ea2bf2c85cb87221f98f7db11df00b882347601c271ca6bd2f9b68ba6e8`；`0002` 11854 B / sha256 `620f45fbc3ff4a4d80c64083f8117a257e911543d80df4bb55f4ccd729044d74` |
| `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` | 27 文件 / **512 通过**（service 侧 `catalog.spec.ts` 仍绿 → 升序契约未被破坏） |
| `npx vitest run packages/experimental/agent-team/tests packages/experimental/tool-agent-team/tests` | 4 文件 / **105 通过** |
| `pnpm run typecheck` | rc=0（5 gates passed，0 failed） |
| `pnpm run test:docs` | **20 passed / 1 failed** / 0 skipped（11.43s）。失败项 = `verify-repository-references`，报 `python/sdk/uv.lock:113 commit-hash`——把该行 `size = 6344383` 当成 commit-hash 候选。**基线既有、与本补丁集无关**：两笔补丁对 `python/` 的改动文件数为 **0** |
| `pnpm build` | 325 artifacts，版本戳 `0.2.1-rc.2-6e80f60`，sha256 `ca7a6653e20ba3a3385b8cb8d54a252ef08a50a14e2b8946c1c2736007830d07`，无 `DSH_CLIENT_GIT_DIRTY` |
| 产物核验 | `packages/client/ui-subagent/lib/client.js:178` 有 `catalog.entries.toReversed()`；`packages/experimental/tool-agent-team/lib/index.js:278` 有 `reasoning_effort` 入参、`:297` 有条件透传映射；`packages/experimental/agent-team/lib/index.js:1040` 有 `agentOptions` 注入点——**行号与 alpha.4 版完全一致** |
| Chrome 验收 | 见下"测试结果"节（补丁② 端到端通过；补丁① 到产物层，未跑真机 spawn） |

### 测试结果

**验收环境（2026-10-19）**：`dsh-restart.sh` 重启，宿主 pid **297258**、启动于 10:08:37（`node --import tsx/esm apps/cli/src/bin.ts web --no-open`），监听 `127.0.0.1:3080`。四项健康判据（监听 / HTTP 探测 401 / 10 s 存活 / 新 token URL + 插件加载错误扫描）全过；五个看板 8090/8092–8095 均 HTTP 200。Chrome 打开 `http://127.0.0.1:3080/`，页面版本徽标为 **`0.2.1-rc.2-6e80f60`**（与 build 戳一致）。

#### 补丁 ②：会话头 lineage 行序（端到端，通过）

取会话「安排重新打一下fuzz的版本，can」（`session-0ff53424-bcad-40b7-8185-f0927d561c97`），其持久化 `subagent/catalog` 去重后共 **5 个子代理**（与页头 lineage 触发器播报的"5 个子智能体"一致）。展开下拉后，渲染行序（按 y 坐标自上而下）与该会话的**创建升序**对照：

| 渲染（顶→底） | 创建时间 | 持久化次序（升序） |
|---|---|---|
| 1. 刷 FUZZ 包并验证开机 | 10-16 17:28:17 | 第 5（最新） |
| 2. canberra fuzz 重打包第二次 | 10-16 15:40:30 | 第 4 |
| 3. 修复 KCOV CL 冲突出新 patchset | 10-16 15:32:51 | 第 3 |
| 4. 分析 fuzz 构建失败日志 | 10-16 15:22:00 | 第 2 |
| 5. canberra fuzz 重打包 | 10-16 14:47:30 | 第 1（最早） |

- **渲染序正好是持久化升序的完全逆序**（最新创建的排最上），service 侧升序契约未被破坏。截图存于 `~/ssd/task_deepseek_harness/rc2_lineage_order.jpg`。
- 假阳性排除同 alpha.4 版，用**结构性论据**而非类名指纹：① `subagent-newest-first` 在活跃 profile 里无活跃行；② 本仓 7 个插件名单不含它；③ 渲染实现来自构建产物 `ui-subagent/lib/client.js:178` 的 `toReversed()`，且该文件 build 戳与页脚版本一致。

#### 补丁 ①：`spawn_teammate` 的 model / effort 透传（产物层通过，未跑真机 spawn）

- **已验到产物层**：`tool-agent-team/lib/index.js:278` 是模型可见的入参 schema（`reasoning_effort` 及其描述）、`:297` 是条件透传映射、`agent-team/lib/index.js:1040` 是 `agentOptions` 注入点。单测 4 文件 / 105 通过，`pnpm run typecheck` rc=0。
- **未做真机调用**：agent-team 只在 **auto-mode 预设**里启用，而本次验收会话跑在**标准模式**预设，`spawn_teammate` 工具不在其工具面内；切进 auto-mode 需用户明确指令，故本次**没有发起真实 spawn**。
- 后续若要补这一步：在启用 agent-team 的预设下让 Lead 调 `spawn_teammate` 且指名 `model` + `reasoning_effort`，然后核对子代理会话的模型路由确实被覆盖（省略两值时仍走 `resolveChildAgentOptions` 继承 Lead 路由，即上游原行为）。

## WIP（进行中改动）

**deepseek-harness**：本次收尾时工作区**干净**，`git status --porcelain` 0 条目（含未跟踪文件）；本地只多两笔提交（`bc7752bbec`、`6e80f60415`），未推进上游。

**本仓（`~/ssd/dsh-plugins`）本次只提交 `patches/dsh-0.2.1-rc.2/`**，其余维持现状、未提交：

1. `plugins/final-reply-guard/` —— 已挂进活跃 profile 并在跑，但**尚未入库**（源码当前只在本机磁盘）。
2. `plugins/subagent-dispatch-verify/` —— 同样已挂进活跃 profile，同样未入库。
3. `plugins/device-guard/` —— 未挂进活跃 profile，未入库。
4. `pnpm-lock.yaml` **+111 行**未提交（上述三个插件的 workspace importer 块）。⚠️ 锁文件当前与已跟踪文件不一致，新克隆上 `pnpm install --frozen-lockfile` 会失败——要么三个插件入库，要么移出 workspace。
5. `H:/` —— 2026-10-13 误落在仓库根的目录（`pnpm-workspace.yaml` 里那行 `storeDir: H:/deepseek-harness/.pnpm-store` 的 Windows 风格路径在 Linux 上被当相对路径落盘）。误落物，未跟踪，未动。

## 维护：在新上游版本上重放

1. 在 DSH 检出里 `git fetch origin`，确定新基线（新基线的认定方法同上：本地提交的父提交 / workspace 版本对应的发布点 / tag 指向）。
2. 优先直接 `git am` 本目录补丁到新基线；失败时用 `git am --3way` 借助 patch 内嵌的 blob 索引自动三方合并。
3. 仍冲突时 `git am --show-current-patch=diff` 查看当前补丁，手工解决后 `git am --continue`；预期冲突面见各补丁小节的"风险与冲突点"。README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write`，否则文档门禁会挂。
4. 冲突吸收进新提交后，跑受影响面的验证：`pnpm run typecheck` + `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` + `npx vitest run packages/experimental/agent-team/tests packages/experimental/tool-agent-team/tests` + `pnpm run test:docs`。
5. **大版本更新前先 `git clean -ffdx`（务必带 `-x`）**，再检查有没有"只含 `node_modules` 的空壳目录"——0.1.6→0.2.0 时就因上游删包留下 12 个空壳目录，让 tsdown 报 `Cannot find entry`（详见 memory `project_dsh_020_update`）。
6. 若提交信息里带着旧基线名（如 `git am` 后 subject 仍写 alpha.4），本机 `git rebase -i` 不可用，可走 `git commit-tree` 重建：保留原树与原 author 身份/日期，只换 message —— 这套做法在 alpha.4 与 rc.2 两轮都验过。
7. 为新基线重新产出补丁集：`git format-patch <新基线>..<HEAD> -o patches/<新版本目录>/`，并复制本 README 按新基线改写。
8. `final-reply-guard` 已改为外部插件，**不再随补丁集走**——上游更新时它不受影响，无需重放，只需确认 profile 里那一行仍在解析（`createRequire('<profile>/package.json').resolve('@deepseek-ai/dsh-final-reply-guard')`）。
