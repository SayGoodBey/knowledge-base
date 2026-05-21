# Next.js

记录 Next.js App Router、SSR/SSG、数据获取、路由、middleware 等。

## 知识点

## socket.io 抢占 Next.js HMR upgrade 事件 2026-05-08

**场景**: 自定义 `server.js` 启动 Next.js dev，并在同一个 HTTP server 上挂了 `socket.io`。浏览器 Console 持续报 `WebSocket connection to 'ws://localhost:3009/_next/hmr' failed`，HMR 不工作，页面会"莫名自动刷新"。

**排查过程**:

1. 第一直觉是代理（ZeroOmega/SwitchyOmega）拦截了 localhost 的 WebSocket
2. 切到「直接连接」情景，问题依旧 → 排除代理
3. `lsof -iTCP:3009 -sTCP:LISTEN` 确认端口只有一个 `node server.js` 进程
4. 翻 `node_modules/engine.io/build/server.js` 的 `attach` 实现，定位真凶

**根因**: `socket.io`（底层 `engine.io`）默认配置 `destroyUpgrade: true`。它会监听整个 HTTP server 的 `upgrade` 事件，**任何不属于自己 path（默认 `/socket.io/`）的 upgrade 请求，都会在 1s 后被它主动 `socket.end()` 断掉**。Next.js dev 的 HMR WebSocket 走 `/_next/hmr`，于是被 socket.io 误杀。

```js
// engine.io/build/server.js（关键源码）
server.on("upgrade", (req, socket, head) => {
    if (check(req)) {
        this.handleUpgrade(req, socket, head);
    }
    else if (false !== options.destroyUpgrade) {
        // ⚠️ 不是自己的请求，1s 后主动断开！
        setTimeout(function () {
            if (socket.writable && socket.bytesWritten <= 0) {
                return socket.end();
            }
        }, destroyUpgradeTimeout);
    }
});
```

**解决**: 给 `new Server(server, ...)` 传入 `destroyUpgrade: false`，让 socket.io 对非自己 path 的 upgrade 请求"放行不管"，由后续 listener（Next 内部的 HMR handler）处理。

```js
// server.js
const io = new Server(server, {
  destroyUpgrade: false,
});
```

**要点**:

- Next.js dev 在 `app.prepare()` 之后会向底层 HTTP server 挂自己的 `upgrade` 监听处理 `/_next/hmr`
- Node `http.Server` 的 `upgrade` 是多 listener 事件，但 socket.io 默认会主动 destroy "不认识的"连接
- 自定义 server + socket.io 共存的项目，**永远记得加 `destroyUpgrade: false`**
- 该问题症状容易被错误归因为代理/防火墙/HMR 配置问题，但 `lsof` 确认端口只有一个进程后就基本能锁定本地协议层

