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
| ① pdfmake（当前线上） | `src/modules/report/hooks/useDownloadPdf/` + Web Worker | 大报告下 `generateDoc` 构建 `docDefinition` 对象能达数十 MB，主线程序列化阻塞 10s+；字体要额外嵌入（已做 `subset-fonts.js` 中文裁剪），体积仍大。排版靠手写 JSON，跟页面视觉完全脱节。**⚠️ 2026-05-11 补充根因**：上面说的"卡 10s+"很大一部分其实**不是 pdfmake 慢**，而是 **pdfmake 升级后 `pdfDoc.getBlob()` API 变了**，详见下方「pdfmake 0.3.x getBlob API 变更」。 |
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

### pdfmake 0.3.x getBlob API 变更：callback 失效导致 Worker 假死 2026-05-11

**现象**: 之前一直以为「pdfmake 导出大报告卡 10s+」是 pdfmake 渲染慢 / `docDefinition` 对象太大，还专门为此调研了 puppeteer 方案。后来复查发现 worker 里 `pdfDoc.getBlob` 那步**根本没返回**——页面上「PDF 生成中...」转圈永远结束不了。

**真因**: 当前用的是 `pdfmake@0.3.6`，而老代码从 `0.2.x` 时代沿用至今：

```ts
// src/modules/report/hooks/useDownloadPdf/download.worker.ts（旧）
const pdfDoc = pdfMake.createPdf(doc);

pdfDoc.getBlob((blob) => {        // ← 以为是回调
  postMessage({ type: 'data', data: { blob, filename } });
  postMessage({ type: 'end' });
});
```

**pdfmake 0.3.x 起 `getBlob` 不再接受 callback**，改成返回 `Promise<Blob>`。把 callback 传进去 pdfmake **既不会调用它，也不会报错**，只是默默返回一个没人 `.then()` 的 Promise → `postMessage` 永远不触发 → Worker 假死 → 主线程只看到「一直在生成中」。

**修复**（两种写法二选一）:

```ts
// ① Promise 链 + catch
pdfDoc
  .getBlob()
  .then((blob) => {
    postMessage({ type: 'data', data: { blob, filename } });
    postMessage({ type: 'end' });
  })
  .catch((error) => {
    console.error('[worker] Error generating PDF blob:', error);
    postMessage({ type: 'error', message: error?.message });
    postMessage({ type: 'end' });
  });

// ② async/await（外层已有 try/catch）
const blob = await pdfDoc.getBlob();
postMessage({ type: 'data', data: { blob, filename } });
postMessage({ type: 'end' });
```

**排查路径（踩坑）**:

1. ❌ 以为是 `docDefinition` 太大 → 试过精简内容、限制子任务数量，卡顿没消失
2. ❌ 以为是字体嵌入拖慢 → 换裁剪后的 `SourceHanSansCN` 没效果
3. ❌ 直接跳去做 puppeteer 方案（多花了 2 天）
4. ✅ 某次 AI 代码评审（TAPD CR）直接指出「第 166-168 行代码中，`pdfDoc.getBlob().then(...)` 的 Promise 链未添加 catch 处理」——顺着这条才意识到**原代码连 `.then` 都没有**，根本就是 API 用法错了

**经验教训**:

- **升级第三方库时 callback → Promise 的 API 变更最隐蔽**：旧签名 `getBlob(callback)` 在新版本里变成 `getBlob(): Promise<Blob>`，callback 参数被静默忽略，不会抛错也不会在 console 里警告。写 TS 配合新版 `@types/pdfmake` 能第一时间暴露（callback 参数会飘红），**但老项目的 `.ts` 文件如果禁用了严格模式 / 没装对类型就会溜过去**
- **"转圈永不结束"类 Worker 假死，优先怀疑的不是"慢"，而是某个 async 入口的 resolve 根本没进来**。排查手法：在 worker 里给 `getBlob` 的 callback 和紧跟的 `postMessage` 都打 log，看最后一行 log 停在哪
- **AI CR 能发现这种"没加 catch"类 Promise 问题非常有价值**，比人工走读更容易看到；**但这次的教训是 AI CR 只报了「缺 catch」，没意识到代码其实还是旧 callback 风格 → 两个问题叠在一起**。下次升级类似有 API 演进的库（pdfmake、pdf-lib、docx、antd 大版本），Code Review 清单应该显式加一条「本次是否升级了这个库？升级后 API 签名是否变化？所有调用点都切过来了吗？」
- **技术方案评估要先把现有方案的根因问题刨到底**，别在一个被 bug 伪装成「性能问题」的方案上盖新方案。如果提前发现 pdfmake 只是 API 用错了，puppeteer 方案应该作为"可选增强"而不是"刚性替代"

**相关知识点**: [第三方库大版本升级的排查清单](/topics/frontend/performance/)

---

### Next.js 16 升级后 build 阶段 RangeError：barrel re-export 触发模块加载链爆栈 2026-05-21

**现象**: `package.json` 把 Next 从 `15.5.16` 升到 `^16.2.1` 后，`npm run build`（webpack 模式）在 "Collecting page data" 阶段报：

```
unhandledRejection RangeError: Maximum call stack size exceeded
    at ignore-listed frames {
  type: 'RangeError'
}
```

或者更明确的：

```
Build error occurred
Error: Failed to collect page data for /[[...slug]]
    at ignore-listed frames
```

栈帧被 Next 标记为 `ignore-listed frames` **完全隐藏**，原始日志看不到任何业务调用栈、文件名、行号。

**误判路径**（耗了大半天）:

