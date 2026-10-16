# DSH 本地侵入式修改补丁集 — 0.2.1-alpha.4 基线

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 0.2.1-alpha.4 基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（0.2.1-alpha.2 基线）见 `../dsh-0.2.1-alpha.2/`。两版**不是增量关系**——alpha.2 → alpha.4 中间隔了 **941 个提交**，两笔补丁都是在新基线上**重做**的，不是 `cherry-pick` 过来的。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`86a402200d95fecef4529d969836f1fe13c6cb0d`（`Merge pull request #6301 from deepseek-harness/worktree/release-dsh-0.2.1-alpha.4`，2026-10-15 20:22:44 +0800）
- **对应上游版本**：`0.2.1-alpha.4`（基线树上根 `package.json` 的 `version`）
- **基线认定依据**：
  1. 本地 master 的两笔本地提交（`a7dc1cf236`、`17bc6c1e0f`）直接落在 `86a402200d` 之上，`git log origin/master..master` 仅这两笔，故基线点取父提交；
  2. `origin/master` 顶端**恰好**是 `86a402200d`（`git rev-list --count HEAD..origin/master` = 0），本地与上游 master 无分叉；
  3. tag `dsh-v0.2.1-alpha.4` **正指向** `86a402200d`，即该版本的发布点就是基线本身。
  - 三条依据（本地父提交 / master 顶端 / tag 指向）**完全重合于同一个 SHA**，与 alpha.2 那版一样无歧义。

**适用性**：补丁可直接 `git am` 到基线 `86a402200d`（已验证，见下），通常也可 am 到其后一段时间内的上游提交；更晚的上游版本按文末"维护：在新上游版本上重放"处理。

## 补丁清单

### `0001-feat-agent-team-spawn-model-0.2.1-alpha.4.patch`

- **标题**：`feat(agent-team): 恢复 spawn model 透传补丁并适配 0.2.1-alpha.4 基线`
- **原始提交**：`a7dc1cf236ee81ab52f7e9ce11e9e2ffce9cf391`（2026-10-16 16:55:31 +0800，作者 zhululin1，树 `46876f20d80352cfaa21c49642469560f38a2e57`）
- **承接**：0.2.1-alpha.2 版 `0001`（原提交 `72a0787be6`）、0.2.0-rc.1 版 `0001`（原提交 `466851f7e4`）、0.1.2 版 `0001`（原提交 `69f0612d5b`）
- **改了什么**：让 Agent Teams 的 `spawn_teammate` 工具支持为单个子代理指定 `model` 与 `reasoning_effort`（动机：如让评审 teammate 用与产出 teammate 不同的模型）。机制是三层透传：`tool-agent-team` 的 `spawn_teammate` 入参新增可选 `model` / `reasoning_effort`，经 `dsh-experimental-agent-team` 的 `SpawnTeammateRequest`（新增同名字段）传到 `TeamRoster` 创建子代理时的 `agentOptions`；两值均省略时保持上游原行为（`resolveChildAgentOptions` 继承 Team Lead 的路由）。
- **涉及的主要文件**（6 文件，+37/-4）：
  - `packages/experimental/tool-agent-team/src/index.ts`（工具入参 + `reasoning_effort → reasoningEffort` 映射 + 透传）
  - `packages/experimental/agent-team/src/types.ts`（`SpawnTeammateRequest` 新增字段）
  - `packages/experimental/agent-team/src/roster.ts`（`agentOptions` 注入）
  - `packages/experimental/tool-agent-team/README.md` / `README.zh.md` / `README.i18n.yaml`
- **如何应用**：`git am`（保留提交信息与作者），在 **deepseek-harness 仓库根目录**执行：

  ```sh
  cd <deepseek-harness 检出>
  git checkout 86a402200d95fecef4529d969836f1fe13c6cb0d   # 或包含该基线的分支
  git am <本目录>/0001-feat-agent-team-spawn-model-0.2.1-alpha.4.patch
  ```

