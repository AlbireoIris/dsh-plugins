# DSH 本地侵入式修改补丁集 — 0.1.2-rc.1 基线

对 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 上游 0.1.2-rc.1 基线的本地侵入式修改补丁集：本机 DSH 源码相对上游的全部本地提交，以 `git format-patch` 形式归档于此，便于在新检出或新上游版本上重放。

## 基线与适用性

- **上游仓库**：`https://github.com/deepseek-ai/deepseek-harness`（remote `origin`）
- **基线提交**：`76fda729799fe9b3848dbe2c211d4b231032b81e`（origin/master 顶端，`Merge pull request #3481 from deepseek-harness/fix/http-proxy-rc-version`，2026-09-03）
- **对应上游版本**：`0.1.2-rc.1`（基线树上根 `package.json` 的 `version`）
- **基线认定依据**：
  1. 本地 master（`69f0612d5b`）= origin/master（`76fda7297`）+ 恰好 1 条本地提交，`git log origin/master..HEAD` 仅此一条，故基线点取本地提交的父提交 `76fda7297`；
  2. 基线正是把 workspace 版本对齐到 0.1.2-rc.1 的 PR #3481（`fix(http-proxy): match the workspace version to the 0.1.2-rc.1 release`）合入后的上游状态，根 `package.json` version 为 `0.1.2-rc.1`；
  3. 本地提交信息自述"适配 0.1.2-rc.1 基线"。
  - 注意：tag `dsh-v0.1.2-rc.1`（`a66e47020`）是上游**发布点**，但上游 master 在发布后又前进了约 99 条提交，本地提交并非基于 tag 而是 origin/master 顶端，故补丁基线取 `76fda7297` 而非 tag。

**适用性**：补丁可直接 `git am` 到基线 `76fda7297`（已验证，见下），通常也可 am 到其后的一段时间内的上游提交；更晚的上游版本按文末"维护：在新上游版本上重放"处理。

## 补丁清单

### `0001-feat-agent-team-spawn-model-0.1.2-rc.1.patch`

- **标题**：`feat(agent-team): 恢复 spawn model 透传补丁并适配 0.1.2-rc.1 基线`
- **原始提交**：`69f0612d5ba3f247cd291e04586fc7ccfb5ab89c`（2026-09-03，作者 zhululin1）
- **改了什么**：让 Agent Teams 的 `spawn_teammate` 工具支持为单个子代理指定 `model` 与 `reasoning_effort`（动机：如让评审 teammate 用与产出 teammate 不同的模型）。机制是三层透传：`tool-agent-team` 的 `spawn_teammate` 入参新增可选 `model` / `reasoning_effort`，经 `dsh-experimental-agent-team` 的 `SpawnTeammateRequest`（新增同名字段）传到 `TeamRoster` 创建子代理时的 `agentOptions`；两值均省略时保持上游原行为（`resolveChildAgentOptions` 继承 Team Lead 的路由）。对上游 0.1.2-rc.1 的适配有两点：provider 沿用上游刚重写后的 `config.forkProvider/freshProvider` 结构仅叠加透传字段；`reasoningEffort` 类型改从 `@deepseek-ai/dsh-llm` 导入 `ReasoningEffortId`（原实现经 `dsh-agent` 主入口导入，会把 host 侧 `SessionStore` 声明合并拉进 `client-ui-agent-team` 的 Client 编译程序导致 typecheck 错型）。附带对应单测（`tool-team.spec.ts`）、工具 README 三件套与 Agent Note 三件套。
- **涉及的主要文件**：
  - `packages/experimental/tool-agent-team/src/index.ts`（工具入参与透传）
  - `packages/experimental/agent-team/src/types.ts`、`packages/experimental/agent-team/src/roster.ts`（请求类型与 agentOptions 注入）
  - `packages/experimental/tool-agent-team/tests/tool-team.spec.ts`（单测）
  - `packages/experimental/tool-agent-team/README.md` / `README.zh.md` / `README.i18n.yaml`
  - `.agents/notes/implemented/feature/2026-09-02-agent-teams-spawn-model.{md,zh.md,i18n.yaml}`
