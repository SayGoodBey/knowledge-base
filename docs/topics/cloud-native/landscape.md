# CNCF 云原生全景图

## 什么是 CNCF Landscape

CNCF（云原生计算基金会）维护的一张"云原生技术地图"，把整个生态的项目和产品按类别分门别类展示。

- **官方交互版**: [https://landscape.cncf.io/](https://landscape.cncf.io/)
- **GitHub 源码**: [https://github.com/cncf/landscape](https://github.com/cncf/landscape)
- **新手导读**: [https://landscape.cncf.io/guide](https://landscape.cncf.io/guide)

## 全景图规模

- **1000+** 项目/产品收录
- **170+** CNCF 托管项目
- **20+** 毕业项目（生产验证）

## 主要分类

[![CNCF Landscape 截图](./images/cncf-landscape-categories.png)](https://landscape.cncf.io/)

> 点击图片跳转交互式全景图。如图片未加载，参见下方文字版。

| 分类 | 包含内容 |
|------|---------|
| **App Definition & Development** | 数据库、消息队列、CI/CD、应用定义 |
| **Orchestration & Management** | 调度编排、服务发现、API 网关 |
| **Runtime** | 容器运行时、网络（CNI）、存储（CSI） |
| **Provisioning** | 自动化部署、镜像仓库、安全合规 |
| **Observability & Analysis** | 监控、日志、链路追踪、混沌工程 |
| **Serverless** | 函数计算框架与平台 |
| **Platform** | 各云厂商托管平台 |

## 与我工作相关的重点项目

### 🎯 第一梯队：日常必用

| 分类 | 项目 | 说明 | 关联 |
|------|------|------|------|
| 编排 | **Kubernetes** | 容器编排核心 | 日常工作平台 |
| 运行时 | **containerd** | 容器运行时 | 每个 Pod 底层 |
| 监控 | **Prometheus** | 指标采集+告警 | GPU 利用率监控 |
| 可视化 | **Grafana** | 看板展示 | 配合 Prometheus |
| 包管理 | **Helm** | K8s 应用打包 | 部署标准方式 |
| 镜像仓库 | **Harbor** | 企业级镜像仓库 | 内部镜像管理 |

### 🔧 第二梯队：运维排障高频

| 分类 | 项目 | 场景 |
|------|------|------|
| 网络 | **Cilium** / Calico | Pod 网络策略、eBPF |
| DNS | **CoreDNS** | 服务解析排障 |
| 存储 | **CSI** | PV/PVC 挂载问题 |
| 日志 | **Fluentd** / Fluent Bit | Pod 日志采集 |
| 追踪 | **Jaeger** / **OpenTelemetry** | 调用链排查 |
| 底层 | **etcd** | 集群状态数据库 |

### 🚀 第三梯队：进阶方向

| 分类 | 项目 | 何时关注 |
|------|------|---------|
| 服务网格 | **Istio** / Envoy | 流量治理需求 |
| CI/CD | **Argo CD** / Tekton | 搭建发布流水线 |
| 策略 | **OPA/Gatekeeper** | 安全合规 |
| 弹性 | **Knative** / KEDA | 按需扩缩 |
| 混沌 | **Chaos Mesh** | 故障演练 |

### 🎮 GPU/AI Infra 相关

| 项目 | 说明 | 关联 |
|------|------|------|
| **NVIDIA Device Plugin** | K8s GPU 设备插件 | checkpoint 就是它产生的 |
| **NVIDIA GPU Operator** | 自动化 GPU 驱动+插件部署 | GPU 节点生命周期 |
| **Volcano** 🎉 | 高性能批调度器（腾讯开源，CNCF 孵化） | GPU 任务队列调度 |
| **KubeFlow** | ML 工作流编排 | AI 训练调度 |
| **KubeRay** | Ray on K8s | 分布式推理/训练 |

## 架构分层视图（我的视角）

```
┌─────────────────────────────────────────┐
│           应用层                          │
│   Helm · Argo CD · KubeFlow             │
├─────────────────────────────────────────┤
│           编排层                          │
│   Kubernetes · Volcano(GPU调度)          │
├─────────────────────────────────────────┤
│           运行时                          │
│   containerd · Cilium · CSI             │
├─────────────────────────────────────────┤
│           可观测                          │
│   Prometheus · Grafana · Jaeger · OTel  │
├─────────────────────────────────────────┤
│           基础设施                        │
│   NVIDIA Device Plugin · GPU Operator   │
│   etcd · CoreDNS · Harbor               │
└─────────────────────────────────────────┘
```

## 学习优先级建议

1. ✅ **已熟悉** → K8s 核心、GPU 调度机制
2. 📌 **建议深入** → Prometheus + Grafana（监控体系）、Cilium（eBPF 网络）
3. 🔭 **拓展方向** → Volcano（批调度）、Argo CD（GitOps）、OpenTelemetry

---

*记录日期: 2026-05-18*
