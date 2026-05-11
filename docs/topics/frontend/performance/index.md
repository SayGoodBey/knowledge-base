# 性能优化

记录渲染优化、包体积、懒加载、Lighthouse、内存泄漏等。

## 知识点

### 被伪装成「性能问题」的 API 使用错误 2026-05-11

**场景**: 排查「PDF 导出卡 10s+」这类表面看像是性能瓶颈的问题，直觉容易跳到"换方案 / 加 worker / 做并发控制"。但很多时候**根因其实是 API 用法错了，让异步永远 resolve 不了**，表面现象就是「一直在转」。

**典型模式**:

- 升级库后旧的 `getBlob(callback)` 变成 `getBlob(): Promise<Blob>`，callback 被静默忽略
- `setState` 在 async handler 里忘记 `await`，后续逻辑读到旧值
- `Promise.race([fetch, timeout])` 没给 fetch abort，fetch 继续跑但 UI 走到超时分支
- WebWorker 的 `postMessage` 发出去了，但接收侧 `addEventListener` 注册在 message 到达之后

**排查优先级（先排除 bug，再谈性能）**:

1. 给入口打时间戳 log、给 resolve 点打时间戳 log，**先确认 resolve 到底进没进来**
2. 看 `await / .then / callback` 有没有配对上，尤其是跨 worker/iframe/postMessage 的调用
3. 打开 DevTools Performance 录制，看主线程是真的在烧 CPU 还是在空转等 Promise
4. **只有排除了"根本没 resolve"之后**，再讨论"方案是不是不够快"

**教训**:

- "卡住" ≠ "慢"。Promise 没 resolve 和 CPU 烧 10s 在用户感知上是一样的，但解决方向天差地别
- **升级第三方库时优先检查 API 签名变更**。尤其是那些从 callback 演进到 Promise 的老库（pdfmake、html2canvas、jspdf、filesystem API 包装等）
- **在换技术方案前，先把当前方案的根因刨到底**。如果发现"当前方案实际上没毛病，只是用错了"，就不要急着引入新依赖（尤其是 puppeteer 这种重资源的）

**相关案例**: [DRMS pdfmake 0.3.x getBlob API 变更](/topics/projects/drms/)

---
