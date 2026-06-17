# PV / PVC

记录持久卷、存储类、动态供给、绑定策略、Volume 类型等知识。

## 知识点

## Volume 核心概念 <2026-06-17>

**场景**：学习 Kubernetes Volume 作为存储抽象层的设计。

Volume 是 Pod 级别的存储抽象：容器只看到目录路径（如 `/data`），不关心实际数据存在哪。

```mermaid
flowchart TB
    Pod["Pod"]
    Pod --> V["Volume<br/>Pod 生命周期绑定"]
    V --> C1["容器 1<br/>mountPath: /data（读写）<br/>业务主进程"]
    V --> C2["容器 2<br/>mountPath: /data（只读）<br/>Sidecar 读日志"]
    V --> C3["容器 3<br/>mountPath: /config（只读）<br/>ConfigMap 注入"]
```

**常用 Volume 类型**：

| 类型 | 用途 | 生命周期 |
|------|------|----------|
| `emptyDir` | 容器间临时共享 | 与 Pod 同生同死 |
| `hostPath` | 挂载宿主机目录 | 独立于 Pod |
| `ConfigMap` | 配置注入 | 独立于 Pod |
| `Secret` | 密钥/证书注入 | 独立于 Pod |
| `PVC` | 持久化存储 | 独立于 Pod |

**核心价值**：容器内统一用 mount 机制，不区分"配置文件"还是"数据目录"——都是文件系统路径。

---

## PV / PVC / StorageClass 动态供给 <2026-06-17>

**场景**：理解 K8s 持久化存储的三层角色分离。

```mermaid
sequenceDiagram
    participant Admin as 管理员
    participant U as 用户
    participant SC as StorageClass
    participant PV as PersistentVolume
    participant PVC as PersistentVolumeClaim
    participant Pod

    Admin->>SC: 定义 SSD 类型供应方
    U->>PVC: 申请 10GB SSD
    PVC->>SC: 查找匹配的 StorageClass
    SC->>PV: 自动创建 10GB PV
    PV-->>PVC: 绑定
    Pod->>PVC: volumeMounts: /data

    Note over PV,PVC: Pod 删了，PV 还在<br/>计算和存储生命周期解耦
```

**角色分工**：
- **管理员**：定义 StorageClass（"我有 SSD 和 HDD 两种供应"）
- **用户**：创建 PVC（"我要 10G SSD"）
- **K8s**：自动匹配 → 动态创建 PV → 绑定

支持后端：AWS EBS、GCE PD、NFS、Ceph、local-volume、CSI 驱动等。
