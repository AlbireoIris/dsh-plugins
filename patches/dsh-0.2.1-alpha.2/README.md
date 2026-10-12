# DSH 本地侵入式修改补丁集 — 0.2.1-alpha.2 基线

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 0.2.1-alpha.2 基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（0.2.0-rc.1 基线）见 `../dsh-0.2.0-rc.1/`。两版**不是增量关系**——0.2.0-rc.1 → 0.2.1-alpha.2 中间隔了 **1122 个提交**，两笔补丁都是在新基线上**重做**的，不是 `cherry-pick` 过来的。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`d743267388641bc76f17c45ce8b4c231aed1d32c`（`Merge pull request #5946 from deepseek-harness/release-0.2.1-alpha.2`，2026-10-09，作者 07akioni `<07kioni2@gmail.com>`）
- **对应上游版本**：`0.2.1-alpha.2`（基线树上根 `package.json` 的 `version`）
- **基线认定依据**：
  1. 本地 master 的两笔本地提交（`72a0787be6`、`9350ffe1d7`）直接落在 `d743267388` 之上，`git log origin/master..master` 仅这两笔，故基线点取父提交；
  2. `origin/master` 顶端**恰好**是 `d743267388`（`git rev-list --count HEAD..origin/master` = 0），本地与上游 master 无分叉；
  3. tag `dsh-v0.2.1-alpha.2` **正指向** `d743267388`，即该版本的发布点就是基线本身。
  - 这一版比 0.2.0-rc.1 那版更清爽：上版 tag 与 master 顶端虽也重合，但本地基线仍需从"父提交"反推；这次三条依据（本地父提交 / master 顶端 / tag 指向）**完全重合于同一个 SHA**，基线无任何歧义。

**适用性**：补丁可直接 `git am` 到基线 `d743267388`（已验证，见下），通常也可 am 到其后一段时间内的上游提交；更晚的上游版本按文末"维护：在新上游版本上重放"处理。

## 补丁清单

### `0001-feat-agent-team-spawn-model-0.2.1-alpha.2.patch`

- **标题**：`feat(agent-team): 恢复 spawn model 透传补丁并适配 0.2.1-alpha.2 基线`
- **原始提交**：`72a0787be6ad0488946700d2d9d72ad5100f1bcd`（2026-10-12，作者 zhululin1）
- **承接**：0.2.0-rc.1 版 `0001`（原提交 `466851f7e4`）、0.1.2 版 `0001`（原提交 `69f0612d5b`）
- **改了什么**：让 Agent Teams 的 `spawn_teammate` 工具支持为单个子代理指定 `model` 与 `reasoning_effort`（动机：如让评审 teammate 用与产出 teammate 不同的模型）。机制是三层透传：`tool-agent-team` 的 `spawn_teammate` 入参新增可选 `model` / `reasoning_effort`，经 `dsh-experimental-agent-team` 的 `SpawnTeammateRequest`（新增同名字段）传到 `TeamRoster` 创建子代理时的 `agentOptions`；两值均省略时保持上游原行为（`resolveChildAgentOptions` 继承 Team Lead 的路由）。
- **涉及的主要文件**（6 文件，+37/-4）：
  - `packages/experimental/tool-agent-team/src/index.ts`（工具入参 + `reasoning_effort → reasoningEffort` 映射 + 透传）
  - `packages/experimental/agent-team/src/types.ts`（`SpawnTeammateRequest` 新增字段）
  - `packages/experimental/agent-team/src/roster.ts`（`agentOptions` 注入）
  - `packages/experimental/tool-agent-team/README.md` / `README.zh.md` / `README.i18n.yaml`
- **如何应用**：`git am`（保留提交信息与作者），在 **deepseek-harness 仓库根目录**执行：

  ```sh
  cd <deepseek-harness 检出>
  git checkout d743267388641bc76f17c45ce8b4c231aed1d32c   # 或包含该基线的分支
  git am <本目录>/0001-feat-agent-team-spawn-model-0.2.1-alpha.2.patch
  ```

