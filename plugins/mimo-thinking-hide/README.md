# mimo-thinking-hide

MiMo 风格思考链隐藏插件。默认**完全不渲染** reasoning（对齐 MiMo Desktop 行为）。

可选 chip 模式：URL 加 `?mimoThinking=chip`，显示可展开的「思考」细条。

替换 `conversation.chat.node` key `assistant-step`。

## 安装到 dsh web

```sh
pnpm dsh plugin --profile web add <本仓库>/plugins/mimo-thinking-hide
```

在 profile 的 `cordis.patch.yml` 中插入：

```yaml
- insert:
    - id: mimo-thinking-hide
      name: '@deepseek-ai/dsh-client-mimo-thinking-hide'
```

重启 dsh web 后生效。

## 构建

```sh
pnpm install
pnpm -C plugins/mimo-thinking-hide build
```