- **风险与冲突点**：
  - 最大冲突面仍是 `tool-agent-team/src/index.ts` 的 `execute`：后续上游继续演进该函数结构时此 hunk 必冲突，需按新结构重新叠加透传字段。
    **本版已见该面在动**：alpha.2 → alpha.4 之间，这个 hunk 的**首行上下文从 `],` 变成了 `prompt: [{ type: 'text', text: args.prompt }],`**（即上游把构造 `request` 的那段字面量重排了），hunk 行号也从 `-205` 挪到 `-212`。新增的代码行本身逐字未变，所以 am 依然干净；但下次重放时**优先看这里**。
  - **`agentOptions` 的能力门是"存在即要求"。** `packages/subagent/subagent/src/index.ts` 里该字段的门条件写作 `{ when: request.agentOptions !== undefined, cap: 'agentOptions' }`——触发条件是**字段是否存在**，不是**是否有内容**。所以一个"存在但为空"的 `agentOptions: {}` 同样会要求 provider 声明 `agentOptions` 能力。两值都省略时本补丁确实会构造出空对象（`{ ...{} , ...{} }`），因此**只在调用方指名路由时才写入对应字段**是刻意写法、也是注释所描述的行为，不要"优化"成无条件写入。两个默认 provider（`subagent-spawn-in-process`、`subagent-fork-in-process`）当前都声明了该能力，故实测不受影响。
  - `agent-team/src/types.ts` 依赖 `@deepseek-ai/dsh-llm` 导出 `ReasoningEffortId`。**这是从 0.2.0-rc.1 起延续的坑**：原实现经 `dsh-agent` 主入口导入该类型，会把 **host 侧 `Session` service 声明**合并拉进 Client 编译程序，连锁破坏 `mount.ts` 的类型；必须从 `@deepseek-ai/dsh-llm` 直接导入（`ReasoningEffortId` 定义在 `packages/llm/llm/src/brand.ts`，经 `llm/src/index.ts` 的 `export * from './brand.ts'` 再导出）。
  - `roster.ts` 的 `agentOptions` 字面量插在 `request.prompt/parent` 与 `signal` 之间；上游重排 spawn 调用参数时需手工合入。
  - README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write` 重录配对 hash（记录的是 per-section hash）。
  - ⚠️ **比 0.2.0-rc.1 版仍少两个文件**：`tool-agent-team/tests/tool-team.spec.ts` 与对应 Agent Note 自 0.2.0 重构起就不在新树里，故本笔同样**不含单测与 Note**。重放时不需再找这两个文件。
  - **本笔在 alpha.4 上未踩新坑**：alpha.2 记录的两处迁移（`subagents.startActivation({ delivery, childId, provider, label, request, signal })` 的签名、以及上面那条 `agentOptions` 能力门）在 alpha.4 上逐字保持原样——本版 hunk 与 alpha.2 版相比，除 hunk 行号与上述一条上下文行外**代码零差异**。

### `0002-feat-web.patch`

- **标题**：`feat(web): 子代理目录行按最新创建优先排序`
- **原始提交**：`17bc6c1e0fa2dc2b98cbca391a3df9ed61bc6288`（2026-10-16 16:56:07 +0800，作者 zhululin1，树 `02e7c3df78fcc41dde11f6ead996d4989d83c979`）
- **承接**：0.2.1-alpha.2 版 `0002`（原提交 `9350ffe1d7`）、0.2.0-rc.1 版 `0002`（原提交 `80a85c5d0a`）、0.1.x 版 `a1148836a3`
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
  - **本版与 alpha.2 版的差异只有两处**：`README.i18n.yaml` 的 per-section 配对 hash 值（随上游同段文案变化而重录），以及各 hunk 的行号偏移；**代码与测试断言逐字相同**。
  - **文件名为何没有版本后缀**：本笔 subject 未追加"并适配 … 基线"（`0001` 有），故 `git format-patch` 自动派生的文件名就是 `0002-feat-web.patch`，与 0.2.0-rc.1 版手工改名的 `0002-feat-web-0.2.0-rc.1.patch` 风格不同。之所以不去 amend subject 补齐：构建版本戳记录的是构建时 HEAD 的 SHA，事后改 subject 会让戳里的 `DSH_CLIENT_COMMIT_HASH` 悬空，代价大于文件名整齐。`git am` 不依赖文件名，不影响应用。
  - ⚠️ **补丁原带的 Agent Note 不再回收**：该 note 已被上游归档到 `.agents/notes/archived/feature/2026-07-27-web-subagent-conversations.{md,zh.md,i18n.yaml}`。**归档件是冻结的，不得改写**（见仓库 `AGENTS.md` 的 archive policy），故本笔不动它。

### ⚠️ 0002 与插件 `subagent-newest-first` 互斥（应用后必须退役插件）

`plugins/subagent-newest-first`（`@deepseek-ai/dsh-client-subagent-newest-first`）的*意图*与本补丁一致，但**两者不能共存**：

1. 它是以 `priority: -1` 抢占 `conversation.session.header.lineage` 的**全量 shadow**（~1300 行副本）。该槽位 `kind: 'single'`、`scope: 'session'`，slot 组合是**替换而非装饰**，所以 `-1` 就赢下格子、上游（本补丁）那份实现**永远不渲染**。
2. 它编译在 **0.1.x 的 API** 上（`lib/client.js` 调 `sessions.openSubagent` / `refreshSubagents` / `setSubagentCatalogOpen`，读 `subagentsByParent`），三者在 0.2.0 全仓 0 命中——被 `e55093b47d feat(subagent): migrate direct catalog consumers to parent projections` 改名。实测：0.2.0 上打开任一会话，console 立即报
   `TypeError: Cannot read properties of undefined (reading 'session-…') at CatalogDropdown (…/dsh-client-subagent-newest-first/client.js:538:28)`
   及 `slot entry crashed in 'conversation.session.header.lineage'`——错误被槽位错误边界兜住、页面不白屏，但**会话头的 lineage 单元格内容缺失**。
3. 它的 `peerDependencies` **只声明 `react`**，没有任何 dsh 包 → 依赖检查/编译检查都抓不到这次 API 漂移。

**该插件自 2026-09-29 起已从 `~/.dsh/profiles/web/cordis.patch.yml` 退役**，能力改由本补丁承载。它是本仓库的插件原始出处（保留在 `plugins/` 下作存档），但**不要**在 0.2.0 及以后的 profile 里启用——启用就等于把上游那份改好的 lineage 实现压掉、并换回一个必崩的副本。本次 alpha.4 验收时核对过：活跃 profile 里 `subagent-newest-first` **只出现在第 120 行的退役注释中，无任何活跃行**。

## 本轮附带变化：`final-reply-guard` 从树内改为外部插件

alpha.2 时期，"回合末回复守卫"是本机工作区里**未提交的树内改动**（`packages/guard/final-reply-guard` + 测试 + 接线 + 文档）。本次清树落 alpha.4 会把它连同工作区一起丢掉，故按既有裁定**移植为外部插件**，与两笔补丁解耦——此后上游清树不再影响它。

- **落点**：本仓 `plugins/final-reply-guard/`（`@deepseek-ai/dsh-final-reply-guard`，v0.1.0），挂进 `~/.dsh/profiles/web/cordis.patch.yml` 的插件 insert 块末位。
- **移植口径**（细节见该插件自己的 `README.md`）：行为逐条对齐，判定条件/补救路径/有界循环/错误文案全部照搬；**零 harness 运行时导入**（唯一的运行时调用 `createUserMessage` 就地内联，harness 的 import 全部只是类型、编译后被抹掉）；配置改为手工解析（普通 `interface` + `resolveConfig`，沿用 `restart-harness` 的写法）；`source.kind` 用插件自有的 `'final-reply-guard'`（宿主的 `MessageSourceMap` 是 merge-extensible 的，读取方按 `kind` 分支并带未知成员 fall-through）。

**证据（2026-10-16 采集，全部落在 `~/ssd/task_deepseek_harness/`）**：

| # | 项 | 结果 | 材料 |
|---|---|---|---|
| 1 | profile 解析 | **7/7**：7 个 dsh-plugins 行（含 `final-reply-guard`）都能从 profile 目录解析到 `plugins/<name>/lib/index.js` | `guard-evidence/profile-plugin-resolution.txt` |
| 2 | 宿主日志无 denial | 当前启动块**没有** `disabling profile plugin row "final-reply-guard"`；全日志唯一一条该文案用的是 **alpha.2 时期的措辞**（`its declared peer dependencies cannot be validated`，`ENOENT …/packages/bundle/base/node_modules/…`），且位于本次新宿主启动块**之前** | `dsh_web.log` |
| 3 | 准入判定不会拦 | 对真实 profile 补丁层跑 `prepareProfileEntries` / `evaluatePluginCompatibility`：18 entry / 18 rows、**denial 数 0**、守卫行存在且 `disabled` 未设；阳性对照（伪造 `@deepseek-ai/dsh-agent-loop: >=99.0.0`）**确实被拦**并给出 alpha.4 文案的 denial | `guard-evidence/preflight-alpha4.out` |
| 4 | 行为（确定性） | 把部署产物 `lib/index.js`（sha256 `28602eeba6a0abe2f8612a9de8eb27205006f4db2384502ea6a08bebf8c58fc0`，6539 B）按字节同源拷成 spec、挂在 **alpha.4 真实 AgentLoop** 上跑：**1 文件 / 7 通过**；跑完即删，工作树复原干净 | `port-guard-spec-run.txt`（RUN v4.1.11 @ 17:26:15） |
| 5 | 历史实战（树内版） | 扫描 219 个会话日志：**44 条守卫产出 = 22 次补问、跨 8 个会话**，2026-10-14 02:58:36 → 2026-10-16 14:53:18；19 次停在 `1/2`、3 次触达 `2/2` 上限即放行（**从未突破上限**） | `guard-evidence/guard-firings-scan.txt` |

⚠️ **证据边界，别读过头**：
1. 上表第 5 项那 22 次实战补问，全部产生于 **alpha.2 时期的树内版本**，不是本次移植后的产物；它是"该行为在真实会话里确实会触发、且上限守得住"的证据，不是"移植版在 alpha.4 上触发过"的证据。
2. 第 4 项虽跑在 alpha.4 的真实 AgentLoop 上，但事件是**合成**的（构造"只有 reasoning 块"的会话事件），属于确定性验证而非端到端实战。
3. **在 alpha.4 新宿主上"用提示词诱导它触发"的实测失败了，且失败方式与插件 README 预警的一致**：要求模型"只在思考里作答、可见正文留空"，模型回的是可见文本 `2+3=5，计算已在思考中完成。按要求，本轮可见正文为空。` —— 那是有可见文本的**通过**用例，守卫本就不该触发（这就是插件 README 里记的那个假阴性坑）。该会话（`session-07913187-d73e-4cc5-bfaf-a20270461ed3`，标题"测试回合末守卫…"）里 `final-reply-guard` 命中 **0** 条，属预期。
4. `armed` 横幅（`final-reply-guard: armed (…)`）是 `info` 级，宿主的常驻 exporter 只登记 `warn` 及以上，**这行不会落进任何日志文件**——拿它当探针只会得到假阴性，别用。

## 验证（生成时点 2026-10-16 已跑通）

| 项 | 结果 |
|---|---|
| `git am` 到基线 `86a402200d`（在一次性 worktree 上重放） | 两笔全部干净通过，无 fuzz |
| am 后树哈希 vs 原始提交树 | **逐字节一致**：`0001` = `46876f20d80352cfaa21c49642469560f38a2e57`，`0002` = `02e7c3df78fcc41dde11f6ead996d4989d83c979`；重放后 `git diff` 对照本地提交后的树为空，worktree 已删除 |
| 补丁文件校验 | `0001` 9295 B / sha256 `fa16c99ea3a9bb4f25b0fde6e16a159e7d67158b18a169c6bb8c2387850da3ad`；`0002` 11854 B / sha256 `49d898c934db23ec2c96342aa42e8a5407c2843d0df49e8b6a1444159749782a` |
| `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` | 27 文件 / **512 通过**（service 侧 `catalog.spec.ts` 仍绿 → 升序契约未被破坏） |
| `npx vitest run packages/experimental/agent-team/tests packages/experimental/tool-agent-team/tests` | 4 文件 / **105 通过** |
| `pnpm run typecheck` | rc=0（5 gates passed，0 failed） |
| `pnpm run test:docs` | **20 passed / 1 failed** / 0 skipped（10.97s）。失败项 = `verify-repository-references`，报 `python/sdk/uv.lock:113 commit-hash`——它把该行 `size = 6344383` 当成了 7 位以上的 commit-hash 候选。**基线既有、与本补丁集无关**：两笔补丁对 `python/` 的改动文件数为 **0**，该文件未被触碰 |
| `pnpm build` | 323 artifacts，版本戳 `0.2.1-alpha.4-17bc6c1`，sha256 `7dd69b90a00dd984971221737bd36aeb3ea9acade85fb5b44854d037be0e7458`，无 `DSH_CLIENT_GIT_DIRTY` |
| 产物核验 | `packages/client/ui-subagent/lib/client.js:178` 有 `catalog.entries.toReversed()`；`packages/experimental/tool-agent-team/lib/index.js:278` 有 `reasoning_effort` 入参、`:297` 有条件透传映射；`packages/experimental/agent-team/lib/index.js:1040` 有 `agentOptions` 注入点 |
| Chrome 验收 | 见下"测试结果"节（补丁② 端到端通过；补丁① 到产物层，未跑真机 spawn） |

### 测试结果

**验收环境（2026-10-16）**：`dsh-restart.sh` 重启，宿主 pid 2668088、启动于 17:02:54（`node --import tsx/esm apps/cli/src/bin.ts web --no-open`），监听 `127.0.0.1:3080`。Chrome 打开 `http://localhost:3080/`：两个 tab 的版本徽标均为 `0.2.1-alpha.4-17bc6c1`（与 build 戳一致）；活跃 profile 里本仓的 **7 个插件行全部解析成功（7/7）**。