- **风险与冲突点**：
  - 最大冲突面仍是 `tool-agent-team/src/index.ts` 的 `execute`：后续上游继续演进该函数结构时此 hunk 必冲突，需按新结构重新叠加透传字段。
  - **本版新踩的坑①：spawn API 已迁移。** 0.2.0-rc.1 时的调用点是 `subagents.startContinuable({ ..., request: { prompt, parent, agentOptions } })`；本版上游换成了 `subagents.startActivation({ delivery: 'parent', childId, provider, label, request: {...}, signal })`——**`provider` 被上提到外层**，覆盖点仍落在 `request.agentOptions`。重放时若上游又动这个签名，需重新对齐。
  - **本版新踩的坑②：`agentOptions` 的能力门是"存在即要求"。** `packages/subagent/subagent/src/index.ts` 里该字段的门条件写作 `{ when: request.agentOptions !== undefined, cap: 'agentOptions' }`——触发条件是**字段是否存在**，不是**是否有内容**。所以一个"存在但为空"的 `agentOptions: {}` 同样会要求 provider 声明 `agentOptions` 能力。两值都省略时本补丁确实会构造出空对象（`{ ...{} , ...{} }`），因此**只在调用方指名路由时才写入对应字段**是刻意写法、也是注释所描述的行为，不要"优化"成无条件写入。两个默认 provider（`subagent-spawn-in-process`、`subagent-fork-in-process`）当前都声明了该能力，故实测不受影响。
  - `agent-team/src/types.ts` 依赖 `@deepseek-ai/dsh-llm` 导出 `ReasoningEffortId`。**这是从 0.2.0-rc.1 起延续的坑**：原实现经 `dsh-agent` 主入口导入该类型，会把 **host 侧 `Session` service 声明**合并拉进 Client 编译程序，连锁破坏 `mount.ts` 的类型；必须从 `@deepseek-ai/dsh-llm` 直接导入（`ReasoningEffortId` 定义在 `packages/llm/llm/src/brand.ts`，经 `llm/src/index.ts` 的 `export * from './brand.ts'` 再导出）。
  - `roster.ts` 的 `agentOptions` 字面量插在 `request.prompt/parent` 与 `signal` 之间；上游重排 spawn 调用参数时需手工合入。
  - README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write` 重录配对 hash（记录的是 per-section hash）。
  - ⚠️ **比 0.2.0-rc.1 版仍少两个文件**：`tool-agent-team/tests/tool-team.spec.ts` 与对应 Agent Note 自 0.2.0 重构起就不在新树里，故本笔同样**不含单测与 Note**。重放时不需再找这两个文件。

### `0002-feat-web.patch`

- **标题**：`feat(web): 子代理目录行按最新创建优先排序`
- **原始提交**：`9350ffe1d73a6ac33df2878beba656e13a38aa34`（2026-10-12，作者 zhululin1）
- **承接**：0.2.0-rc.1 版 `0002`（原提交 `80a85c5d0a`）、0.1.x 版 `a1148836a3`
- **改了什么**：会话头 lineage 下拉里的子代理目录行改为**最新创建排在最上**。实现分两处：先把反转结果落到局部变量 `const rows = catalog.entries.toReversed()`，再把该数组用于渲染（`rows.map(...)`）与 `reserveDisclosure` 的计算。service 侧 `packages/subagent/subagent/src/catalog.ts` 的**创建升序契约原样不动**（`SubagentListEntry` 的持久化契约按创建时间升序），沿升序到达、以反转呈现。**键盘导航按 DOM 顺序遍历**（`navigate()` → `treeItems(menuRef.current)` → `focusAt(index)`），因此反转后的呈现与导航天然一致。
- **涉及的主要文件**（5 文件，+30/-11）：
  - `packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx`（呈现层反转）
  - `packages/client/ui-subagent/tests/conversation-ui.client.spec.tsx`（新增 `renders catalog rows newest-created first`；键盘遍历期望同步改动 ArrowDown→`reviewer`、End→`worker`、Home→`reviewer`、ArrowUp→`worker`；延迟聚焦断言 `reviewer`→`worker`）
  - `packages/client/ui-subagent/README.md` / `README.zh.md` / `README.i18n.yaml`
- **如何应用**：同 `0001`，`git am` 到同一基线即可（两笔按序应用）：

  ```sh
  git am <本目录>/0001-*.patch <本目录>/0002-*.patch
  ```

- **风险与冲突点**：
  - `SubagentHeaderLineage.tsx` 的 `CatalogRows` 是上游活跃演进区，上游再动这块会冲突。
  - 测试 fixture 形状与 0.1.x 不同：`SubagentCatalogRow` 已无 `kind` / `hasChildren`，旧补丁的 fixture 不可用。另有一处**刻意偏差**——`newest` 那条设为 `inactive` 而非 `running`，因为触发器在有子代理运行时 `aria-label` 播报的是**运行数**（`{count} 个子智能体，正在运行`）而非总数，`running` 会让 `getByRole('button', { name: /3 个子智能体/ })` 选不中。行为断言不变。
  - README 的 i18n 三件套改完同样要 `pnpm run verify-translation-pairing --write`。
  - **文件名为何没有版本后缀**：本笔 subject 未追加"并适配 … 基线"（`0001` 有），故 `git format-patch` 自动派生的文件名就是 `0002-feat-web.patch`，与 0.2.0-rc.1 版手工改名的 `0002-feat-web-0.2.0-rc.1.patch` 风格不同。之所以不去 amend subject 补齐：构建版本戳记录的是构建时 HEAD 的 SHA，事后改 subject 会让戳里的 `DSH_CLIENT_COMMIT_HASH` 悬空，代价大于文件名整齐。`git am` 不依赖文件名，不影响应用。
  - ⚠️ **补丁原带的 Agent Note 不再回收**：该 note 已被上游归档到 `.agents/notes/archived/feature/2026-07-27-web-subagent-conversations.{md,zh.md,i18n.yaml}`。**归档件是冻结的，不得改写**（见仓库 `AGENTS.md` 的 archive policy），故本笔不动它。

### ⚠️ 0002 与插件 `subagent-newest-first` 互斥（应用后必须退役插件）

`plugins/subagent-newest-first`（`@deepseek-ai/dsh-client-subagent-newest-first`）的*意图*与本补丁一致，但**两者不能共存**：

1. 它是以 `priority: -1` 抢占 `conversation.session.header.lineage` 的**全量 shadow**（~1300 行副本）。该槽位 `kind: 'single'`、`scope: 'session'`，slot 组合是**替换而非装饰**，所以 `-1` 就赢下格子、上游（本补丁）那份实现**永远不渲染**。
2. 它编译在 **0.1.x 的 API** 上（`lib/client.js` 调 `sessions.openSubagent` / `refreshSubagents` / `setSubagentCatalogOpen`，读 `subagentsByParent`），三者在 0.2.0 全仓 0 命中——被 `e55093b47d feat(subagent): migrate direct catalog consumers to parent projections` 改名。实测：0.2.0 上打开任一会话，console 立即报
   `TypeError: Cannot read properties of undefined (reading 'session-…') at CatalogDropdown (…/dsh-client-subagent-newest-first/client.js:538:28)`
   及 `slot entry crashed in 'conversation.session.header.lineage'`——错误被槽位错误边界兜住、页面不白屏，但**会话头的 lineage 单元格内容缺失**。
3. 它的 `peerDependencies` **只声明 `react`**，没有任何 dsh 包 → 依赖检查/编译检查都抓不到这次 API 漂移。

**该插件自 2026-09-29 起已从 `~/.dsh/profiles/web/cordis.patch.yml` 退役**，能力改由本补丁承载。它是本仓库的插件原始出处（保留在 `plugins/` 下作存档），但**不要**在 0.2.0 及以后的 profile 里启用——启用就等于把上游那份改好的 lineage 实现压掉、并换回一个必崩的副本。

## 验证（生成时点 2026-10-12 已跑通）

| 项 | 结果 |
|---|---|
| `git am` 到基线 `d743267388` | 两笔全部干净通过，无 fuzz |
| am 后树哈希 vs 原始提交树 | **逐字节一致**：`0001` = `9f51089ac8b9f3fa7163b02c00f0485cdb0926fd`，`0002` = `964bc2c462347f15f6ae61f5ebeeb9e8643df4c8`；am 后 `git diff` 对照本地提交后的树为空 |
| `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` | 26 文件 / **503 通过**（service 侧 `catalog.spec.ts` 仍绿 → 升序契约未被破坏） |
| `npx vitest run packages/client/ui-subagent/tests/conversation-ui.client.spec.tsx` | **52/52** |
| `pnpm run typecheck` | rc=0 |
| `pnpm run test:docs` | **21 passed / 0 failed** / 0 skipped（23.05s） |
| `pnpm build` | 357 artifacts，版本戳 `9350ffe` / `0.2.1-alpha.2`，无 `DSH_CLIENT_GIT_DIRTY` |
| 产物核验 | `packages/client/ui-subagent/lib/client.js` 含 `toReversed`；`packages/experimental/agent-team/lib/index.js:1040` 有 `agentOptions` 透传；`packages/experimental/tool-agent-team/lib/index.js:264,293-294` 有 `reasoning_effort` 入参与 `model` / `reasoning_effort → reasoningEffort` 映射 |
| Chrome 验收 | 见下"测试结果"节（补丁② 端到端通过；补丁① 到产物层，未跑真机 spawn） |

### 测试结果

**验收环境（2026-10-12）**：`dsh-restart.sh` 重启，`RESTART_RC=0`——3080 存活（pid 2815463，HTTP 401 属预期）；看板 8090/8092–8095 全部 HTTP 200；新日志无插件加载错误。Chrome 打开 `http://localhost:3080/`：页脚版本徽标 `0.2.1-alpha.2-9350ffe`；10 个 dsh 插件包依赖解析 **10/10**；71 个 client 插件加载。

