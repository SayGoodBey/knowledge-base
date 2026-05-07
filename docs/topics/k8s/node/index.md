# Node

记录 K8s 节点管理、调度策略、污点容忍等知识。

## 知识点

## 污点（Taint）与容忍度（Toleration） <2026-05-07>

**场景**：创建 GPU 工作负载时，想让 Pod 能调度到带污点的节点上。

**要点**：

```bash
# 快速查所有节点的污点
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
```

- 节点 `TAINTS: <none>` → **不需要配 tolerations**，直接部署即可
- 节点有污点 `key=value:effect` → Pod spec 里用 `tolerations` 精确匹配（或 `operator: Exists` 宽匹配）

**effect 三种**：

| effect | 新 Pod | 已运行 Pod |
|---|---|---|
| `NoSchedule` | ❌ 不来 | ✅ 不动 |
| `PreferNoSchedule` | ⚠️ 尽量别来 | ✅ 不动 |
| `NoExecute` | ❌ 不来 | ❌ 驱逐（无 toleration 时）|

**经典例子** `node-role.kubernetes.io/master:NoSchedule`：K8s 默认给 master 加的污点，防业务 Pod 占用 master 影响控制平面。小集群可能会移除让 master 兼做 worker，方便但有风险。

**容忍度 vs 节点选择器的区别**：
- `tolerations`：「**允许**调度到有污点的节点」——解锁权限
- `nodeSelector` / `nodeAffinity`：「**必须**调度到满足条件的节点」——强制规则

两者经常配合使用。

---

## 查看所有节点 GPU 资源分布 <2026-05-07>

**场景**：想看集群里哪些节点有 GPU、分了多少、剩多少。

**要点**：

```bash
# 标准 GPU device plugin
kubectl describe nodes | grep -E "Name:|nvidia.com/gpu"

# qGPU（腾讯 TKE 切片方案）
kubectl describe nodes | grep -E "Name:|qgpu"

# JSON 结构化输出
kubectl get nodes -o json | jq -r '.items[] | "\(.metadata.name)  capacity=\(.status.capacity["nvidia.com/gpu"] // "0")  allocatable=\(.status.allocatable["nvidia.com/gpu"] // "0")"'
```

**注意**：`nvidia-smi` 只能看本机的 GPU。Pod 可能调度到别的节点上，**想看 Pod 实际 GPU 负载必须 SSH 到 Pod 所在节点**：

```bash
NODE=$(kubectl get pod -n <ns> <pod> -o jsonpath='{.spec.nodeName}')
ssh $NODE 'nvidia-smi -l 1'
```

---

