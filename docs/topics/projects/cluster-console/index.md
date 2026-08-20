# 集群管理控制台

K8s 控制台前端项目（React），负责 GPU 监控、云监控、容灾演练、节点监控等面板。

## 模块索引

- GPU 监控（待补充）
- 云监控（待补充）
- 容灾演练（待补充）
- 节点监控（待补充）
- Pod 监控（待补充）
- 边缘集群部署 UI（待补充）
- [镜像加速（Dragonfly）](/topics/cloud-native/dragonfly) —— P2P 分发架构、验证 SOP、TCE 实战坑

## 架构决策

### 镜像加速（Dragonfly）模块

平台：TKE 控制台「镜像加速/Dragonfly」白屏化前端 + 部署逻辑。技术原理与日志判读见 [☁️ Dragonfly 镜像加速（P2P 分发）实战](/topics/cloud-native/dragonfly)。

- **配置模型（一套）**：多镜像仓库地址 / Redis / MySQL **共用一份**连接配置（一份 Helm values）。不要按仓库拆多套。
- **ccr vs tcr**：
  - `ccr`（Cloud Container Registry，`ccr.{domain}`）—— TCE 内部私有仓库，默认被加速对象 + Dragonfly 组件自身镜像来源，**默认填入**。
  - `tcr`（Tencent Container Registry）—— 公有云形态，需前端校验地址可达。
- **前端 TCR 地址校验**：走 Docker Registry HTTP API V2，对 `https://<tcr>/v2/` 发探测请求。**200 / 401 = 可达**（401 表示需鉴权，也算可达，前端必须覆盖该分支）；网络不通 = 不可达。
- **DB 硬依赖**：Dragonfly 强依赖 MySQL 8.0+（库名 `df_manager`）+ Redis 7.0+。白屏创建走 **TCS 中间件控制台「创建中间件实例」**，连接串填进 Helm values。文档里手敲的 StatefulSet 仅为测试野路子，生产不用。
- **完整链路**：TCS 中间件建 MySQL/Redis → 白屏表单部署 Dragonfly（values 填连接串）→ 节点打 `dragonfly.io/test=true` → 提交 ccr 镜像测试 Pod → dfdaemon 日志见 `download piece ... from parent "*.seed"` 即证 P2P 生效。

## 踩坑记录

### 镜像加速（Dragonfly）
- 测试命令必须 `--kubeconfig ./bran-gr2.kubeconfig`（业务集群），否则连 global hub 报 `namespace dragonfly-system not found`。
- 节点标签 `dragonfly.io/test=true` 打在**业务集群节点**，不能在 global hub 打。
- TCE 子集群 CRD 是 `clusters`（cls），不是 Clusternet 的 `mcls`。
- bran-gr2 containerd 实测 1.6.9 → Nydus 懒加载不支持（需 1.7.0+），MVP 只验 P2P。
- 日志出现 `proxy HTTPS request directly to remote server` 是 manifest 直连（正常），不代表 P2P 失败；blob 走 P2P 才是铁证。