#### 补丁 ②：会话头 lineage 行序（端到端，通过）

取当前打开的会话 `canberra DFD`（`session-9c8c5bf9-8fdc-4c61-87fc-4ffeda90d9f3`），页头 lineage 触发器 `aria-label="8 个子智能体"`，展开后读 DOM 行序，与投影缓存 `/home/mi/.dsh/storages/session_projcache/sessions/session-9c8c5bf9-….json` 里 `rows.subagentCatalog.val.head.values` 的**创建升序**逐行对照：

| 渲染（顶→底） | 持久化（创建升序） |
|---|---|
| 1. 继续刷机并验证云控DFD | 1. 代码侧检索 DFD 与云控使能链路 |
| 2. 下载刷机验证云控DFD | 2. preloader 侧按平台机型普查 DFD |
| 3. 重试柯基打包双 CL | 3. 云控侧按平台机型普查 DFD |
| 4. 柯基打包带两笔 DFD CL | 4. 柯基打包带 CL 10510273 |
| 5. 柯基打包带 CL 10510273 | 5. 柯基打包带两笔 DFD CL |
| 6. 云控侧按平台机型普查 DFD | 6. 重试柯基打包双 CL |
| 7. preloader 侧按平台机型普查 DFD | 7. 下载刷机验证云控DFD |
| 8. 代码侧检索 DFD 与云控使能链路 | 8. 继续刷机并验证云控DFD（最新） |

