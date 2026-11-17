# DSH 本地侵入式修改补丁集 — master@39163dd30f 基线（0.2.2-rc.3）

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 master 顶端基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

上一版（master@fcc0ad46 基线，自报 0.2.2-rc.1）见 `../dsh-master-fcc0ad46/`。两版**不是增量关系**——中间隔了 **1371 个提交**，补丁是在新基线上**重做**的。补丁内容一个字没改（同一能力、同一语义），只是基线换了。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`39163dd30f703a79079e2d2446545cff3c453738`（`Merge pull request #8422 from deepseek-harness/worktree-sync-release-dsh-0.2.2-rc.3-to-master`，2026-11-13 15:37:50 +0800）
- **对应上游版本**：基线树根 `package.json` 的 `version` 为 **`0.2.2-rc.3`**；构建戳自报同名版本。
- **基线认定依据**：
  1. `git log 39163dd30f..master` 只有本地提交 `7a1465b5de` 一笔，基线即其父提交；
  2. 本地 master 相对 `origin/master` 恰好领先 1 个提交、落后 0 个，与上游无分叉；
  3. 构建戳 `DSH_CLIENT_COMMIT_HASH=7a1465b`（无 `-dirty`），与本轮先提交后构建的干净树一致。
- **与上游 tag 的关系**：基线不是 tag。最近的发版 tag 是 `dsh-v0.2.2-rc.3`（`38a6a5c965`），基线在其之上还有 **608 个未发版提交**。按惯例跟 master HEAD 升级，故目录按提交 SHA 命名 `dsh-master-39163dd30f`。

**适用性**：补丁可直接 `git am` 到基线 `39163dd30f`（本轮即在该基线上落地），通常也可 am 到其后一段时间内的上游提交；更晚的上游版本按文末「维护」一节处理。

### 本轮跨度

`fcc0ad4621..39163dd30f` = **1371 个提交**（rc.1 → rc.3，跨 rc.2、rc.3 两个发版点）。

## 补丁清单

### `0001-feat-ui-subagent.patch`

- **标题**：`feat(ui-subagent): 目录行按最新创建优先`
- **本地提交**：`7a1465b5de913882ac429c1e62334829a93cd099`（作者 zhululin1 `<zhululin1@xiaomi.com>`，提交日期沿用 2026-11-05 17:29:23 +0800）
- **规模**：5 文件，+33 / −14
- **文件哈希**：sha256 `c6d06eade3ab85dbe92cae69820d1f464ed1566fbf3a88df7169138074303d7d`（19056 B）
- **承接**：上一版 `7c28adbd28`（fcc0ad46 基线）；再往上是 `f9366a0a85`（ce7073d）、`a24711a4d8`（22ddee37）、`6e80f60415`（rc.2）、`17bc6c1e0f`（alpha.4）、`9350ffe1d7`（alpha.2）、`80a85c5d0a`（0.2.0-rc.1）、`a1148836a3`（0.1.x）

#### 能力：子代理目录行按最新创建优先排序

会话头 lineage 下拉里的子代理目录行改为**最新创建排在最上**。实现只动呈现层：

```ts
// packages/client/ui-subagent/src/client/SubagentHeaderLineage.tsx
// The durable listing contract orders entries by creation time ascending
// (SubagentListEntry); the catalog presents that order reversed, so the
// newest child leads every level.
const rows = catalog.entries.toReversed()
```

`catalog.entries.map(...)` 换成 `rows.map(...)`，键盘导航/Home/End 等一律跟随新的行顺序；单测同步调整期望并新增 newest-first 回归用例。

## 本基线的重放结果（2026-11-17）

在本基线上 `git am` 时，4 个文件冲突，逐个解掉：

1. `SubagentHeaderLineage.tsx` — 上游把展开判据提炼成 `canExpandCatalog(entry, catalogs, summaries)`，**以上游新判据为准**，只叠加 `rows = catalog.entries.toReversed()`。
2. `README.md` / `README.zh.md` — 上游重写了「Browsing the tree」整段，**以上游新文案为准**，把 newest-first 那句前置到段首。
3. `README.i18n.yaml` — 用 `pnpm tsx scripts/verify-translation-pairing.ts --write packages/client/ui-subagent/README.md` 重录 en/zh hash，随后 `--write` 的对偶 check 通过。

验证结果：

| 项 | 结果 |
|---|---|
| `pnpm build` | ✅ 10/10 gate PASS，artifacts **381**，stamp `0.2.2-rc.3` / `7a1465b`（无 dirty），2m 内 |
| `pnpm test` | 2800 文件 / 58093 用例：2754 文件通过、**72 用例失败**（全部本机环境或上游既有缺陷，见下） |
| 补丁自身用例 | `ui-subagent/tests/conversation-ui.client.spec.tsx` **101/101 通过** |
| 插件 symlink | **9/9** 可解析、target 存在、`import()` 成功 |
| 预设包名精确解析 | **24/24** 通过（21 个 name 含子路径 + 3 个 bundle） |

72 条失败的归因（无一条涉及 `ui-subagent`）：沙箱后端不可用 19 条（本机无 userns/bwrap）、单测 5s 超时 33 条（`--testTimeout=120000` 下全过）、umask 0002 导致 12 条（`umask 0022` 下 spill 42/42 过）、LANG=zh_CN 影响 4 条（`LANG=C.UTF-8` 下全过）、上游 liveshare 日期地雷 2 条、陈旧构建残留目录 1 条、上游 Windows 路径解析用例 1 条。

## 维护：在新上游版本上重放

1. 备份当前本地 HEAD：`git branch backup/local-features-<yyyyMMdd> HEAD`；
2. `git reset --hard origin/master`；
3. `git am patches/dsh-master-<新SHA>/0001-*.patch`，冲突按上文第 1–3 条的口径解（**上游新实现优先，本地只保留"反转"这一层语义**）；
4. `pnpm install --frozen-lockfile`；
5. `pnpm build` + `pnpm test`（关注 `ui-subagent` 用例是否全绿）；
6. **预设迁移必须按 `exports` 精确解析每个 name**（含子路径），历史两坑：`@deepseek-ai/dsh-tool-subagent-control/list-agents` 子路径不存在、`@deepseek-ai/dsh-workflow-worker-thread` 包已消失（改 `@deepseek-ai/dsh-workflow-ptc` + `provider: spawn`）；
7. 重启**必须从 dsh 会话外部**执行（cgroup 连带杀死教训），用 `~/tools/dsh-restart.sh`（含看板兜底）；
8. 回头更新本目录 README 与 memory `project_dsh_master_*`。
