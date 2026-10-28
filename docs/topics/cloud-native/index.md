# ☁️ 云原生

> 容器 / Kubernetes / 镜像分发的**统一入口**。原先分散在「云原生」和「K8s」两个板块的内容已合并到这里——**一个知识只在一个地方记**，其他页面只放链接。

## 按主题找

| 想查什么 | 去哪一页 |
|----------|----------|
| 容器是什么、镜像分层、Dockerfile、容器 vs VM、Namespace / Cgroups、containerd / runc 引擎架构 | [容器技术](./container) |
| **pause（Infra）容器、Init 容器、Sidecar 设计模式、Pod 内共享实现** | [容器技术 · Pod 内的三类容器](./container) |
| 云原生是什么、发展简史、架构标准、不可变基础设施、生态辨析 | [概述与发展简史](./overview) |
| CNCF 生态有哪些项目、怎么选 | [CNCF 全景图](./landscape) |
| K8s 架构、API、Pod、Deployment、Service、存储、网络、GPU | [Kubernetes](./k8s/) |
| 大规模拉镜像被打爆、P2P 分发、懒加载 | [Dragonfly 镜像加速](./dragonfly) |

## Kubernetes 子页速查

[架构](./k8s/architecture/) · [安装部署](./k8s/install/) · [API 基础](./k8s/api/) · [Node](./k8s/node/) · [Deployment](./k8s/deployment/) · [Pod](./k8s/pod/) · [PV/PVC](./k8s/pv-pvc/) · [Service](./k8s/service/) · [网络](./k8s/network/) · [GPU 工作负载](./k8s/gpu/)

## 归档约定

- **容器层面**的知识（镜像、运行时、namespace、pause / init / sidecar）→ 全部进 [容器技术](./container)
- **编排层面**的知识（对象、控制器、调度、网络、存储）→ 进 [Kubernetes](./k8s/) 对应子页
- **项目落地**（TKE 控制台、DRMS 等）→ 进 [业务项目](/topics/projects/)，技术页只写抽象要点
- 同一知识点若两处都需要，**只写一处 + 另一处放链接**，不复制正文

## 学习路线

```
容器化(Docker) → 编排(K8s) → 网络/存储 → 可观测 → 服务网格 → GitOps → AI Infra
```

待展开（学完再建页，不留空占位）：服务网格（Istio / Ambient Mesh）、可观测性（Prometheus / OTel）、GitOps（Argo CD / Tekton）、CRD + Operator、eBPF。

## 与工作的关联

作为集群管理控制台的开发者，这部分知识用于理解：TKE/K8s 集群的底层运作、GPU/qGPU 调度原理、监控指标采集链路（kube-state-metrics → Prometheus → Grafana）、容器网络与服务发现。

---

*开始时间: 2026-05-18 ｜ 合并「K8s」板块: 2026-10-28*
