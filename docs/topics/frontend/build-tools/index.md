# 构建工具

记录 webpack、vite、turborepo、husky、lint-staged 等构建/工程化工具的使用与踩坑。

## 知识点

## npm workspaces 下 esbuild 双版本 postinstall 冲突 <2026-09-22>

**场景**: 一个 npm workspaces monorepo，某个 workspace 成员的间接依赖同时引入了两个不同版本的 esbuild（一个来自 `esbuild-loader@2.21.0` 的 `^0.16.17`，一个来自 `vite@6.4.1` / 精确 `0.25.5`）。CI 上 `tnpm install` 阶段报错：

```
npm ERR! path /data/source/packages/tke/node_modules/esbuild
npm ERR! command sh -c node install.js
Error: Expected "0.25.5" but got "0.16.17"
    at validateBinaryVersion (install.js:135)
```

**根因（四层叠加）**:

1. **npm 规范允许 postinstall 执行任意脚本**——esbuild 就在 postinstall 里做「版本自检」。
2. **esbuild 架构 = JS 壳 + 平台原生二进制**（`esbuild` 主包 + `@esbuild/<platform>` 平台包），install.js 会跑 `require.resolve('@esbuild/linux-x64')` 找二进制、执行 `--version` 与自己 `package.json` 声明的版本比对，**不一致就抛异常**。
3. **同一棵树里出现两份 esbuild**：`esbuild-loader ^0.16.17` 与 `vite ^0.25.x` / 精确 `0.25.5` 无版本交集，npm 必须嵌套安装。
4. **npm workspaces + optionalDependencies 的 hoist 行为**：`@esbuild/*` 平台包（用 optionalDependencies 声明）被 hoist 到根 `node_modules`，嵌套那份没落下来。嵌套的 `esbuild@0.25.5` 通过 node 模块解析往上找，摸到根上的 `@esbuild/linux-x64@0.16.17`，版本对不上 → 报错。

**关键澄清**：

- 跟 node 版本无关。esbuild 0.25 声明 `engines.node: ">=18"`，但 npm 默认 `engine-strict=false`，node 16 下只 warning。升 node 18 这个报错依然出现。
- 跟构建命令无关。报错发生在 `tnpm install` 阶段，此时业务代码的 `build` 命令根本还没跑到。
- 跟你构建哪个 app 无关。npm workspaces 是「一锅端」安装：读根 `package.json` 的 `"workspaces": ["packages/*"]` → 装所有 workspace 成员的 deps，包括无关 workspace。

**流程图**（安装失败链路）:

```mermaid
flowchart TD
    A[CI: tnpm install<br/>在仓库根执行] --> B{读根 package.json<br/>workspaces: packages/*}
    B --> C[装所有 workspace 成员的 deps<br/>包含 packages/tke]
    C --> D[tea-scripts 拉入两条 esbuild 链]
    D --> E1[esbuild-loader@2.21.0<br/>→ esbuild ^0.16.17]
    D --> E2[esbuild 0.25.5 精确<br/>+ vite 6.4.1 → ^0.25.x]
    E1 --> F1[hoist 到根:<br/>node_modules/esbuild@0.16.17<br/>node_modules/@esbuild/linux-x64@0.16.17]
    E2 --> F2[嵌套安装:<br/>packages/tke/node_modules/esbuild@0.25.5]
    F2 --> G[esbuild@0.25.5 的 postinstall 执行 install.js]
    G --> H[require.resolve @esbuild/linux-x64<br/>逐级向上查找]
    H --> I{嵌套目录下有 @esbuild/linux-x64@0.25.5 吗?}
    I -->|无 optional 平台包被 hoist 走了| J[摸到根:<br/>@esbuild/linux-x64@0.16.17]
    J --> K[执行 esbuild --version → 0.16.17]
    K --> L{与 package.json 声明的 0.25.5 一致?}
    L -->|否| M[throw Error<br/>Expected 0.25.5 but got 0.16.17]
    M --> N[install 失败退出<br/>build 阶段根本没跑到]
```

**修复方案（正确姿势）**:

1. 在**根 `package.json`** 的 `overrides` 里同时锁死主包和 loader，让整棵树只剩一个 esbuild 版本：

   ```json
   {
     "overrides": {
       "esbuild": "0.25.5",
       "esbuild-loader": "4.4.0"
     },
     "resolutions": {
       "esbuild": "0.25.5",
       "esbuild-loader": "4.4.0"
     }
   }
   ```

   为什么加 `esbuild-loader: 4.4.0`：`esbuild-loader@2.21.0` 声明 `esbuild ^0.16.17`，只 override esbuild 到 0.25.5 会让这条声明「非法」（`npm ls` 会看到 `invalid: "0.25.5" from ... overridden`）。升到 `4.4.0` 后其声明变为 `esbuild ^0.25.0`，与 0.25.5 天然兼容。

2. **必须**清干净重装以让 override 落进 lock：

   ```bash
   rm -rf node_modules packages/*/node_modules package-lock.json
   tnpm install --legacy-peer-deps
   ```

**踩坑**:

| 错误尝试 | 为什么失败 |
|---|---|
| 在 `packages/tke/package.json`（workspace 成员）加 override | **npm 只认根的 overrides**，workspace 成员声明的会被静默忽略 |
| 只加 override 不重装 | 已有 lock 快速路径不重解析，override 无效 |
| `npm install --package-lock-only` 重生 lock | **已知 bug**：这个模式不完整应用 overrides，生成的 lock 依然有双版本 |
| 本地用 npm 12 生成 lock | 与 CI 的 tnpm 9（npm 9 内核）行为不同，装出来的 lock 可能不兼容 |
| 升级 node 到 18 | 这个报错跟 engines 检查无关，升 node 依然出现 |
| 从 workspaces 排除 tke | 可行但要补齐 ~50 个 tke 独有运行时依赖到根，工作量大 |

**通用画像 — 会踩同款雷的包**:

任何满足下述特征的包都可能触发同类问题：
- 采用「JS 壳 + 平台原生二进制」架构，用 `optionalDependencies` 声明平台包
- postinstall 里做「找平台二进制并校验版本」
- 出现在 monorepo（workspaces / lerna / pnpm）里
- 同一棵树里同时存在多个版本

除 esbuild 外常见：`@swc/core` + `@swc/core-linux-x64-gnu`、`@napi-rs/*`、`sharp` + `@img/sharp-linux-x64`、`lightningcss` + `lightningcss-linux-x64-gnu`。现象都是 `Expected X but got Y` 或 `Cannot find optional dependency`，修法同一套：**让树里只剩一个版本**。

**参考代码**（overrides 生效验证）:

```bash
npm ls esbuild
# 期望：整棵树只出现一个 0.25.5，无 invalid 标记
# 若还看到 0.16.17，说明 lock 没更新，需要清 lock 重装
```

---
