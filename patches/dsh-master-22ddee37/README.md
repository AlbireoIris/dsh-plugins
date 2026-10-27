# DSH 本地侵入式修改补丁集 — master@22ddee37 基线

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 master 顶端基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（0.2.1-rc.2 基线）见 `../dsh-0.2.1-rc.2/`。两版**不是增量关系**——rc.2 → 本基线中间隔了 **1539 个提交**，两笔补丁都是在新基线上**重做**的，不是 `cherry-pick` 过来的。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`22ddee3792`（`Merge pull request #7075 from deepseek-harness/worktree-chatgap`，2026-10-23 19:48 +0800）
- **对应上游版本**：基线树上 `packages/*` 的 `version` 均为 `0.2.1-rc.3`（构建戳自报 `0.2.1-rc.3`），但**本基线不是 rc.3 tag**——tag `dsh-v0.2.1-rc.3` 指向 `1f81c047fc`（rc.2 之后第 6 个提交），本基线在其之后又推进了 **1533 个提交**。
- **基线认定依据**：
  1. 本地 master 的两笔本地提交（`02e1353301`、`a24711a4d8`）直接落在 `22ddee3792` 之上，`git log 22ddee3792..master` 仅这两笔，故基线点取父提交；
  2. `22ddee3792` 是重放当时（2026-10-27）`origin/master` 的顶端，本地与上游 master 无分叉；
  3. 构建戳 `DSH_CLIENT_COMMIT_HASH=a24711a` 与本地 HEAD 短哈希一致，证明构建产物确实出自"基线+两笔补丁"这棵树。
- **目录命名说明**：既有惯例是 `dsh-<版本>`（基线恰好都是 tag）。本基线**不是 tag**，而自报版本 `0.2.1-rc.3` 与真实存在的 rc.3 tag（`1f81c047fc`）又差 1533 个提交，叫 `dsh-0.2.1-rc.3` 会误导成"补丁打在 rc.3 tag 上"。故按提交命名 `dsh-master-22ddee37`，以 SHA 为准。

**适用性**：补丁可直接 `git am` 到基线 `22ddee3792`（已验证零冲突，见下），通常也可 am 到其后一段时间内的上游提交；更晚的上游版本按文末"维护：在新上游版本上重放"处理。

### 本轮跨度与兼容性预判（事后核对）

- **跨度**：`687f282e86..22ddee3792` = 1539 个提交。中间经过 `dsh-v0.2.1-rc.3`（`1f81c047fc`，rc.2 后第 6 个）发布点。
- **补丁触碰面在上游的改动**：
  - 补丁① 三个源码文件（`tool-agent-team/src/index.ts`、`agent-team/src/types.ts`、`agent-team/src/roster.ts`）在 1539 个提交里**零改动** → 重放零冲突（实际也零冲突）。
  - 补丁② 两个文件**有改动**：`SubagentHeaderLineage.tsx`（+50/−45 规模）与 `conversation-ui.client.spec.tsx`（+63/−45 规模）——但改动落在补丁 hunk 上下文之外，`git am` 仍**零冲突**干净落地；测试文件 hunk 偏移 275→276、316→317、1019→1034。
- **语义安全性复核**（上游动过 `SubagentHeaderLineage.tsx`，必须排除"上游自己也加了排序反转、补丁叠上去变成双重反转"）：基线 `22ddee3792` 的 `CatalogRows` 仍直接迭代 `catalog.entries`（无任何排序反转），反转**只有我们这一份**；构建产物 `ui-subagent/lib/client.js` 全文件 `toReversed` **仅 1 处**。上游对该文件的演进集中在 props 形状（`CatalogRowsProps` 新增 `openChildAside` / `refreshProjection` / `toggleBranch` / `closeCatalog` 等），与行序无关。

## 补丁清单

### `0001-feat-agent-team-spawn-model-master-22ddee37.patch`

