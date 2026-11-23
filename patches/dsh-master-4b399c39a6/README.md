# DSH 本地侵入式修改补丁集 — master@4b399c39a6 基线（0.2.3-alpha.2）

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 master 顶端基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（master@39163dd30f 基线，自报 0.2.2-rc.3）见 `../dsh-master-39163dd30f/`。两版**不是增量关系**——中间隔了 **1753 个提交**，补丁是在新基线上**重做**的。能力语义不变，但实现随上游目录重构改了落点（见下）。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`4b399c39a6d1479cd84ca591b4d7c88e24d38a96`（`Merge pull request #8961 from deepseek-harness/worktree-release-dsh-0.2.3-alpha.2`，2026-11-22 16:50:28 +0800）
- **对应上游版本**：基线树根 `package.json` 的 `version` 为 **`0.2.3-alpha.2`**；构建戳自报同名版本。
- **基线认定依据**：
  1. `git log 4b399c39a6..HEAD` 只有本地提交 `f58800e328` 一笔，基线即其父提交；
  2. 本地 master 相对 `origin/master` 恰好领先 1 个提交、落后 0 个，与上游无分叉；
  3. 构建戳 `DSH_CLIENT_COMMIT_HASH=f58800e`（无 `-dirty`），与本轮先提交后构建的干净树一致。
- **与上游 tag 的关系**：基线不是 tag。最近的发版 tag 仍是 `dsh-v0.2.2-rc.3`（`38a6a5c965`）；0.2.3-alpha.2 以 PR #8961 合入 master 但未打 tag。按惯例跟 master HEAD 升级，故目录按提交 SHA 命名 `dsh-master-4b399c39a6`。

**适用性**：补丁可直接 `git am` 到基线 `4b399c39a6`（本轮即在该基线上落地）；更晚的上游版本按文末「维护」一节处理。

### 本轮跨度

`39163dd30f..4b399c39a6` = **1753 个提交**（0.2.2-rc.3 → 0.2.3-alpha.2）。

## 补丁清单

### `0001-feat-ui-subagent.patch`

- **标题**：`feat(ui-subagent): 目录行按最新创建优先`
- **本地提交**：`f58800e328c3557fe35767a579e0181f3c56c049`（作者 zhululin1 `<zhululin1@xiaomi.com>`，提交日期沿用 2026-11-05 17:29:23 +0800）
- **规模**：6 文件，+38 / −8
- **文件哈希**：sha256 `9b0a976bb870313fa695af62c74b1ccf037780feb622cce38e7c78b86a199caf`（20567 B）
- **承接**：上一版 `7a1465b5de`（39163dd30f 基线）；再往上是 `7c28adbd28`（fcc0ad46）、`f9366a0a85`（ce7073d）、`a24711a4d8`（22ddee37）、`6e80f60415`（rc.2）、`17bc6c1e0f`（alpha.4）、`9350ffe1d7`（alpha.2）、`80a85c5d0a`（0.2.0-rc.1）、`a1148836a3`（0.1.x）

#### 能力：子代理目录行按最新创建优先排序

会话头 lineage 切换器与「子智能体」分栏展开的分支，行顺序改为**最新创建排在最上**。

本轮上游把目录渲染整体重构成新文件 `packages/client/ui-subagent/src/client/SubagentCatalog.tsx`（`CatalogRows` / `deriveCatalogs` / `treeItems` / `levelPreparer` 从 `SubagentHeaderLineage.tsx` 迁入），并给 `SubagentsSection` 加了 `sectionOrder`（运行中按最近轮次开始排前，其余按 `max(updatedAt, createdAt)` 逆序）。所以补丁的落点从「切换器里写死 `toReversed()`」改为在 `CatalogRows` 上加一层显式开关：

```tsx
// The durable listing contract orders entries by creation time ascending
// (SubagentListEntry), so the tree reverses it and the newest child leads.
// A caller that ordered its own level for display passes `ordered` instead.
const rows = ordered ? catalog.entries : catalog.entries.toReversed()
```

- `CatalogRowsProps` 新增 `level` 与 `ordered`（默认 `false`）；
- `CatalogTreeProps` 新增 `orderedRoot`（默认 `false`），根层渲染时透传 `ordered={orderedRoot}`；
- `SubagentsSection.tsx` 的 `<CatalogTree>` 传 `orderedRoot`——它的 `entries` 已由 `sectionOrder` 排好，必须跳过第二次反转；嵌套层不传，始终 newest-first。

单测把切换器用例改成三行目录（creation-ascending 输入，断言渲染为 newest → oldest），并保留原有 80 条用例全绿。

## 本基线的重放结果（2026-11-23）

在本基线上重做补丁时，冲突与解法口径：

