# DSH 本地侵入式修改补丁集 — 0.2.0-rc.1 基线

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 0.2.0-rc.1 基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（0.1.2-rc.1 基线）见 `../dsh-0.1.2-rc.1/`。两版**不是增量关系**——0.1.6 → 0.2.0 跨大版本，中间隔了 3106 个提交，两笔补丁都是在新基线上**重做**的，不是 `cherry-pick` 过来的。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`4878cdabd87d4041bdaff61d04c966883b9fd07a`（`release(dsh): 0.2.0-rc.1 (#5387)`，2026-09-28，作者 imccyu）
- **对应上游版本**：`0.2.0-rc.1`（基线树上根 `package.json` 的 `version`）
- **基线认定依据**：
  1. 本地 master（`80a85c5d0a`）的父提交即 `4878cdabd8`，`git log origin/master..master` 仅两笔本地提交，故基线点取父提交；
  2. `origin/master` 顶端**恰好**是 `4878cdabd8`（`git rev-list --count 4878cdabd8..origin/master` = 0），本地与上游 master 无分叉；
  3. tag `dsh-v0.2.0-rc.1` **正指向** `4878cdabd8`，即 0.2.0-rc.1 的发布点就是基线本身。
  - 这一版比 0.1.2 那版清爽：那次 tag 是发布点、但 master 在发布后又前进了约 99 条，基线只能取 master 顶端；这次 tag 与 master 顶端重合，基线无歧义。

**适用性**：补丁可直接 `git am` 到基线 `4878cdabd8`（已验证，见下），通常也可 am 到其后的一段时间内的上游提交；更晚的上游版本按文末"维护：在新上游版本上重放"处理。

## 补丁清单

### `0001-feat-agent-team-spawn-model-0.2.0-rc.1.patch`

- **标题**：`feat(agent-team): 恢复 spawn model 透传补丁并适配 0.2.0-rc.1 基线`
- **原始提交**：`466851f7e40087a7fc3d87ab7d5dd83c80cddebf`（2026-09-29，作者 zhululin1）
- **承接**：0.1.2 版 `0001`（原提交 `69f0612d5b`）
- **改了什么**：让 Agent Teams 的 `spawn_teammate` 工具支持为单个子代理指定 `model` 与 `reasoning_effort`（动机：如让评审 teammate 用与产出 teammate 不同的模型）。机制是三层透传：`tool-agent-team` 的 `spawn_teammate` 入参新增可选 `model` / `reasoning_effort`，经 `dsh-experimental-agent-team` 的 `SpawnTeammateRequest`（新增同名字段）传到 `TeamRoster` 创建子代理时的 `agentOptions`；两值均省略时保持上游原行为（`resolveChildAgentOptions` 继承 Team Lead 的路由）。
- **涉及的主要文件**（6 文件，+37/-4）：
  - `packages/experimental/tool-agent-team/src/index.ts`（工具入参 + `reasoning_effort → reasoningEffort` 映射 + 透传）
  - `packages/experimental/agent-team/src/types.ts`（`SpawnTeammateRequest` 新增字段）
  - `packages/experimental/agent-team/src/roster.ts`（`agentOptions` 注入）
  - `packages/experimental/tool-agent-team/README.md` / `README.zh.md` / `README.i18n.yaml`
- **如何应用**：`git am`（保留提交信息与作者），在 **deepseek-harness 仓库根目录**执行：

  ```sh
  cd <deepseek-harness 检出>
  git checkout 4878cdabd87d4041bdaff61d04c966883b9fd07a   # 或包含该基线的分支
  git am <本目录>/0001-feat-agent-team-spawn-model-0.2.0-rc.1.patch
  ```