- **标题**：`feat(agent-team): 恢复 spawn model 透传补丁并适配 master@22ddee37 基线`
- **本轮提交**：`02e1353301d8d8019247c9f2aa6c31349c027648`（作者 zhululin1，树 `b73d5378f62efca47e4dd14fb111cc810b2e36a4`）
- **承接**：rc.2 版 `0001`（提交 `bc7752bbec`）、alpha.4 版 `0001`（`a7dc1cf236`）、alpha.2 版 `0001`（`72a0787be6`）、0.2.0-rc.1 版 `0001`（`466851f7e4`）、0.1.2 版 `0001`（`69f0612d5b`）
- **改了什么**：让 Agent Teams 的 `spawn_teammate` 工具支持为单个子代理指定 `model` 与 `reasoning_effort`。机制是三层透传：`tool-agent-team` 的 `spawn_teammate` 入参新增可选 `model` / `reasoning_effort`，经 `dsh-experimental-agent-team` 的 `SpawnTeammateRequest`（新增同名字段）传到 `TeamRoster` 创建子代理时的 `agentOptions`；两值均省略时保持上游原行为（`resolveChildAgentOptions` 继承 Team Lead 的路由）。
- **涉及的主要文件**（6 文件，+37/−4）：
  - `packages/experimental/tool-agent-team/src/index.ts`（工具入参 + `reasoning_effort → reasoningEffort` 映射 + 透传）
  - `packages/experimental/agent-team/src/types.ts`（`SpawnTeammateRequest` 新增字段）
  - `packages/experimental/agent-team/src/roster.ts`（`agentOptions` 注入）
  - `packages/experimental/tool-agent-team/README.md` / `README.zh.md` / `README.i18n.yaml`
- **如何应用**：`git am`（保留提交信息与作者），在 **deepseek-harness 仓库根目录**执行：

  ```sh
  cd <deepseek-harness 检出>
  git checkout 22ddee3792   # 或包含该基线的分支
  git am <本目录>/0001-feat-agent-team-spawn-model-master-22ddee37.patch
  ```

