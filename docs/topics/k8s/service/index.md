# Service

记录 Service 类型、虚拟 IP、负载均衡、Ingress、kube-proxy 等知识。

## 知识点

## Service 核心概念 <2026-06-17>

**场景**：学习 Service 如何解决 Pod IP 不稳定带来的服务发现问题。

**问题**：Pod 销毁重建 IP 变、扩缩容 IP 变多变少 → 不能直接用 Pod IP 调用。

**解决**：Service 提供一个**永不改变的虚拟 IP（ClusterIP）**，通过 Label Selector（`app=nginx`）自动发现后端 Pod。

**三种暴露方式（逐层递进）**：

| 类型 | 访问范围 | 说明 |
|------|----------|------|
| ClusterIP | 集群内部 | 默认，10.96.x.x 虚拟 IP |
| NodePort | 外部（节点端口） | 每个节点开 30000-32767 端口 |
| LoadBalancer | 外部（云 LB） | 自动创建云厂商 LB，分配公网 IP |

**kube-proxy**：每个节点运行，维护 iptables/IPVS 规则，把 Service IP 流量转发到实际 Pod。

---

## Ingress <2026-06-17>

**场景**：七层（HTTP/HTTPS）路由，比 Service 更上层。

- 域名 + 路径 → 不同 Service（`api.example.com/v1` → user-svc, `api.example.com/v2` → user-v2-svc）
- TLS 终止
- 比 NodePort/LoadBalancer 更灵活的路由规则

---