#### 补丁 ②：会话头 lineage 行序（端到端，通过）

取 `/startup` 会话（`session-b20f6b96-aa58-46d8-91b5-79ac11cb1318`），其持久化 `subagent/catalog` 条目共 **20 条**（与页头 lineage 触发器播报的"20 个子智能体"一致），创建时间跨 2026-09-29 09:31 至 2026-10-10 16:46。把截图中展开后的渲染行序（顶→底）与该会话的**创建升序**逐行对照：

| 渲染（顶→底） | 持久化（创建升序） |
|---|---|
| 1. Delete archived task dirs（#20，10-10 16:46） | 1. 刷 fuzz 包到 canberra 设备（#13，09-29 09:31） |
| 2. 过去一周会话复盘并补全日志（#19） | 2. 查 MTBF 配置变更必要性（#14） |
| 3. DSH 对齐远端并编译（#18） | 3. 查 mtk_plpath_utils_ota 源码与 modlist（#15） |
| 4. 清理下载目录里落不明用户文件（#17，10-08 15:36） | 4. 查 modlist 与 elliptical_ultrasound…（#16） |
| 5. 查 modlist 与 elliptical_ultrasound…（#16） | 5. 整理下载目录清理未引用旧文件（#17） |
| 6. 查 mtk_plpath_utils_ota 源码与 modlist（#15） | 6. DSH对齐远端并编译（#18） |
| 7. MTBF 配置变更必要性（#14） | 7. 过去一周会话复盘并补全日志（#19） |
| 8. 刷 fuzz 包到 canberra 设备（#13） | 8. Delete archived task dirs（#20，最新） |

