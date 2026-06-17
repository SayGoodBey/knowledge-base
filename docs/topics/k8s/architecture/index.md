# K8s 架构

记录 Kubernetes 架构、Control Plane/Master、etcd、Scheduler、Controller 等核心组件知识。

## 知识点

## K8s 架构全景 <2026-06-17>

**场景**：系统性学习 Kubernetes 核心概念，从架构到 API 到核心资源。

**Control Plane（Master）组件**：

| 组件 | 职责 | 一句话 |
|------|------|--------|
| API Server | 集群唯一入口 | 所有操作必经，组件不互相直接调用 |
| etcd | 分布式 KV 存储 | 集群全部状态的唯一真相源（source of truth） |
| Scheduler | 调度器 | 为待调度的 Pod 选择最优节点（过滤 + 打分） |
| Controller Manager | 控制器 | 持续对比期望状态 vs 实际状态，趋近期望 |
| Cloud Controller | 云控制器 | 对接云厂商的 LB、磁盘、节点 |

**Worker Node 组件**：

| 组件 | 职责 |
|------|------|
| kubelet | 节点代理，watch API Server 并启停容器 |
| kube-proxy | 网络代理，维护 iptables/IPVS 规则转发 Service 流量 |
| Container Runtime | 容器运行时（containerd / CRI-O） |

**核心设计原则**：所有组件只与 API Server 通信，组件之间不直接互相调用。松耦合、异步、基于 watch 事件。

**Pod 创建全链路**：
1. `kubectl apply` → API Server（校验权限和格式）
2. API Server 持久写入 etcd（状态=Pending，nodeName 为空）
3. Scheduler watch 到新 Pod → 过滤 + 打分 → 选出最优节点 → API Server 更新 nodeName
4. 目标节点 kubelet watch 到分配给自己 → 拉镜像 → 启容器 → 更新状态=Running

**etcd 不是 K8s 专用**：独立的分布式 KV 存储（CoreOS 创建，CNCF 毕业项目），K8s 选它因为强一致性（Raft）+ watch 推送 + 高可用。

**声明式调和循环（Reconcile Loop）**：用户声明期望状态 → Controller 持续对比期望 vs 实际 → 驱动实际趋近期望。YAML 描述的是「终点」，不是「怎么做」。

---
