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

### 合并分支后前端白屏，终端只有 warning / Console 没有红字 2026-05-09

**现象**: 从 `release/tce3.10.12` merge 到新分支后本地 `npm run dev` 启动，浏览器页面一直卡在 `<Status icon="loading" title="页面加载中..." />` fallback；服务端 `GET / 200`；终端只有 SCSS `@import` deprecation、`forwardRef`、`findDOMNode`、`ReactDOM.render` 几类 warning；Console 里也看不到红色 fatal error。无痕窗口同样复现。

**误判路径**（耗时最长）:

1. ❌ 怀疑 ServiceWorker / 浏览器缓存劫持 dev chunk → 清 site data + 无痕无效
2. ❌ 怀疑 `@tencent/tea-component` 版本（`forwardRef`/`findDOMNode` warning 噪音）→ 锁回 `2.8.1-beta.14` 无效
3. ❌ 怀疑 `next.config.js` 的 sassOptions 配置不全导致 SCSS 编译失败 → 补 `loadPaths`/`additionalData` 后 warning 消了，但白屏依旧
4. ❌ 怀疑 Next.js 16 + Turbopack 的 CSS 严格模式 → 写 `fix-tea-component.js` postinstall 脚本补丁 `tea.css` 里的 `:first{...}` → 无效（且当前 server.js 强制走 webpack 根本不进 turbopack 解析器）
5. ❌ 怀疑 `@antv/g6`/`react-pdf` 等 SSR 不友好的库 → chunk 51MB 没问题，Network 全部 200

**真正的根因**:

合并时 `src/types/` 目录下的 7 个子类型文件（`report.ts / setting.ts / task.ts / region.ts / power.ts / path.ts / host.ts`）被全部误删，同时 `src/types/index.ts` 里 `export * from './task'` 等 7 条 re-export 也被删掉。导致：

```ts
// src/modules/systemConfiguration/component/ClusterConfigTable/index.tsx
import { UserRole } from '@client/types';   // 解析到 src/types/，拿到的是 undefined（UserRole 实际定义在 config/types.ts）
const MANAGE_ROLE = [UserRole.Admin];       // ← TypeError: Cannot read 'Admin' of undefined
```

这个 `TypeError` 发生在 **chunk 模块顶层求值阶段**，触发在 `dynamic(() => import('../src'))` 的 Promise 链里。被 Next.js 的 `loadable.shared-runtime.js` 捕获后**静默吞掉只保持 loading 状态**，既不弹 dev overlay 也不走外层 error boundary，Console 表面上看不到任何红字。

**定位手法**: 在 `pages/[[...slug]].tsx` 的两个 `dynamic()` 的 `loader` 上加 `.catch()` 主动打印 + 重抛：

```tsx
const DynamicComponentWithNoSSR = dynamic(
  () =>
    import('../src').catch((err) => {
      console.error('[DynamicComponentWithNoSSR] Failed to load src chunk:', err);
      throw err;  // 重抛以保持原流程
    }),
  { ssr: false, loading: () => <LoadingPage /> },
);
```

加完后刷新页面，Console 里直接出现带自定义前缀的红字报错 + 完整调用栈，一眼看到 `ClusterConfigTable/index.tsx:17:31` 是出错点。

**修复**:

1. 从 `release/tce3.10.12` 恢复 7 个被误删的类型文件
2. `src/types/index.ts` 补回 `export * from './xxx'` 的 re-export，并额外添加 `export { UserRole } from '@config/types'`（`UserRole` 实际定义在 `config/types.ts`，但业务代码都是从 `@client/types` 引用）

**经验教训**:

- **"Console 全是 warning 没有红字" ≠ "没有 fatal error"**：Next.js 16 pages router 对 dynamic import chunk 求值阶段抛出的 Promise rejection 有静默吞错的分支，不会弹 dev overlay。**碰到白屏 + LoadingPage 无限转 + 无红字，第一反应应该是给 dynamic import 手动挂 `.catch` 打印**
- 同一个枚举不要在 `config/types.ts` 和 `src/types/` 两处都可能被 import：`UserRole` 定义在 `config/types.ts`，但大量业务模块写的是 `import { UserRole } from '@client/types'`，这类跨目录别名依赖 re-export 链路，一旦 re-export 丢失就是雪崩
- 合并代码时，**`src/types/` 这种"聚合导出"类的 index 文件**最容易在解决冲突时把一边的 `export * from './xxx'` 误删，应该作为 merge review 的重点检查项
- 排查顺序应该是**先给可疑的 dynamic import 加调试 `.catch` 暴露真实错误，再根据错误堆栈倒查**，而不是从环境层（版本、缓存、代理、CSS 配置）层层猜

**相关知识点**: [Next.js dynamic() 静默吞错 & 强制暴露错误](/topics/frontend/next/)

---