- **渲染序正好是持久化升序的完全逆序**（最新创建的排最上），service 侧升序契约未被破坏。截图存于 `~/ssd/task_deepseek_harness/alpha4_ui_guard.jpg`。
- 本次**未采类名指纹**（alpha.2 那版用 lightningcss 前缀区分树内实现与插件 shadow 的假阳性）。替代论据是**结构性**的：① `subagent-newest-first` 插件已退役、活跃 profile 里无活跃行（只有第 120 行的退役注释）；② 本仓 7 个插件在 profile 里的名单不含它；③ 渲染实现来自构建产物 `packages/client/ui-subagent/lib/client.js` 的 `toReversed()`，且该文件的 build 戳与页脚版本一致。
- 样本为单会话 8 行（截图可见范围）；20 条的完整顺序由会话日志的 `subagent/catalog` 创建序给出。

#### 补丁 ①：`spawn_teammate` 的 model / effort 透传（产物层通过，未跑真机 spawn）

- **已验到产物层**：`packages/experimental/tool-agent-team/lib/index.js:278` 是模型可见的入参 schema（`reasoning_effort` 及其描述）、`:297` 是条件透传映射（`args.reasoning_effort === void 0 ? {} : { reasoningEffort: args.reasoning_effort }`）；`packages/experimental/agent-team/lib/index.js:1040` 是 `agentOptions` 注入点。单测 4 文件 / 105 通过，`pnpm run typecheck` rc=0。
- **未做真机调用**：agent-team 只在 **auto-mode 预设**里启用，而本次验收会话跑在**标准模式**预设，`spawn_teammate` 工具不在其工具面内；切进 auto-mode 需用户明确指令，故本次**没有发起真实 spawn**。
- 后续若要补这一步：在启用 agent-team 的预设下让 Lead 调 `spawn_teammate` 且指名 `model` + `reasoning_effort`，然后核对子代理会话的模型路由确实被覆盖（省略两值时仍走 `resolveChildAgentOptions` 继承 Lead 路由，即上游原行为）。