1. `SubagentCatalog.tsx` — 上游新文件，**以上游实现为准**，只叠加 `ordered` / `orderedRoot` 这一层语义。初版按「level 1 一律 `toReversed`」写，导致 `SubagentsSection` 已排序的行被二次反转，面板相关 7 条用例失败；改成显式 `ordered` 标记后 80/80 绿。**教训：反转只能发生在「未排序的持久化列表」上，已排序的调用方必须显式声明。**
2. `SubagentsSection.tsx` — 上游新增 `sectionOrder`，本地只补 `orderedRoot` 一个 prop。
3. `README.md` / `README.zh.md` / `README.i18n.yaml` — 上游重写了「Browsing the tree」段，以上游新文案为准，把顺序说明合并成双口径（切换器/展开分支 newest-first；面板自身列表运行中优先），再用 `pnpm tsx scripts/verify-translation-pairing.ts --write packages/client/ui-subagent/README.md` 重录 en/zh 配对 hash。

另一类坑（与补丁无关、但会挡住测试）：**废弃包残留构建目录**。上游把 `packages/session/tool-working-directory` 改成 `working-directory` 等，旧 `lib/`/`node_modules/` 残留让 `gen-tool-catalog.spec.ts` 报 `1 tool package(s) not in the boot manifest: tool-working-directory`（连带 11 个目录）。用仓库自带的 `pnpm run clean`（移除 427 个路径）清掉后 11/11 通过——**不要手工 rm 包目录**，`clean` 会判定残留是否全部被 git 忽略。

验证结果：

| 项 | 结果 |
|---|---|
| `pnpm build` | ✅ 10/10 gate PASS，artifacts **383**，stamp `0.2.3-alpha.2` / `f58800e`（无 dirty），20s 增量 / 110s 全量 |
| `pnpm test` | 2984 文件 / 61649 用例：2940 文件通过、**19 文件 77 用例失败**（全部本机环境类，见下） |
| 补丁自身用例 | `ui-subagent/tests/conversation-ui.client.spec.tsx` **80/80 通过** |
| 插件 link 解析 | **7/7**（profile `dependencies`，entry 文件均存在） |
| 预设包名精确解析 | **25/25**（15 个仓内插件 name 含子路径 + 3 个 bundle 经 tsconfig `paths` 解析 + 7 个外部插件经 profile `node_modules` 解析） |
| 重启 | `~/tools/dsh-restart.sh` 四判据全绿；看板 8090/8092-8095 全 200 |

77 条失败的构成：5s 超时 29 条（`--testTimeout=120000` 下全过）、沙箱后端与持久沙箱相关（本机无 userns/bwrap）约 24 条、umask 0002 影响 `spill-local` 清理断言 9 条、`ssh-helper` payload 权限位 2 条、区域化断言（`LANG=zh_CN` 输出「没有那个文件或目录」）1 条等；**无一条涉及 `ui-subagent`**。

与上一轮基线（22 文件 / 72 用例）相比：5 个基线失败文件本轮转绿（`liveshare owner-credential-horizon`、`timeline` 的 panel/reports/tools、`webworker transform-corpus`——皆为本机环境波动），2 个新增失败文件（`experimental/tool-worktree` loader-composition、`scripts/doc-typecheck`）**都是 5s 超时类**，非代码回归。

环境提示：本机 Node **v24.14.0** 低于 `package.json` 声明的 `^24.22.3 || >=26.13.1`，pnpm 只给 WARN、无硬门禁；构建与测试均可正常跑，但升级 Node 前不要把它当正式支持配置。

## 维护：在新上游版本上重放

1. 备份当前本地 HEAD：`git branch backup/local-features-<yyyyMMdd> HEAD`；
2. `git fetch origin && git reset --hard origin/master`；
3. `git am patches/dsh-master-<新SHA>/0001-*.patch`，冲突按上文第 1–3 条口径解（**上游新实现优先，本地只保留「反转持久化列表」这一层语义，且只对未排序的调用方生效**）；
4. `pnpm install --frozen-lockfile`；如有包改名/删除，先 `pnpm run clean` 再 build（陈旧残留会让 tool-catalog/loader-composition 用例假失败）；
5. `pnpm build` + `pnpm test`（关注 `ui-subagent` 用例是否全绿、`GIT_DIRTY` 是否为假）；
6. **预设迁移必须按 `exports` 精确解析每个 name**（含子路径），历史两坑：`@deepseek-ai/dsh-tool-subagent-control/list-agents` 子路径不存在、`@deepseek-ai/dsh-workflow-worker-thread` 包已消失（改 `@deepseek-ai/dsh-workflow-ptc` + `provider: spawn`）；
7. 重启**必须从 dsh 会话外部**执行（cgroup 连带杀死教训），用 `~/tools/dsh-restart.sh`（含看板兜底）；
8. 回头更新本目录 README 与 memory `project_dsh_master_*`。
