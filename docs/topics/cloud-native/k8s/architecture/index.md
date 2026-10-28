# K8s 架构

记录 Kubernetes 集群架构、Control Plane（Master）组件、Pod 创建全链路、声明式 API 调和循环等知识。

## 知识点

## 集群架构全景 <2026-06-17>

**场景**：系统性学习 K8s 集群架构，理解 Control Plane 与 Worker Node 的分工与协作。

```mermaid
graph TB
    User["kubectl / 用户"] -->|apply YAML| API["API Server<br/>唯一入口"]

    subgraph CP["Control Plane（控制面）"]
        API --> etcd["etcd<br/>分布式 KV 存储"]
        API -.-> Scheduler["Scheduler<br/>Pod 调度"]
        API -.-> CM["Controller Manager<br/>维持期望状态"]
        API -.-> CC["Cloud Controller<br/>对接云厂商"]
    end

    API --> KL["kubelet<br/>节点代理"]
    subgraph WN["Worker Node（工作节点）"]
        KL --> CR["Container Runtime<br/>containerd/Docker"]
        KP["kube-proxy<br/>网络代理"]
        CR --> Pods["Pod · Pod · Pod"]
    end
```

**核心设计原则**：所有组件只与 API Server 通信，组件之间不直接互相调用——松耦合、异步、watch 事件驱动。

**组件清单**：

| 组件 | 位置 | 职责 |
|------|------|------|
| API Server | Control Plane | 集群唯一入口，认证/鉴权/校验 |
| etcd | Control Plane | 分布式 KV 存储（Raft 共识），所有对象真实状态 |
| Scheduler | Control Plane | 为未调度 Pod 选节点（过滤+打分） |
| Controller Manager | Control Plane | 持续对比期望 vs 实际状态 |
| Cloud Controller | Control Plane | 对接云厂商 API（可选） |
| kubelet | Worker Node | 节点代理，watch API Server 并启容器 |
| kube-proxy | Worker Node | 维护 iptables/IPVS 规则，Service 流量转发 |
| Container Runtime | Worker Node | 拉镜像、创建/销毁容器 |

---

## Pod 创建全链路 <2026-06-17>

**场景**：跟踪一个 Pod 从 `kubectl apply` 到容器运行的完整流程。

```mermaid
sequenceDiagram
    participant U as 用户/kubectl
    participant API as API Server
    participant E as etcd
    participant S as Scheduler
    participant K as kubelet (Node-2)
    participant CR as Container Runtime

    U->>API: kubectl apply -f pod.yaml
    API->>API: 校验权限/格式
    API->>E: 持久化 Pod 对象 (status=Pending, nodeName=空)
    E-->>API: 写入成功

    Note over S: watch 到新的未调度 Pod
    S->>API: 查询候选节点
    API-->>S: 节点列表
    S->>S: 过滤 + 打分 → 选出 Node-2
    S->>API: 更新 nodeName=Node-2
    API->>E: 持久化 nodeName

    Note over K: watch 到分配给自己
    K->>API: 获取 Pod 详细 spec
    K->>CR: 拉镜像 + 创建容器
    CR-->>K: 容器启动成功
    K->>API: 更新 status=Running
    API->>E: 持久化状态
```

**精髓**：所有组件松耦合，通过 API Server → etcd → watch 事件这条总线传递信息。Scheduler 不直接调 kubelet，kubelet 不直接调 Scheduler。

---

## 声明式 API 调和循环 <2026-06-17>

**场景**：理解 K8s 声明式 API 的核心——描述"终点"而非"怎么做"。

```mermaid
flowchart LR
    D["期望状态<br/>（Desired）<br/><br/>YAML: replicas=3"] -->|提交| R["Controller<br/>调和循环<br/>（Reconcile）"]
    A["实际状态<br/>（Actual）<br/><br/>只有 2 个 Pod"] -->|watch| R
    R -->|期望≠实际<br/>创建 1 个 Pod| A
    R -.->|上报| D
```

**核心思想**：用户只声明「我要 3 个 nginx」，Controller 持续驱动实际趋近期望——多退少补、挂了自动补、改了自动调。

**YAML 四字段结构**：

```yaml
apiVersion: apps/v1   # API 版本
kind: Deployment      # 资源类型
metadata:             # 元数据（name/labels/namespace）
  name: nginx
spec:                 # 规格定义（期望值）
  replicas: 3
  template: ...
```

---

## 三大核心能力：调度 / 自愈 / 水平伸缩 <2026-10-19>

> 来源：CNCF × 阿里云《云原生技术公开课》第 3 讲「Kubernetes 核心概念」（李响）。

K8s = **工业级容器编排平台**，负责应用的部署、弹性与管理，全部基于容器。名字来自希腊语「舵手 / 飞行员」，`k8s` 是把 `ubernete` 这 8 个字母换成 `8`；取「舵手」是双关——container 另一个含义是「集装箱」，K8s 就是运集装箱的那艘船。

**调度（Scheduling）**：按容器声明的规格找一台放得下的空闲节点。

```mermaid
flowchart LR
    U["提交容器<br/>requests: 1 CPU / 2Gi"] --> S["Scheduler<br/>按规格找空闲节点"]
    S -->|placement| N2["Node-2<br/>最空闲 → 放下"]
    N1["Node-1 已满"] -.-> S
    N3["Node-3 已满"] -.-> S
```

**自动修复（Self-healing）**：节点健康检查持续监控宿主机，发现宿主机 / OS 故障后，把该节点上的容器迁到健康节点。

```mermaid
flowchart LR
    subgraph Bad["故障节点"]
        B1["容器 A"]
        B2["容器 B"]
    end
    HC["节点健康检查"] -->|持续监控| Bad
    HC -->|发现故障| M["迁移"]
    M --> Good["健康节点<br/>容器 A / B 重新拉起"]
```

**水平伸缩**：负载检查发现 CPU 利用率过高 / 响应时间过长 → 扩容，再用负载均衡把流量摊到多份。

```mermaid
flowchart LR
    T["负载检查<br/>CPU 高 / RT 长"] --> S1["Pod × 1（过载）"]
    T -->|扩容| S2["Pod × 3"]
    S2 --> LB["负载均衡<br/>每份承担 1/3"]
```

---

## 组件的部署形态与高可用 <2026-10-19>

Master 四组件的部署形态并不一样，这决定了它们各自的高可用方式：

| 组件 | 部署形态 | 高可用方式 |
|------|----------|-----------|
| API Server | 无状态，**可水平扩展** | 多副本 + 前面挂 LB |
| Controller | **只有一个 active** | 多副本热备，抢 leader |
| Scheduler | **只有一个 active** | 多副本热备，抢 leader |
| etcd | 分布式 KV | Raft 多数派，撑起整个 Master 的高可用 |

二层 + server-client 架构：**User（UI / CLI）只连 Master**，Node 不与用户直连，所有指令由 Master 下发。

```mermaid
graph TB
    U["User / UI / kubectl"] --> M["Master<br/>API Server · Controller · Scheduler · etcd"]
    M --> N1["Node-1"]
    M --> N2["Node-2"]
    M --> N3["Node-3"]
```

Node 侧的能力边界：K8s **自己不做网络和存储**，靠 **Network Plugin（CNI）** 与 **Storage Plugin（CSI）** 落地；Service 那层组网由 **kube-proxy** 借 iptables / IPVS 完成。所以上面「Pod 创建全链路」最后一步 kubelet 调的不只是 Container Runtime，还包括这两类插件。