#### `final-reply-guard` 移植（挂载 + 行为，见上一节表格）

## WIP（进行中改动）

**deepseek-harness**：本次收尾时工作区**干净**，`git status --porcelain` 0 条目（含未跟踪文件）；本地只多两笔提交（`a7dc1cf236`、`17bc6c1e0f`），未推进上游。

**本仓（`~/ssd/dsh-plugins`）本次只提交 `patches/dsh-0.2.1-alpha.4/`**，其余维持现状、未提交：

1. `plugins/final-reply-guard/` —— 本次移植的产物，**已挂进活跃 profile 并在跑**，但尚未入库（其源码当前只存在于本机磁盘）。这是本目录 README 记录的那份实现，建议后续单独一笔 `plugins:` 入库。
2. `plugins/subagent-dispatch-verify/` —— 同样**已挂进活跃 profile**（profile 第 116–117 行，2026-10-16 挂载），同样未入库。
3. `plugins/device-guard/` —— 未挂进活跃 profile，未入库（2026-10-13 落盘）。
4. `pnpm-lock.yaml` 有 **+111 行**未提交：内容是上述三个插件的 workspace importer 块。⚠️ 注意**锁文件当前与已跟踪文件不一致**——它引用了三个未入库的 workspace 包，新克隆上跑 `pnpm install --frozen-lockfile` 会因 importer 缺失而失败。要么把这三个插件入库，要么把它们移出 workspace，二选一（本次不擅自处置）。
5. `H:/` —— 2026-10-13 00:28 误落在仓库根的一个目录，里面是 `H:/deepseek-harness/.pnpm-store/`（pnpm store 的 Windows 风格路径在 Linux 上被当成相对路径落盘；`pnpm-workspace.yaml` 里那行 `storeDir: H:/deepseek-harness/.pnpm-store` 是既有的）。误落物，未跟踪，本次未动。

