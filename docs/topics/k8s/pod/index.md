# Pod

记录 Pod 生命周期、Init Container、Sidecar、资源限制等知识。

## 知识点

## Pod 未就绪的三板斧诊断 <2026-05-07>

**场景**：在 TCE 控制台创建工作负载，状态显示「未就绪 0/2」，两个副本都没拉起来。

**要点**：

```bash
# ① 一眼看全集群异常 Pod
kubectl get po -A | grep -vE "Running|Completed"

# ② 看具体 Pod 状态（READY、STATUS、NODE）
kubectl get pods -n <ns> -l app=<name> -o wide

# ③ 看 Pod 详细事件（最关键，90% 问题在这里）
kubectl describe pod -n <ns> -l app=<name> | tail -50
```

**常见 STATUS 对照表**：

| STATUS | 排查方向 |
|---|---|
| `Pending` | 资源不足 / 调度规则 |
| `ContainerCreating` 卡死 | 镜像/卷问题 |
| `ImagePullBackOff` | 镜像名、私服认证、网络 |
| `CrashLoopBackOff` | `kubectl logs --previous` |
| `Running` 但 `READY=0/1` | 探针失败 |
| `OOMKilled` | 调大 limits.memory |

**Deployment → ReplicaSet → Pod → Container** 由上至下逐层钻取，事件区 `Events:` 的 Warning 直接给答案。

详见 [GPU 工作负载](../gpu/) 里的完整 TCE + qGPU 排障案例。

## Pod 核心概念 <2026-06-17>

**场景**：系统性学习 Kubernetes Pod 的核心设计理念。

**Pod = 容器的「机箱」**：最小调度单元，包含一个或多个紧密协作的容器。

**共享机制**：
- **网络**：Pod 级别的 IP（不是容器级别），同一 Pod 内容器共享 IP，`localhost` 即可通信。不能两个容器抢同一个端口
- **Volume**：同一 Pod 内所有容器共享 Volume 挂载点
- **生命周期**：同生同死，一起调度、一起销毁

**Sidecar 模式**：主容器写日志到 `/var/log` → Sidecar 容器读同一个 Volume → 转发到日志中心。不需要走网络、不走内存拷贝。

**与 Deployment 的关系**：Deployment → ReplicaSet → Pod。Deployment 管版本，ReplicaSet 管数量，Pod 跑容器。

---

**与之前知识的关联**：Pod 未就绪排查案例中的 `kubectl describe pod` 就是查看这个最小单元的内部状态。理解 Pod 是网络 + 存储的共享容器组，才能理解为什么"不同容器看到的日志文件是同一份"。

---