- **渲染序正好是持久化升序的完全逆序**（最新创建的排最上），service 侧升序契约未被破坏。
- 8 行的类名均为 `S74kaa_row` —— 这是**仓内实现** `SubagentHeaderLineage.tsx` 的 lightningcss 类名指纹（插件旧副本走的是 `FNT7jW_*`），故可排除插件 shadow 造成的假阳性。
- 第二份独立样本：`OTA moniter` 会话（`session-c879f3ac-c5ea-46be-9180-497c3a53f72e`）同为 8 行，渲染序同样是其 `subagentCatalog` 升序（10-09 17:12 的 `canberra 双包重打` → 10-10 11:54 的 `建stb全量OTA`）的完全逆序。
- Console **0 异常**：0.2.0 上那个必现的 `slot entry crashed in 'conversation.session.header.lineage'` **未复现**；页面来源的 console 仅有 3 条无害 404（`/open-in-app/icon/filemanager`，两条 `/api/changes.summary?…&seq=1761|1786`），其余全是 `chrome-extension://` 的扩展噪声。

#### 补丁 ①：`spawn_teammate` 的 model / effort 透传（产物层通过，未跑真机 spawn）

- **已验到产物层**：`packages/experimental/tool-agent-team/lib/index.js:260-266` 是模型可见的入参 schema（`model` / `reasoning_effort` 及其描述），`:293-294` 是条件透传映射（`args.model === void 0 ? {} : { model }`，`reasoning_effort → reasoningEffort`）；`packages/experimental/agent-team/lib/index.js:1040` 是 `agentOptions` 注入点。`pnpm run typecheck` rc=0。
- **未做真机调用**：agent-team 只在 **auto-mode 预设**里启用（`~/.dsh/.agent-presets/auto-mode/agent.cordis.yml` 是 `~/.dsh/profiles/` 与 `~/.dsh/.agent-presets/` 下唯一命中），而本次验收会话跑在**标准模式**预设，`spawn_teammate` 工具不在其工具面内；切进 auto-mode 需用户明确指令，故本次**没有发起真实 spawn**。
- 后续若要补这一步：在启用 agent-team 的预设下让 Lead 调 `spawn_teammate` 且指名 `model` + `reasoning_effort`，然后核对子代理会话的模型路由确实被覆盖（省略两值时仍走 `resolveChildAgentOptions` 继承 Lead 路由，即上游原行为）。