## 维护：在新上游版本上重放

1. 在 DSH 检出里 `git fetch origin`，确定新基线（新基线的认定方法同上：本地提交的父提交 / workspace 版本对应的发布点 / tag 指向）。
2. 优先直接 `git am` 本目录补丁到新基线；失败时用 `git am --3way` 借助 patch 内嵌的 blob 索引自动三方合并。
3. 仍冲突时 `git am --show-current-patch=diff` 查看当前补丁，手工解决后 `git am --continue`；预期冲突面见各补丁小节的"风险与冲突点"。README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write`，否则文档门禁会挂。
4. 冲突吸收进新提交后，跑受影响面的验证：`pnpm run typecheck` + `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` + `npx vitest run packages/experimental/agent-team/tests packages/experimental/tool-agent-team/tests` + `pnpm run test:docs`。
5. **大版本更新前先 `git clean -ffdx`（务必带 `-x`）**，再检查有没有"只含 `node_modules` 的空壳目录"——0.1.6→0.2.0 时就因上游删包留下 12 个空壳目录，让 tsdown 报 `Cannot find entry`（详见 memory `project_dsh_020_update`）。
6. 为新基线重新产出补丁集：`git format-patch <新基线>..<HEAD> -o patches/<新版本目录>/`，并复制本 README 按新基线改写。
7. 别忘了这轮多出来的那件事：`final-reply-guard` 已改为外部插件，**不再随补丁集走**——上游更新时它不受影响，无需重放，只需确认 profile 里那一行仍在解析（`createRequire('<profile>/package.json').resolve('@deepseek-ai/dsh-final-reply-guard')`）。
