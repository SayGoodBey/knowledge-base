# PV / PVC

记录持久卷、存储类、动态供给、绑定策略、Volume 类型等知识。

## 知识点

## Volume 核心概念 <2026-06-17>

**场景**：学习 Kubernetes Volume 作为存储抽象层的设计。

**Volume 是 Pod 级别的存储抽象**：容器只看到目录路径（如 `/data`），不关心实际数据存在哪。

**常用 Volume 类型**：

| 类型 | 用途 | 生命周期 |
|------|------|----------|
| `emptyDir` | 容器间临时共享（Sidecar 读日志） | 与 Pod 同生同死 |
| `hostPath` | 挂载宿主机目录 | 与 Pod 无关（需谨慎） |
| `ConfigMap` | 配置注入 | 独立于 Pod |
| `Secret` | 密钥/证书注入 | 独立于 Pod |
| `PVC` | 持久化存储 | 独立于 Pod |

**核心价值**：容器内统一用 mount 机制，不需要在代码里区分"这是配置文件"还是"这是数据目录"——都是文件系统路径。

---

## PV / PVC / StorageClass <2026-06-17>

**场景**：学习 K8s 持久化存储的三层抽象。

**角色分工**：
- **管理员**：定义 StorageClass（"我有 SSD 和 HDD 两种供应方"）
- **用户**：创建 PVC（"我要 10GB SSD"）
- **K8s**：自动匹配 StorageClass → 动态创建 PV → Pod 绑定 PVC 挂载使用

**关键特性**：
- PV 和 PVC 是一对一绑定
- Pod 删了，数据还在（计算和存储生命周期解耦）
- StorageClass 支撑各类后端：AWS EBS、GCE PD、NFS、Ceph、local-volume

---
