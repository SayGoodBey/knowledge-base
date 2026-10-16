# K8s 网络

记录 K8s 网络的底层知识：三种 IP、Service 端口映射、CNI 与 flannel、虚拟网卡（cni0 / flannel.1 / veth）。

## 三种 IP 类型 <2026-10-16>

**场景**：`kubectl get nodes -o wide`、`get svc`、`get pods -o wide` 里各有一个 IP，分不清谁是谁。

| 类型 | 例子 | 谁能访问 | 查法 |
|------|------|---------|------|
| **Node IP**（节点） | `30.184.62.206` | 内网/公网（看安全组） | `kubectl get nodes -o wide` 的 `INTERNAL-IP` 列 |
| **ClusterIP**（Service） | `10.111.238.163` | 仅集群内部 | `kubectl get svc` 的 `CLUSTER-IP` 列 |
| **Pod IP** | `10.244.0.5` | 集群内部（Pod 间互访） | `kubectl get pods -o wide` 的 `IP` 列 |

**核心结论**：

- **Node IP** = 节点网卡的真实 IP，是集群外访问的唯一入口
- **ClusterIP** = Service 的虚拟 IP，只存在于集群内部，外部永远访问不到
- **Pod IP** = flannel 从 Pod 网段分配的虚拟 IP，Pod 挂了重建就会变

用一句话记：`Node IP 是门牌号（真实），ClusterIP 是公司前台（内部虚拟），Pod IP 是员工工位号（会变动）`。

---

## Service 端口三件套 <2026-10-16>

**场景**：`kubectl get svc web` 显示 `80:32443/TCP`，这个冒号到底是什么意思？

`80:32443/TCP` 实际是 `port:nodePort`，完整有**三个端口**：

| 端口 | 值 | 含义 |
|------|-----|------|
| **port** | 80 | Service 端口，集群内部访问用 |
| **targetPort** | 80 | 后端 Pod 容器实际监听的端口 |
| **nodePort** | 32443 | 宿主机上对外暴露的端口（默认范围 `30000-32767`） |

> 注意：`80:32443` 是「端口映射关系」，**不是**「安全组放行了端口」。NodePort 只是让 k8s 在宿主机上监听这个端口，放行是安全组层面的事。

**NodePort 完整流量链路**：

```mermaid
flowchart LR
    U["curl 节点IP:32443"] --> KP["kube-proxy<br/>节点上监听 32443"]
    KP --> S["Service<br/>ClusterIP 10.111.238.163:80"]
    S -->|"按 label app=web 找到后端"| E["endpoints<br/>10.244.0.5:80"]
    E --> P["Pod 10.244.0.5<br/>nginx 容器"]
```

**验证命令**：

```bash
kubectl get svc web              # 看 port:nodePort
kubectl get endpoints web        # 看 Service 背后的真实 Pod IP
kubectl get pods -o wide         # 看 Pod IP
kubectl describe svc web         # 看完整的三个端口配置
```

---

## CNI 与 flannel <2026-10-16>

**场景**：cni0、flannel 这些词到底什么关系？

- **CNI**（Container Network Interface）= K8s 定义的一套**网络标准/规范**，规定「插件该怎么给容器配网络」。它是**标准，不是软件**
- **flannel** = 一个**实现了 CNI 标准的具体插件**，负责给 Pod 分配 IP、打通 Pod 之间网络

**比喻**：`CNI 是插座国家标准，flannel 是某个品牌的插座`。除了 flannel，还有 Calico、Cilium 等，都是实现同一标准的不同「品牌插座」。

flannel 的职责：给每个 Pod 分配 IP（从 Pod 网段）、打通同节点和跨节点的 Pod 通信。

---

## 虚拟网卡：cni0 / flannel.1 / veth <2026-10-16>

**场景**：`ip addr` 看到一堆接口，哪些是真实的、哪些是虚拟的、谁创建的？

### 网卡基础：物理网卡 vs 虚拟网卡

- **物理网卡**（`eth1`）= 真实硬件芯片，数据真的从这里经过网线/光纤出去
- **虚拟网卡** = Linux 用软件「假装」出来的网卡，没有真实硬件，但用法和真网卡一样（有 IP、能收发数据）

关键理解：**虚拟网卡不是真实存在的，但系统把它当真网卡对待**——就像游戏里的「虚拟房间」，规则和真房子一样。

### 为什么 K8s 要造虚拟网卡

K8s 的核心需求是「让每个 Pod 像一台独立小电脑，有自己的 IP、互相能通信」，但机器只有一个物理网卡。于是 flannel 用软件造出一堆虚拟网卡：

### flannel 创建的三样东西

| 接口 | 作用 | 类比 |
|------|------|------|
| **veth** | 每个 Pod 的「虚拟网线」 | 工位电话线 |
| **cni0** | 虚拟交换机（网桥），连接同节点所有 Pod | 公司内部交换机 |
| **flannel.1** | vxlan 隧道接口，跨节点通信 | 分公司之间的专线 |

**同节点 Pod 通信走 cni0**：

```
Pod A (10.244.0.2) ──veth──┐
Pod B (10.244.0.3) ──veth──┤── cni0 交换机 (10.244.0.1)
Pod C (10.244.0.5) ──veth──┘
```

**跨节点 Pod 通信走 flannel.1（vxlan 隧道）**：

```
节点A Pod → cni0 → flannel.1(封装) → eth1 → 网络 → 节点B flannel.1(解封装) → cni0 → 节点B Pod
```

> 单节点集群里所有 Pod 都在同一台机器，`flannel.1` 基本用不到，但它仍被创建（为将来加节点做准备）。

### 验证命令

```bash
ip -4 addr show                    # 看所有接口和 IP
ip route                          # 看路由表（10.244.0.0/24 dev cni0）
ls /sys/class/net/cni0/brif/      # 看 cni0 上挂了几个 veth（= Pod 数）
```

**接口来源对照表**：

| 接口 | 谁创建的 | 是否硬件 |
|------|---------|---------|
| `eth1` | 腾讯云/系统 | ✅ 真实物理网卡 |
| `lo` | Linux 系统自带 | 虚拟（回环） |
| `docker0` | Docker | 虚拟网桥 |
| `cni0` | **K8s 的 flannel** | 虚拟网桥 |
| `flannel.1` | **K8s 的 flannel** | 虚拟隧道 |
| `veth...` | **K8s 的 flannel** | 虚拟网线 |

---