- **风险与冲突点**：
  - 最大冲突面仍是 `tool-agent-team/src/index.ts` 的 `execute`：后续上游继续演进该函数结构时此 hunk 必冲突，需按新结构重新叠加透传字段。
  - `agent-team/src/types.ts` 依赖 `@deepseek-ai/dsh-llm` 导出 `ReasoningEffortId`。**这是本笔重做时踩到的坑**：原实现经 `dsh-agent` 主入口导入该类型，会把 host 侧 `SessionStore` 声明合并拉进 `client-ui-agent-team` 的 Client 编译程序导致 typecheck 错型；必须从 `@deepseek-ai/dsh-llm` 直接导入。
  - `roster.ts` 的 `agentOptions` 字面量插在 `request.prompt/parent` 与 `signal` 之间；上游重排 spawn 调用参数时需手工合入。
  - README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write` 重录配对 hash（0.2.0 起记录的是 per-section hash）。
  - ⚠️ **比 0.1.2 版少了两个文件**：`tool-agent-team/tests/tool-team.spec.ts` 与 `.agents/notes/.../2026-09-02-agent-teams-spawn-model.*` 已**随 0.2.0 重构消失**（对应测试与 Agent Note 均不在新树里），故本笔不含单测与 Note。重放时不需再找这两个文件。

### `0002-feat-web-0.2.0-rc.1.patch`

- **标题**：`feat(web): 子代理目录行按最新创建优先排序并适配 0.2.0-rc.1 基线`
- **原始提交**：`80a85c5d0a7f650f3027ba64aa12c677ac4999dc`（2026-09-29，作者 zhululin1）
- **承接**：0.1.x 版 `a1148836a3`（本次重建时该版本文档未随归档，见下"与插件的互斥关系"）
- **改了什么**：会话头 lineage 下拉里的子代理目录行改为**最新创建排在最上**。实现只在**呈现层**反转：`CatalogRows` 内 `catalog.entries.map(...)` → `catalog.entries.toReversed().map(...)`，并把反转后的数组复用于 `reserveDisclosure` 的计算。service 侧 `packages/subagent/subagent/src/catalog.ts` 的**创建升序契约原样不动**（`subagentCatalogEntries()` 的 `@returns` 明确写着 creation order），沿升序到达、以反转呈现。
- **涉及的主要文件**（8 文件，+38/-19）：
  - `packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx`（呈现层反转）
  - `packages/client/ui-subagent/tests/conversation-ui.client.spec.tsx`（新增 `renders catalog rows newest-created first`；键盘遍历期望同步改动 ArrowDown→`reviewer`、End→`worker`、Home→`reviewer`、ArrowUp→`worker`）
  - `packages/client/ui-subagent/README.md` / `README.zh.md` / `README.i18n.yaml`
  - `.agents/notes/implemented/feature/2026-07-27-web-subagent-conversations.md` / `.zh.md` / `.i18n.yaml`
- **如何应用**：同 `0001`，`git am` 到同一基线即可（两笔按序应用）：

  ```sh
  git am <本目录>/0001-*.patch <本目录>/0002-*.patch
  ```

- **风险与冲突点**：
  - `SubagentHeaderLineage.tsx` 的 `CatalogRows` 是上游活跃演进区（0.2.0 刚把叶子判定挪到 `isKnownLeaf(catalogs[entry.id])`），上游再动这块会冲突。
  - 测试 fixture 形状与 0.1.x 不同：0.2.0 的 `SubagentCatalogRow` **已无 `kind` / `hasChildren`**，旧补丁的 fixture 不可用，须按 `control-types.ts` 重写。另有一处刻意偏差——`newest` 那条设为 `inactive` 而非 `running`，因为触发器在有子代理运行时 `aria-label` 播报的是**运行数**（`{count} 个子智能体，正在运行`）而非总数，`running` 会让 `getByRole('button', { name: /3 个子智能体/ })` 选不中。行为断言不变。
  - README / Agent Note 的 i18n 三件套改完同样要 `pnpm run verify-translation-pairing --write`。

### ⚠️ 0002 与插件 `subagent-newest-first` 互斥（应用后必须退役插件）

`plugins/subagent-newest-first`（`@deepseek-ai/dsh-client-subagent-newest-first`）的*意图*与本补丁一致，但**两者不能共存**：

1. 它是以 `priority: -1` 抢占 `conversation.session.header.lineage` 的**全量 shadow**（~1300 行副本）。该槽位 `kind: 'single'`、`scope: 'session'`，slot 组合是**替换而非装饰**，所以 `-1` 就赢下格子、上游（本补丁）那份实现**永远不渲染**。
2. 它编译在 **0.1.x 的 API** 上（`lib/client.js` 调 `sessions.openSubagent` / `refreshSubagents` / `setSubagentCatalogOpen`，读 `subagentsByParent`），三者在 0.2.0 全仓 0 命中——被 `e55093b47d feat(subagent): migrate direct catalog consumers to parent projections` 改名。实测：0.2.0 上打开任一会话，console 立即报
   `TypeError: Cannot read properties of undefined (reading 'session-…') at CatalogDropdown (…/dsh-client-subagent-newest-first/client.js:538:28)`
   及 `slot entry crashed in 'conversation.session.header.lineage'`——错误被槽位错误边界兜住、页面不白屏，但**会话头的 lineage 单元格内容缺失**。
3. 它的 `peerDependencies` **只声明 `react`**，没有任何 dsh 包 → 依赖检查/编译检查都抓不到这次 API 漂移。

**故 2026-09-29 起该插件已从 `~/.dsh/profiles/web/cordis.patch.yml` 退役**，能力改由本补丁承载。它是本仓库的插件原始出处（保留在 `plugins/` 下作存档），但**不要**在 0.2.0 及以后的 profile 里启用——启用就等于把上游那份改好的 lineage 实现压掉、并换回一个必崩的副本。

## 验证（生成时点 2026-09-29 已跑通）

| 项 | 结果 |
|---|---|
| `git apply --check` / `git am` 到基线 `4878cdabd8` | 干净通过，无 fuzz |
| am 后树哈希 vs 原始提交树 | **逐字节一致**：`0001` = `6fe7f44a547ae58beef496e05d42121e9766b911`，`0002` = `feefb956079397ef4a2cbd438a2689f3c20eda42` |
| `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` | 18 文件 / 375 通过（service 侧 `catalog.spec.ts` 仍绿 → 升序契约未被破坏） |
| `npx vitest run packages/client/ui-subagent/tests/conversation-ui.client.spec.tsx` | 40/40 |
| `pnpm run typecheck` | rc=0 |
| `pnpm run test:docs` | 20 passed / 0 failed |
| `pnpm build` | 347 artifacts，版本戳 `80a85c5` / `0.2.0-rc.1`，无 `DSH_CLIENT_GIT_DIRTY` |
| 产物核验 | `packages/client/ui-subagent/lib/client.js` 含 `entries.toReversed()`；`agent-team/lib/index.js:580-583` 有 `agentOptions` 透传；`agent-team/lib/types/types.d.ts:157` 有 `readonly reasoningEffort?: ReasoningEffortId`；`tool-agent-team/lib/index.js:300` 有 `reasoning_effort → reasoningEffort` 映射 |
| Chrome 验收 | 刷新后 console **0 异常**；页头 lineage 恢复渲染（`<nav aria-label="会话层级">` + `<button aria-label="3 个子智能体">`，类名前缀 `S74kaa_*` 即仓内实现，非插件副本的 `FNT7jW_*`）；展开后行序与日志 `subagent/catalog` 事件升序（seq 70→72）**正好相反** |

## WIP（进行中改动）

盘点时点（2026-09-29）deepseek-harness 工作区**干净**，`git status` 0 条目（含未跟踪文件）。`~/ssd/dsh-plugins` 同期未跟随更新，维持现状。

## 维护：在新上游版本上重放

1. 在 DSH 检出里 `git fetch origin`，确定新基线（新基线的认定方法同上：本地提交的父提交 / workspace 版本对应的发布点 / tag 指向）。
2. 优先直接 `git am` 本目录补丁到新基线；失败时用 `git am --3way` 借助 patch 内嵌的 blob 索引自动三方合并。
3. 仍冲突时 `git am --show-current-patch=diff` 查看当前补丁，手工解决后 `git am --continue`；预期冲突面见各补丁小节的"风险与冲突点"。README / Agent Note 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write`，否则文档门禁会挂。
4. 冲突吸收进新提交后，跑受影响面的验证：`pnpm run typecheck` + `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` + `pnpm run test:docs`。
5. **大版本更新前先 `git clean -ffdx`（务必带 `-x`）**，再检查有没有"只含 `node_modules` 的空壳目录"——0.1.6→0.2.0 时就因上游删包留下 12 个空壳目录，让 tsdown 报 `Cannot find entry`（详见本仓库 memory `project_dsh_020_update`）。
6. 为新基线重新产出补丁集：`git format-patch <新基线>..<HEAD> -o patches/<新版本目录>/`，并复制本 README 按新基线改写。
