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

---

