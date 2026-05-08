# DRMS 容灾系统

Next.js 项目，容灾演练任务引擎相关模块。

## 模块索引

- 任务步骤执行
- 进度条/进度算法
- 轮询逻辑
- 异常处理

## 架构决策

_等待记录..._

## 踩坑记录

### dev 环境 HMR WebSocket 持续失败 / 页面自动刷新 2026-05-08

**现象**: `npm run dev` 起服后，浏览器 Console 不停刷 `WebSocket connection to 'ws://localhost:3009/_next/hmr' failed`，页面隔几秒就自动刷新一次。

**误判路径**: 一开始怀疑 ZeroOmega 代理对 localhost WebSocket upgrade 处理有问题，配过 bypass 规则、切过「直接连接」情景，问题都不消失 → 排除代理。

**真因**: 项目用了自定义 `server.js`（为了支持 `socket.io` 转发后端 SSE）。`new Server(server)` 默认 `destroyUpgrade: true`，会把所有非 `/socket.io/` 的 WebSocket upgrade 请求在 1s 后强制 `socket.end()`，导致 Next.js HMR 的 `/_next/hmr` 连接每次都被它误杀。

**修复**:

```js
// server.js
const io = new Server(server, {
  destroyUpgrade: false,  // 关键：不要抢占非自己 path 的 upgrade
});
```

**经验教训**:

- 自定义 server + socket.io 的 Next.js 项目，**初始化 socket.io 时必须加 `destroyUpgrade: false`**，否则 HMR 会被静默杀死
- HMR 失败的副作用：Next dev client 重连成功后会触发**全页强制刷新**来恢复状态。这种刷新会**销毁所有 Web Worker、丢失 React 内存状态**，调试 PDF 生成、Worker 性能等场景必须先确保 HMR 干净，否则数据全是噪音
- 排查顺序：先 `lsof -iTCP:<port>` 确认端口只有一个进程 → 看自定义 server 是否劫持了 upgrade → 最后才怀疑代理/防火墙

**相关知识点**: [Next.js / socket.io 抢占 HMR upgrade](/topics/frontend/next/)

---
