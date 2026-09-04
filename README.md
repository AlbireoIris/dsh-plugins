# dsh-plugins

DeepSeek Harness（dsh web）个人插件集合。每个插件一个目录，独立打包、独立安装，
持续新增插件时不互相影响。

## 仓库布局

```
dsh-plugins/
├── pnpm-workspace.yaml      # 所有插件作为同一 pnpm workspace 的成员
├── package.json             # 聚合脚本（build / typecheck）
├── README.md
├── patches/                 # 对 deepseek-harness 上游的本地侵入式修改补丁集（见 patches/<基线>/README.md）
└── plugins/
    └── <plugin-name>/       # 一个目录 = 一个插件
        ├── package.json     # 包名约定: @deepseek-ai/dsh-client-<name>
        ├── tsconfig.json    # 独立可构建（无需 clone 整个 dsh 源码）
        ├── tsdown.config.ts # 宿主 lib + 浏览器 client 双产物
        └── src/
            ├── index.ts              # 宿主半边（node，跑在 dsh web 进程里）
            ├── client/index.ts       # 浏览器半边（客户端 UI / 逻辑）
            ├── client/*.tsx          # 组件
            ├── vendor-types.d.ts     # 对 @deepseek-ai/* 的最小类型垫片（仅构建用）
            └── ...
```

## 新增插件的流程

1. `mkdir plugins/<name>`，复制一个现有插件作骨架（tsconfig / tsdown.config / vendor-types 可原样用）。
2. `src/index.ts` 写宿主逻辑，`src/client/` 写浏览器端；跨端通信走 `fetch` 宿主自己的
   HTTP 路由（`ctx.webServer.register`），UI 通过 `ctx.slots.inject` 注册到 web 槽位。
3. `package.json` 的 `dsh.client` 清单声明 `platform: "web"` 与浏览器半边的入口。
4. 仓库根 `pnpm install` 后 `pnpm -r build`，确认 `lib/index.js` + `lib/client.js` 生成。
5. 安装到 dsh web（见下文），提交推送。

## 安装插件到 dsh web

以一个插件为例（`plugins/restart-harness`）：

1. 把插件放进 dsh 安装环境：`cd <你的 dsh 工作区> && pnpm add file:<本仓库路径>/plugins/restart-harness`
   （或在 dsh 的 `packages/client/` 下建立链接并纳入其 pnpm workspace）。
2. 在 web profile 的 bundle 补丁 `cordis.patch.yml` 加一行：
   ```yaml
   - id: restart-harness
     name: '@deepseek-ai/dsh-client-restart-harness'
     inject: [webServer]
   ```
   并在该 bundle 的 `package.json` 声明对应依赖。
3. 重新构建该插件（`pnpm --filter <pkg> build`），重启 dsh web 进程加载宿主半边；
   浏览器端在 `lib/client.js` 里，刷新页面即生效。

## 插件的宿主/客户端分工

- **宿主（index.js）**：跑在 dsh web 的 Node 进程里——注册 HTTP 路由、读配置、访问
  node 能力、对外提供服务。
- **客户端（client.js）**：跑在浏览器页面里——UI、槽位注册、页面状态。构建产物是
  `window.__ModuleLoader__.load({ id, factory })` 形式，React 等共享库由 dsh 的模块表提供
  （保持 external，不打进包）。

## License

MIT
