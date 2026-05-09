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

### 报告导出 PDF：方案演进与取舍 2026-05-09

**需求背景**: DRMS 演练/故障处理报告页（`/exercise/report/detail/:id` 等）需要导出 PDF。报告包含大量子任务日志，每条日志有可折叠的详情；数据一次性加载，不是懒加载。

#### 尝试过的三种方案

| 方案 | 实现位置 | 致命问题 |
|---|---|---|
| ① pdfmake（当前线上） | `src/modules/report/hooks/useDownloadPdf/` + Web Worker | 大报告下 `generateDoc` 构建 `docDefinition` 对象能达数十 MB，主线程序列化阻塞 10s+；字体要额外嵌入（已做 `subset-fonts.js` 中文裁剪），体积仍大。排版靠手写 JSON，跟页面视觉完全脱节。 |
| ② html2canvas + jsPDF | 备选 | **必须展开所有折叠 UI 才能截图**，而折叠是每个 `ReportSubTaskLogItem` 的 `useState(false)` 自管理，外部无法强控；即使能控，折叠展开后 DOM 高度动辄几万像素，html2canvas 单次 `canvas` 超限或内存爆掉。色彩与字体渲染在不同浏览器有差异。**本质是把屏幕截图拼成 PDF，不是真 PDF**（无文本层，不可检索、不可复制）。 |
| ③ 服务端 Puppeteer（当前验证方向） | 新增 `pages/api/report/export-pdf.ts` | 生成的是真 PDF（有文本层、真 CSS 分页）；但 puppeteer 单实例峰值内存 300MB~1GB，**默认并发会把 server.js 直接 OOM 拖挂**，必须加并发队列 + 浏览器单例。 |

#### Puppeteer 方案的关键设计

1. **URL 打印模式**: puppeteer 访问 `?print=1`，业务代码自己识别并进入"全展开 + 隐藏交互"状态，**不要**让 puppeteer 去模拟点击折叠按钮（脆、业务改 className 就坏）。落地点：

   ```tsx
   // ReportSubTaskLogItem/index.tsx
   const isPrintMode = new URLSearchParams(location.search).get('print') === '1';
   const [show, setShow] = useState(isPrintMode);  // print 模式默认展开
   ```

2. **就绪信号**: 不能只靠 `networkidle0`，业务层异步渲染完要显式通知 puppeteer。

   ```tsx
   // ReportDetailPage
   useEffect(() => {
     if (isPrintMode && !loading && data) {
       setTimeout(() => { (window as any).__REPORT_READY__ = true; }, 500);
     }
   }, [isPrintMode, loading, data]);
   ```

   ```ts
   // server
   await page.waitForFunction('window.__REPORT_READY__ === true', { timeout: 30000 });
   ```

3. **浏览器单例 + 并发队列**: puppeteer 启动 1-2s，**绝不能每次请求都 launch**。全局 `browserPromise`，配 `MAX_CONCURRENT=2` 简单队列；队列满了就排队，超过 `QUEUE_TIMEOUT_MS` 直接 503。

4. **Cookie 透传**: 页面需要登录态。从 `req.headers.cookie` 解析后 `page.setCookie(...)` 注入，不要用 `Authorization` header（cookie 是最无侵入的方式）。

5. **Next.js 路由优先级**: 项目有 `pages/api/[...slug].ts` 做后端代理，新加的 `pages/api/report/export-pdf.ts` 是**静态路径**，Next.js 匹配时静态 > 动态 > catch-all，**不需要**改 catch-all。

#### 坑

- **Node 版本**: 本项目 `package.json` engines 没锁 Node 版本，但 Node 18 启动 `next dev` 会报 `TypeError: features.toSorted is not a function`（Node 20 才有 `Array.prototype.toSorted`）。**验证 puppeteer 方案前必须先切到 Node 20+**（`nvm use 20`）。
- **Worktree 端口**: 主仓库 dev 跑在 3009，同一机器开 worktree 做实验时**必须改端口**（如 `PORT=4009 npm run dev`），否则抢端口。
- **内存隔离**: 生产环境长期看应把 puppeteer 拆成独立微服务（资源隔离、崩了不影响主站），当前验证阶段先在 Next 同进程里用队列兜底。

#### 决策

**中小并发场景（<5 并发）**：puppeteer + 浏览器单例 + 队列，同进程足够。

**未来并发上去了**：拆独立服务，K8s deployment 单独扩容。

**兜底**：保留现有 pdfmake 按钮，puppeteer 按钮作为新入口共存，有问题随时回退。

**相关知识点**: [Next.js API Route 优先级](/topics/frontend/next/) · [puppeteer 内存模型](/topics/frontend/performance/)

---