- **如何应用**：`git am`（保留提交信息与作者），在 **deepseek-harness 仓库根目录**执行：

  ```sh
  cd <deepseek-harness 检出>
  git checkout 76fda729799fe9b3848dbe2c211d4b231032b81e   # 或包含该基线的分支
  git am /path/to/dsh-plugins/patches/dsh-0.1.2-rc.1/0001-feat-agent-team-spawn-model-0.1.2-rc.1.patch
  ```

  已验证（生成时点 2026-09-05）：在干净基线上 `git apply --check` 与 `git am` 均通过，am 后的树哈希与原始提交树**完全一致**（`e24fe22ce`）。
- **风险与冲突点**：
  - 最大冲突面是 `tool-agent-team/src/index.ts` 的 `execute`：上游在该基线刚重写过 provider 的获取方式，后续继续演进该函数结构时此 hunk 必冲突，需按新结构重新叠加透传字段。
  - `tool-agent-team` 的 README 三件套：原始提交信息记载 `git apply -3` 时曾在此冲突（`spawn_teammate` 行取补丁的 model 描述增量，`send_message` 行保上游新语义）；上游改动这些描述行或 i18n 配对 hash 时会冲突，解决后需重跑 `pnpm run verify-translation-pairing --write` 重录配对 hash。
  - `agent-team/src/types.ts` 依赖 `@deepseek-ai/dsh-llm` 导出 `ReasoningEffortId`；上游调整 `SpawnTeammateRequest` 结构或 dsh-llm 导出面时需同步调整导入。
  - `roster.ts` 的 `agentOptions` 字面量插在 `request.prompt/parent` 与 `signal` 之间；上游重排 spawn 调用参数时需手工合入。

## WIP（进行中改动）

盘点时点（2026-09-05）deepseek-harness 工作区干净，`git status` 无任何未提交改动（含未跟踪文件），`packages/client/ui-commands/` 无进行中改动体现在版本库里；此前知会该目录存在另一条工作线的进行中改动，若其后出现，按约定**不纳入**本补丁集（保持本目录只收录定稿的基线差异）。

## 维护：在新上游版本上重放

1. 在 DSH 检出里 `git fetch origin`，确定新基线（新基线的认定方法同上：本地提交的父提交 / workspace 版本对应的发布点）。
2. 优先直接 `git am` 本目录补丁到新基线；失败时用 `git am --3way` 借助 patch 内嵌的 blob 索引自动三方合并。
3. 仍冲突时 `git am --show-current-patch=diff` 查看当前补丁，手工解决后 `git am --continue`；预期冲突面见各补丁小节的"风险与冲突点"。README 三件套冲突解决后**务必**重跑 `pnpm run verify-translation-pairing --write`，否则文档门禁会挂。
4. 冲突吸收进新提交后，跑受影响面的验证：`pnpm run typecheck` + `pnpm --filter @deepseek-ai/dsh-experimental-tool-agent-team test`（涉及包按补丁内容调整）。
5. 为新基线重新产出补丁集：`git format-patch <新基线>..<HEAD> -o patches/<新版本目录>/`，并复制本 README 按新基线改写。

## 推送（待 GitHub 认证配置后）

本补丁集在 dsh-plugins 仓库的本地分支 `patches/dsh-0.1.2-rc.1` 上（未推送）。配置好认证后：

```sh
cd ~/ssd/tmp/dsh-plugins

# 方式 A：沿用现有 https remote（配 PAT 或凭据管理器后）
git push -u origin patches/dsh-0.1.2-rc.1

# 方式 B：改用 SSH remote
git remote set-url origin git@github.com:AlbireoIris/dsh-plugins.git
git push -u origin patches/dsh-0.1.2-rc.1
```