1. ❌ 怀疑 Node 版本（猜是 18）→ 实测 Node 20.20.2 一样炸
2. ❌ 在 `next.config.js` 顶层注册 `process.on('unhandledRejection')` 想抢在 Next handler 之前打印完整栈 → 失效，Next 内部 handler 已经先把栈过滤掉了
3. ❌ 配 `experimental.cpus: 1` + `workerThreads: false` 单进程化 → 仍然炸（说明跟 worker 无关，纯模块加载问题）
4. ❌ 配 `webpack(config)` 钩子关掉 `usedExports / providedExports / sideEffects / concatenateModules` → 无效（说明不是树摇优化的递归，是运行时 require 真的递归）

**真正的二分定位手法**:

`ignore-listed frames` 屏蔽栈帧的情况下，**唯一可靠的定位方法是「替换页面骨架做二分」**：

1. 把 `pages/*.tsx` / `pages/api/*` 全部替换成最小骨架（`<div>min</div>` / 返回 `{ ok: true }`）→ build 通过 ✅
2. 逐一恢复页面，定位到 `pages/_document.tsx` 一恢复就炸
3. 在 `_document.tsx` 内部继续二分 imports，最终精确到一对组合：**只引 `@config` 不炸 + 只引 `@lib` 不炸 + 同时引就炸**
4. 沿 `@lib` barrel 链路向下挖：`@lib → ./csrf → ./middleware → csrf.ts → '../../log4js'`，命中

**根因**:

`lib/log4js/index.ts` 在模块顶层立即执行：

```ts
import log4js from 'log4js';

log4js.configure({
  appenders: {
    console: { type: 'console' },
    file: { type: 'dateFile', filename: '...', ... },  // ⚠️ dateFile appender
  },
  ...
});
```

而 `lib/index.ts`（`@lib` barrel）顶层 `export * from './log4js'`，且 `lib/csrf/middleware/csrf.ts` 顶层 `import { logger } from '../../log4js'`。这条链路被 `pages/_document.tsx` 通过 `@lib` 引用一次拉起 → Next 16 page-data 收集 worker 同步加载整条 ESM 链 → 触发模块加载器递归 → RangeError。

Next 15 这套链路没问题；Next 16 webpack 模式下 page-data 收集对**「barrel re-export + 顶层副作用 + 间接加载副作用模块」**的容忍度大幅下降。

**修复**（4 处，纯加载链路重构，零业务逻辑变更）:

1. `lib/index.ts` 注释掉两条 re-export（不再让 barrel 把这些副作用模块拉进来）：
   ```ts
   // export * from './grpc/client';
   // export * from './log4js';
   ```
   保留 csrf 三件套（`createToken / csrfOptions / csrfToken`）的导出，因为它们没有副作用且 `_document.tsx` 需要。

2. `lib/csrf/middleware/csrf.ts` 把 `import { logger } from '../../log4js'` 改成函数内 lazy require：
   ```ts
   const getLogger = () => require('../../log4js').logger;
   // 使用处：getLogger().catch(...)
   ```
   这是**核心修复点**——验证过：改回顶层 import 立即重现 RangeError。

3. `lib/grpc/client.ts` 同样把 `import { logger } from '..'` 改成 lazy require `'../log4js'`（被 socket api 路由直接 import 时，避免顶层加载链触达 log4js）。

4. `pages/[[...slug]].tsx` 把 `import { logger } from '@lib'` 改成 lazy require `@lib/log4js`（页面参与 page-data 收集，跟 `lib/csrf` 同属"会被 page-data 加载"的一类）。

5. 所有原本通过 `@lib` 取 `logger / taskClient / TaskClientProps` 的代码，全部切到子路径直接 import：
   ```ts
   import { logger } from '@lib/log4js';
   import { taskClient, TaskClientProps } from '@lib/grpc/client';
   import { csrf } from '@lib';   // csrf 仍走 barrel，无副作用
   ```

**经验教训**:

- **Next 16 webpack 模式 + 大量 barrel re-export + 含副作用的子模块** = 极易触发 page-data 收集阶段的模块加载器递归。`ignore-listed frames` 让常规手段（栈、debugger、process hook）全都看不到任何信息
- `ignore-listed frames` 屏蔽栈帧时，**最可靠的定位方法是手工二分**：先把所有 page 替换成最小骨架，再二分恢复，再二分 imports，再二分 barrel 链路。比折腾环境配置（cpus、workerThreads、webpack optimization）高效得多
- **打破 barrel 互引环 / barrel 顶层副作用**有两类成熟手法，可组合使用：
  - 把 barrel 入口的 `export * from './foo'` 换成具体子路径直接 import（顺手清理无副作用 barrel 转发）
  - 把模块顶层的副作用 import 改成函数内 lazy require（彻底切断顶层加载链）
- **lazy require 是真正的"切断"**，比"调整 barrel 顺序"或"加 sideEffects: false"更彻底——前者改的是模块加载图本身，后者只是优化层面的提示
- **同一类问题在不同位置的修复策略要分类对待**：
  - `lib/` 内会被 page-data worker 间接加载的工具模块 → 必须 lazy require
  - `pages/api/*` 不参与 page-data 收集 → 顶层 import 完全安全
  - `pages/*.tsx` 参与 page-data 收集 → lazy require 更稳妥
- 升级 Next 大版本（15→16）时，**barrel 互引环 / 顶层副作用 / commonjs 互操作** 是高风险检查项；写一个简单的 `madge --circular` / 自检脚本可以提前暴露大部分隐患

**相关知识点**: [Next.js 16 page-data 收集 & barrel 副作用](/topics/frontend/next/) · [Next.js dynamic() 静默吞错（同样属于 ignore-listed frames 类问题）](/topics/frontend/next/)

---
