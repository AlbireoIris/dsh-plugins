# file-reference

输入框里敲 `@` 即在本地文件里选择：候选来自宿主的实时扫描（按配置的根目录，深度/数量有上限），
回车后以 `@路径` 引用格式插入输入框（路径含空格自动用 `@"path with spaces"` 语法）；
选择目录则保留尾部分隔符，可继续向下浏览。

解决"拖本地文件太费劲"：不用拖，`@` 一敲、路径一选、回车即可。

## 用法

在输入框输入：
- `@` → 弹候选菜单（根目录下的文件/文件夹，按修改时间倒序）
- `@ab` → 过滤路径/文件名包含 "ab" 的候选
- 选择文件 → 插入 `@C:\...\file.txt`（或 `@"..."`）；选择目录 → 插入 `@C:\...\dir/` 可继续接续输入

## 配置（cordis.yml 行内 config，均可选）

```yaml
- id: file-reference
  name: '@deepseek-ai/dsh-client-file-reference'
  inject: [webServer]
  config:
    roots: ['C:\Users\<you>\Desktop', 'C:\Users\<you>\Documents']
    excludeDirs: ['node_modules', '.git', '.pnpm-store']
    maxDepth: 3
    maxResults: 50
```

| 键 | 默认 | 说明 |
|---|---|---|
| roots | 用户主目录 + Desktop/Documents/Downloads | 扫描根目录列表（支持 `%USERPROFILE%` 前缀） |
| excludeDirs | node_modules / .git / .pnpm-store | 永远跳过、同名字目录匹配的名称 |
| maxDepth | 3 | 根以下的目录递归深度 |
| maxResults | 50 | 最多返回的候选条数 |

## 工作原理

- 宿主 `POST /dsh/file-candidates`：对每个根目录做深度受限扫描，按 query（路径/文件名包含）过滤，
  目录优先、最新改动的文件靠前，结果上限封顶；任何读不过去的目录静默跳过。
- 客户端注册一个 `@` 触发源（`inputTriggers.registerSource`），候选即扫描结果，
  `onPick` 按共享引用语法生成插入文本——走的全是 dsh 官方 `/`+`@` 斜杠管线，
  没有触碰任何编辑器/附件内部 API。

## 安装

见仓库根 README「安装插件到 dsh web」。要求 dsh web 已启用输入触发管线
（`ui-input-trigger` 在默认 web bundle 中）。