## WIP（进行中改动）

盘点（2026-10-12）时 deepseek-harness 工作区**干净**，`git status` 0 条目（含未跟踪文件）；仓库根在两笔提交前被挪走的脏文件保留在 `~/ssd/task_deepseek_harness/`（未删除）。

`~/ssd/dsh-plugins` 未跟随本次更新，维持现状。

## 维护：在新上游版本上重放

1. 在 DSH 检出里 `git fetch origin`，确定新基线（新基线的认定方法同上：本地提交的父提交 / workspace 版本对应的发布点 / tag 指向）。
2. 优先直接 `git am` 本目录补丁到新基线；失败时用 `git am --3way` 借助 patch 内嵌的 blob 索引自动三方合并。
3. 仍冲突时 `git am --show-current-patch=diff` 查看当前补丁，手工解决后 `git am --continue`；预期冲突面见各补丁小节的"风险与冲突点"。README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write`，否则文档门禁会挂。
4. 冲突吸收进新提交后，跑受影响面的验证：`pnpm run typecheck` + `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` + `pnpm run test:docs`。
5. **大版本更新前先 `git clean -ffdx`（务必带 `-x`）**，再检查有没有"只含 `node_modules` 的空壳目录"——0.1.6→0.2.0 时就因上游删包留下 12 个空壳目录，让 tsdown 报 `Cannot find entry`（详见本仓库 memory `project_dsh_020_update`）。
6. 为新基线重新产出补丁集：`git format-patch <新基线>..<HEAD> -o patches/<新版本目录>/`，并复制本 README 按新基线改写。