**相关阅读**:
- 项目内具体修复：[`topics/projects/drms/`](/topics/projects/drms/)
- engine.io `attach` 选项：[https://socket.io/docs/v4/server-options/#destroyupgrade](https://socket.io/docs/v4/server-options/#destroyupgrade)

---

## `next/dynamic` 静默吞掉模块顶层错误 2026-05-09

**场景**: 使用 `dynamic(() => import('../src'), { ssr: false, loading: () => <LoadingPage /> })` 加载大模块。如果 `../src` 的某个**依赖模块在顶层代码求值时抛错**（例如 `const X = [UserRole.Admin]` 而 `UserRole` 是 undefined），页面会永久卡在 `loading` fallback：

- 服务端 `GET / 200`
- 终端只有 warning，没有 fatal
- 浏览器 Console 看起来"全是黄色/红色 warning，没有真正红色 Error"
- Next.js dev overlay 不弹红框
- 没有任何 error boundary 被命中

**原因**: Next.js 的 `next/dynamic` 底层用 `react-loadable` / `React.lazy`。当 `loader` 的 Promise 以"模块求值异常"的方式 reject 时，Next.js 的 `loadable.shared-runtime.js` 在某些开发模式分支会**把错误存到内部 state 里只继续 `loading`**，而不是触发 `error` 状态或重抛到 React render。外层如果没配 `dynamic({ ..., error: () => ... })` 或 error boundary，这个错误就彻底沉默。

**强制暴露错误的手法**（排查利器）:

```tsx
const DynamicComponentWithNoSSR = dynamic(
  () =>
    import('../src').catch((err) => {
      console.error('[DynamicComponentWithNoSSR] Failed to load src chunk:', err);
      throw err;  // 重抛，不改变原有流程
    }),
  { ssr: false, loading: () => <LoadingPage /> },
);
```

在 Promise 链的**最前**插入自己的 `.catch`，能保证：

1. 一定会 `console.error` 一条带**可搜索前缀**的红字 + 完整堆栈
2. `throw err` 重抛后下游 dynamic runtime 的行为不变（依然显示 loading）
3. 零成本、零副作用，排查完可以选择性保留做兜底日志

**要点**:

- 白屏 + 无限 loading + Console 没有红字时，**先怀疑 dynamic import 静默吞错**，给每个 `dynamic()` 的 loader 挂 `.catch` 打印
- 相比盲目排查环境（缓存/代理/版本/编译），直接暴露真实报错栈能省数小时
- 生产环境也可以给关键 dynamic import 挂 `.catch` 发上报，比"用户反馈白屏"可观测强得多
- 误区：`Console` 里那些 `Warning: findDOMNode is deprecated` / `Warning: ReactDOM.render is no longer supported` 图标虽红，但文本前缀是 `Warning:`，**都是非阻塞 warning**，不是白屏根因

**相关案例**: [DRMS 合并分支后白屏排查](/topics/projects/drms/)

---

## Next.js 16 build 阶段 RangeError：barrel re-export 触发模块加载链爆栈 2026-05-21

**场景**: Next 15 → Next 16（webpack 模式）升级后，`next build` 在 "Collecting page data" 阶段抛出：

```
unhandledRejection RangeError: Maximum call stack size exceeded
    at ignore-listed frames
```

栈帧被 Next 标为 `ignore-listed frames` 完全隐藏，无法看到出错文件 / 行号 / 业务调用栈。

**根因模型**:

Next 16 在 webpack 模式下，"Collecting page data" 阶段会用 worker 进程同步加载每个页面模块及其全部顶层依赖。当出现以下组合时，模块加载器会陷入递归：

1. **barrel 入口（如 `lib/index.ts`）通过 `export * from './foo'` 重导出多个子模块**
2. **其中某个子模块顶层有副作用代码**（如 `log4js.configure({ ... })`、protobuf `task_pb` / `task_grpc_pb` 模块顶层 require）
3. **该副作用模块又被 barrel 内的其他子模块通过具体路径顶层 import**（例如 `lib/csrf/middleware/csrf.ts` 顶层 `import { logger } from '../../log4js'`）

形成「barrel 入口 → 副作用模块 + barrel 入口 → 中间模块 → 副作用模块」的菱形加载图，叠加 commonjs 互操作的 `__esModule` 包装，触发模块加载器递归 → RangeError。

Next 15 这种情况通常被 module cache 自然化解，Next 16 page-data 收集对此宽容度大幅下降。

**`ignore-listed frames` 下的定位手法**:

常规手段失效（process hook 抢不过 Next、debugger 触发不到、source map 屏蔽），**唯一可靠的方法是手工二分**：

```
Step 1: 全部 page 替换成最小骨架（<div>min</div> / 空 handler）→ 期望 build 通过
Step 2: 逐一恢复 page，定位到 N 个炸点 page
Step 3: 在炸点 page 内部二分 imports（一半留一半删）
Step 4: 锁定到一对组合"只引 A 不炸 + 只引 B 不炸 + 同时引炸"
Step 5: 沿 barrel 链路向下挖，直到命中某条具体 import
```

辅助手法（最常见的具体怀疑路径）：

- 把所有 `lib/*/index.ts` 风格的 barrel 入口 `cat` 出来，看哪个 `export *` 转发了**带顶层副作用**的模块
- 重点怀疑：`log4js.configure` / `winston` 类日志库初始化、`grpc` proto 加载、`socket.io` 客户端 / 服务端初始化、`@grpc/grpc-js` 配合 `proto-loader`、各类自动注册路由 / 中间件的 SDK

**修复手法（按推荐顺序）**:

1. **从 barrel 入口移除带副作用的子模块 re-export**（最干净）：
   ```ts
   // lib/index.ts
   // export * from './log4js';        ← 注释
   // export * from './grpc/client';   ← 注释
   ```
   所有调用方改成走子路径直接 import：
   ```ts
   import { logger } from '@lib/log4js';
   import { taskClient } from '@lib/grpc/client';
   ```
   barrel 仍然导出无副作用的内容（如 React 组件、纯函数、常量）。

2. **被多处间接加载的"中间桥接模块"，把对副作用模块的顶层 import 改成函数内 lazy require**：
   ```ts
   // 不要：import { logger } from '../../log4js';
   const getLogger = () => require('../../log4js').logger;
   // 使用处：getLogger().catch(...)
   ```
   这是真正"切断"顶层加载链的唯一方法。`sideEffects: false`、`webpack.optimization` 调参都不能解决，因为问题在 ESM/CJS 模块加载器层面而不是树摇优化层面。

3. **页面文件（`pages/*.tsx`）里 import 副作用模块时，倾向于 lazy require**：页面本身参与 page-data 收集，跟 barrel 内中间模块同属"会被 page-data 加载"的一类，统一防御更稳。

4. **API 路由（`pages/api/*`）不参与 page-data 收集**，顶层 import 完全安全，不需要 lazy 化（用 lazy 反而损害可读性）。

**模块按"是否被 page-data worker 同步加载"分类的修复策略**:

| 模块类型 | 是否被 page-data 加载 | 顶层 import 副作用模块 |
|---|---|---|
| `pages/*.tsx`（页面） | ✅ 是 | ❌ 不要 → 用 lazy require |
| `pages/api/*` | ❌ 否 | ✅ 安全 |
| `pages/_document.tsx` / `pages/_app.tsx` | ✅ 是 | ❌ 不要 |
| 被页面通过 barrel/直接路径间接引用的工具模块（`lib/*`） | ✅ 间接是 | ❌ 不要 → 用 lazy require |
| 被 API 路由直接 import 的工具模块 | ❌ 否 | ✅ 安全 |

**经验教训**:

- 升级 Next 大版本（15→16）时，**barrel 互引环 / 顶层副作用 / commonjs 互操作** 是高风险检查项，可在升级前先跑一遍 `madge --circular src/ lib/` 暴露循环
- `ignore-listed frames` 屏蔽栈帧的情况下，**手工二分比折腾环境配置高效得多**，不要把时间花在 `experimental.cpus`、`workerThreads`、`webpack.optimization` 调参上
- **`sideEffects: false` 不能修这类问题**——它是树摇优化的提示，作用于 webpack ModuleGraph 静态分析；而模块加载递归发生在运行时 require/import，跟优化标志无关
- "barrel 转发副作用模块"是个反模式，应该从代码规范层面避免。barrel 入口应只转发**纯定义模块**（类型、组件、常量、纯函数），副作用初始化应走专用 entry 或 lazy 化
- 修复后保留**清晰的注释**：`lib/index.ts` 头部注释要说明为什么不再 re-export，否则下次有人加 `export * from './log4js'` 又会复发
- 跨文件风格不必强求统一——比如 `lib/csrf/middleware/csrf.ts`（被 page-data 加载）必须 lazy require，但 `pages/api/[...slug].ts`（不参与 page-data）可以顶层 import，这种"按位置分类"的不一致是合理的

**相关案例**: [DRMS Next 16 升级 build 失败排查（含完整二分过程）](/topics/projects/drms/)

---
