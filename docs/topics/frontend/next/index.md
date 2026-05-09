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
