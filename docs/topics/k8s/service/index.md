# Service

记录 Service 类型、负载均衡、服务发现、Ingress 路由、网络模型等知识。

## 知识点

## Service 核心价值 <2026-06-17>

**场景**：理解为什么 Pod IP 不能用，Service 如何解决。

Pod 销毁重建 IP 变、扩缩容 IP 变多变少——不能直接用 Pod IP 做服务调用。Service 提供一个**永不改变的虚拟 IP（ClusterIP）**。

```mermaid
flowchart TB
    S["Service<br/>ClusterIP: 10.96.0.100<br/>（永不改变）"]
    S -->|Label Selector: app=nginx| P1["Pod A<br/>172.17.0.2"]
    S --> P2["Pod B<br/>172.17.0.3"]
    S --> P3["Pod C（新）<br/>172.17.0.4"]

    KP["kube-proxy<br/>维护 iptables/IPVS 规则<br/>在每个节点运行"]
    S -.-> KP
    KP -.-> P1
    KP -.-> P2
    KP -.-> P3
```

**三种暴露方式**：

| 类型 | 使用场景 | 示例 |
|------|----------|------|
| ClusterIP（默认） | 集群内部访问 | `10.96.0.100:80` |
| NodePort | 外部直连节点 | `<任意节点IP>:30001` |
| LoadBalancer | 云厂商 LB | 公网 IP 自动分配 |

---

## K8s 网络模型 <2026-06-17>

**场景**：理解 Pod 跨节点通信的原理。

**K8s 三大网络铁律**：
1. 每个 Pod 有独立 IP（没有端口冲突问题）
2. Pod 可以跨节点直接通信（无需 NAT）
3. Node IP 与 Pod IP 互通

```mermaid
flowchart LR
    subgraph N1["Node 1（10.0.0.1）"]
        PA["Pod A<br/>172.17.0.2"]
        PB["Pod B<br/>172.17.0.3"]
        CNI1["cni0 网桥<br/>Calico/Flannel"]
    end
    subgraph N2["Node 2（10.0.0.2）"]
        PC["Pod C<br/>172.17.1.2"]
        PD["Pod D<br/>172.17.1.3"]
        CNI2["cni0 网桥<br/>Calico/Flannel"]
    end
    N1 <-->|overlay 网络| N2
```

**外部访问链路**：

```mermaid
flowchart LR
    User["外部用户"] -->|域名| Ingress["Ingress<br/>七层路由 · TLS"]
    Ingress -->|路径匹配| S1["Service A<br/>/api"]
    Ingress -->|路径匹配| S2["Service B<br/>/web"]
    S1 --> P1["Pod"]
    S2 --> P2["Pod"]
```

---

## HPA 自动扩缩 <2026-06-17>

**场景**：业务负载波动时，HPA 自动调整副本数 + Service 自动感知。

```mermaid
flowchart LR
    HPA["HPA<br/>监控 CPU/内存"] -->|"CPU > 80%<br/>replicas: 2→5"| D["Deployment"]
    D --> RS["ReplicaSet"]
    RS --> P["Pod × 5"]

    S["Service<br/>Label Selector 自动感知"]
    S --> P

    HPA2["负载降低"] -->|"CPU < 50%<br/>replicas: 5→2"| D
```

pod 扩缩、Service 自动感知新 Pod、自动负载均衡——全自动。