- **风险与冲突点**：
  - 最大冲突面仍是 `tool-agent-team/src/index.ts` 的 `execute`：后续上游继续演进该函数结构时此 hunk 必冲突，需按新结构重新叠加透传字段。本轮该处上游未动。
  - **`agentOptions` 的能力门是"存在即要求"。** `packages/subagent/subagent/src/index.ts` 里该字段的门条件写作 `{ when: request.agentOptions !== undefined, cap: 'agentOptions' }`——触发条件是**字段是否存在**，不是**是否有内容**。两值都省略时本补丁确实会构造出空对象，因此**只在调用方指名路由时才写入对应字段**是刻意写法，不要"优化"成无条件写入。两个默认 provider（`subagent-spawn-in-process`、`subagent-fork-in-process`）当前都声明了该能力，故实测不受影响。
  - `agent-team/src/types.ts` 依赖 `@deepseek-ai/dsh-llm` 导出 `ReasoningEffortId`。**这是从 0.2.0-rc.1 起延续的坑**：必须从 `@deepseek-ai/dsh-llm` 直接导入（定义在 `packages/llm/llm/src/brand.ts`），经 `dsh-agent` 主入口导入会把 host 侧 `Session` service 声明拉进 Client 编译程序，连锁破坏 `mount.ts`。
  - `roster.ts` 的 `agentOptions` 字面量插在 `request.prompt/parent` 与 `signal` 之间；上游重排 spawn 调用参数时需手工合入。
  - README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write` 重录配对 hash。
  - ⚠️ 自 0.2.0 重构起，本笔**不含单测与 Agent Note**。
  - **本笔代码跨版本逐字未变（第四轮确认）**：alpha.2 → alpha.4 → rc.2 → 本版，补丁 diff body **逐字节一致**（与 rc.2 版 `diff` 比对为空）；本轮文件大小 9289 B → 9315 B 的差异**全部来自提交信息**（基线名改写），代码零差异。

### `0002-feat-web.patch`

- **标题**：`feat(web): 子代理目录行按最新创建优先排序`
- **本轮提交**：`a24711a4d81fdb4e1b5e9027ec59be5f2f97fbaa`（作者 zhululin1，树 `881c6ac7045c0d681028b6bbec78e85c956d79c2`）
- **承接**：rc.2 版 `0002`（提交 `6e80f60415`）、alpha.4 版 `0002`（`17bc6c1e0f`）、alpha.2 版 `0002`（`9350ffe1d7`）、0.2.0-rc.1 版 `0002`（`80a85c5d0a`）、0.1.x 版 `a1148836a3`
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
  - `SubagentHeaderLineage.tsx` 的 `CatalogRows` 是上游活跃演进区——本轮上游就动了它（props 形状扩展），只是恰好没碰补丁 hunk 的上下文，下一轮未必这么走运。
  - 测试 fixture 形状与 0.1.x 不同：`SubagentCatalogRow` 已无 `kind` / `hasChildren`。另有一处**刻意偏差**——`newest` 那条设为 `inactive` 而非 `running`，因为触发器在有子代理运行时 `aria-label` 播报的是**运行数**而非总数。行为断言不变。
  - README 的 i18n 三件套改完同样要 `pnpm run verify-translation-pairing --write`。
  - **本版与 rc.2 版代码逐字相同**：与 rc.2 版 diff 比对，差异**只有 blob index 哈希与测试文件 hunk 偏移**（275→276、316→317、1019→1034，由上游对该文件的新增行引起），增删行零差异。
  - **文件名为何没有版本后缀**：本笔 subject 未追加"并适配 … 基线"（`0001` 有），故 `git format-patch` 自动派生的文件名就是 `0002-feat-web.patch`。
  - ⚠️ **补丁原带的 Agent Note 不再回收**：该 note 已被上游归档到 `.agents/notes/archived/feature/2026-07-27-web-subagent-conversations.{md,zh.md,i18n.yaml}`。**归档件是冻结的，不得改写**。

### 关于两笔提交的时间戳

本轮是"新基线上重做"：两笔提交用 `git commit-tree` 按原树 + 原 author 身份/日期重建（`git rebase -i` 在本机不可用），因此 **author date 仍是 2026-10-16 16:55/16:56**，早于基线合并时间（10-23 19:48）。这是**刻意保留**——目的是让补丁身份（作者、日期）跨版本连续，便于追溯；提交内容以树哈希为准。

### ⚠️ 0002 与插件 `subagent-newest-first` 互斥（应用后必须退役插件）

`plugins/subagent-newest-first`（`@deepseek-ai/dsh-client-subagent-newest-first`）的*意图*与本补丁一致，但**两者不能共存**（它 `priority: -1` 全量 shadow 单值槽位 `conversation.session.header.lineage`，且编译在 0.1.x API 上，0.2.x 开会话即抛 TypeError）。**该插件自 2026-09-29 起已从 `~/.dsh/profiles/web/cordis.patch.yml` 退役**，能力改由本补丁承载。本轮验收时核对过：活跃 profile 组合树中 `subagent-newest-first` **无任何条目**（dump-config 全树 0 命中）。

## 与 `final-reply-guard` 的关系：本轮无变化

"回合末回复守卫"自 alpha.4 那轮起已**移植为外部插件**（本仓 `plugins/final-reply-guard/`，`@deepseek-ai/dsh-final-reply-guard` v0.1.0），与补丁集解耦。本轮升级**不涉及它**：清树只清 deepseek-harness 仓库，插件源码在本仓、profile 挂载在 `~/.dsh/profiles/web/cordis.patch.yml`，均未被触及。

本轮对它的复核（2026-10-27 实测）：

| 项 | 结果 |
|---|---|
| profile 解析 | 守卫行仍在组合树中（`--dump-config` 输出含 `id: final-reply-guard`），`createRequire('<profile>/package.json').resolve('@deepseek-ai/dsh-final-reply-guard')` 解析成功（补丁层 21/21 包 id 全部可解析） |
| 组合树 | 全树 **215** 个 id 条目；抽查 13 个本机插件 id（含本仓 7 个）**全部在树** |
| denial | `dump-config` stderr 与宿主启动日志中 denial / incompatible **0 命中** |
| 宿主日志 | 新宿主启动块无任何插件加载错误（`ERR_MODULE_NOT_FOUND` / `denial` / `incompatible` 扫描为空） |

## 验证（生成时点 2026-10-27 已跑通）

| 项 | 结果 |
|---|---|
| `git am` 到基线 `22ddee3792` | 两笔全部干净通过，**零冲突零 fuzz** |
| 提交信息基线名改写 | `git commit-tree` 重建，保留原树与原 author 身份/日期；新提交 `02e1353301`（树 `b73d5378f6…`）、`a24711a4d8`（树 `881c6ac704…`） |
| 补丁文件校验 | `0001` 9315 B / sha256 `eab4990bf2addab338eec6489ae99653f41d2774d8dfb210c17716596a5b8fa2`；`0002` 11854 B / sha256 `ab56ecee8d3f2e6f031f3b76f5df4a6408ea64488b1b9cc8092116692de57ab5` |
| `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` | 27 文件 / **518 通过**（rc.2 轮为 512，+6 为上游新增；service 侧 `catalog.spec.ts` 仍绿 → 升序契约未被破坏） |
| `npx vitest run packages/experimental/agent-team/tests packages/experimental/tool-agent-team/tests` | 4 文件 / **107 通过**（rc.2 轮为 105，+2 为上游新增） |
| `pnpm run typecheck` | rc=0（5 gates passed，0 failed） |
| `pnpm run test:docs` | **20 passed / 1 failed** / 0 skipped（11.39s）。失败项 = `verify-repository-references`，报 `python/sdk/uv.lock:113 commit-hash`——**基线既有、与本补丁集无关**（与 rc.2 轮同一失败项，两笔补丁对 `python/` 改动文件数为 0） |
| `pnpm build` | 10 gates / 80.66s 全过；**358 artifacts**（rc.2 轮 325，+33 为上游新增），版本戳 `0.2.1-rc.3-a24711a`，sha256 `00470582e9b0741e846b1626e4add8a974078842242ba22cc33f517f27f8f26c`，无 `DSH_CLIENT_GIT_DIRTY` |
| 产物核验 | `packages/client/ui-subagent/lib/client.js:179` 有 `catalog.entries.toReversed()`（rc.2 轮 :178，+1 偏移）；`packages/experimental/tool-agent-team/lib/index.js:278` 有 `reasoning_effort` 入参、`:297` 有条件透传映射（**行号与 rc.2 轮完全一致**）；`packages/experimental/agent-team/lib/index.js:1043` 有 `agentOptions` 注入点（rc.2 轮 :1040，+3 偏移）——偏移均为上游代码增量的自然结果，未硬掰对齐 |
| 服务健康 | `restart-dsh.sh` 重启，宿主 pid **2525002**、启动于 10:38:08（`node --import tsx/esm apps/cli/src/bin.ts web --no-open`），监听 `127.0.0.1:3080`；根路径无 token **401** / 带 token **303**（跳转会话页）；五个看板 8090/8092–8095 均 **HTTP 200**；启动日志 denial / 插件加载错误 **0** |
| Chrome 验收 | 后台刷新既有 DSH tab（不抢焦点），页面版本徽标 **`0.2.1-rc.3-a24711a`**（与 build 戳一致），截图 `/home/mi/ssd/tmp/dsh_upgrade_20261027_web2.jpg` + 徽标放大 `badge4.png` |

### 测试补充说明

- **补丁 ② 端到端行序验证**：本轮沿用"结构性论据 + 产物核验"（build 产物 `client.js:179` 的 `toReversed()` 唯一存在、profile 无 shadow 插件、版本徽标与 build 戳一致），未再逐会话截图比对渲染行序——rc.2 轮已做过端到端（渲染序 = 持久化升序的完全逆序），本轮代码与 rc.2 逐字相同，语义安全性另经"上游基线无自带反转"复核（见上）。
- **补丁 ① 仍未跑真机 spawn**：agent-team 只在 auto-mode 预设启用，验收会话在标准模式预设，`spawn_teammate` 不在工具面内；进 auto-mode 需用户明确指令。已验到产物层（schema / 透传映射 / 注入点三处行号在案）+ 单测 107 通过 + typecheck rc=0。

## WIP（进行中改动）

**deepseek-harness**：本次收尾时工作区**干净**，`git status --porcelain` 0 条目（含未跟踪文件）；本地只多两笔提交（`02e1353301`、`a24711a4d8`），未推进上游。备份分支 `backup/local-features-20261027` 指向旧 HEAD `6e80f60415`（rc.2 基线 + 两笔），回滚可用。

**本仓（`~/ssd/dsh-plugins`）本次只提交 `patches/dsh-master-22ddee37/` 与顶层 `README.md`**，其余维持现状、未提交：

1. `plugins/final-reply-guard/` —— 已挂进活跃 profile 并在跑，但**尚未入库**。
2. `plugins/subagent-dispatch-verify/` —— 同样已挂进活跃 profile，同样未入库。
3. `plugins/device-guard/` —— 未挂进活跃 profile，未入库。
4. `pnpm-lock.yaml` 未提交改动（上述插件的 workspace importer 块）。⚠️ 锁文件与已跟踪文件不一致，新克隆上 `pnpm install --frozen-lockfile` 会失败。
5. `H:/` —— 2026-10-13 误落在仓库根的目录，未跟踪，未动。

## 维护：在新上游版本上重放

1. 在 DSH 检出里 `git fetch origin`，确定新基线（本地提交的父提交 / workspace 版本对应的发布点 / tag 指向；若目标不是 tag，目录命名按提交 SHA，见本 README"目录命名说明"）。
2. 优先直接 `git am` 本目录补丁到新基线；失败时用 `git am --3way` 借助 patch 内嵌的 blob 索引自动三方合并。
3. 仍冲突时 `git am --show-current-patch=diff` 查看当前补丁，手工解决后 `git am --continue`；预期冲突面见各补丁小节的"风险与冲突点"。README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write`。
4. 冲突吸收进新提交后，跑受影响面的验证：`pnpm run typecheck` + `npx vitest run packages/client/ui-subagent/tests packages/subagent/subagent/tests` + `npx vitest run packages/experimental/agent-team/tests packages/experimental/tool-agent-team/tests` + `pnpm run test:docs`。
5. **大版本更新前先 `git clean -ffdx`（务必带 `-x`）**，再检查有没有"只含 `node_modules` 的空壳目录"——0.1.6→0.2.0 时就因上游删包留下 12 个空壳目录，让 tsdown 报 `Cannot find entry`。本轮（1539 提交跨度）未做 clean 也构建通过，但此条对更大的跨度仍是保险。
6. 若提交信息里带着旧基线名，本机 `git rebase -i` 不可用，走 `git commit-tree` 重建：保留原树与原 author 身份/日期，只换 message——这套做法在 alpha.4、rc.2 与本轮都验过。
7. 为新基线重新产出补丁集：`git format-patch <新基线>..<HEAD> -o patches/<新版本目录>/`，并复制本 README 按新基线改写。
8. `final-reply-guard` 已改为外部插件，**不再随补丁集走**——上游更新时无需重放，只需确认 profile 里那一行仍在解析（`createRequire('<profile>/package.json').resolve('@deepseek-ai/dsh-final-reply-guard')`）。
