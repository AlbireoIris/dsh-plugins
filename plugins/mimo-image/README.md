# mimo-image

MiMo 风格图片卡片插件：圆角卡片 + 文件名条 + 扩展名徽章 + 点击放大。

替换 dsh 的 `conversation.message.images` / `conversation.trajectory.images` / `tool.call.images` 图库。

## 安装到 dsh web

```sh
pnpm dsh plugin --profile web add <本仓库>/plugins/mimo-image
```

在 profile 的 `cordis.patch.yml` 中插入：

```yaml
- insert:
    - id: mimo-image
      name: '@deepseek-ai/dsh-client-mimo-image'
```

重启 dsh web 后生效。

## 构建

```sh
pnpm install
pnpm -C plugins/mimo-image build
```
