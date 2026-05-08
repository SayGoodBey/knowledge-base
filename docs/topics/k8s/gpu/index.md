# GPU 工作负载

记录 K8s + GPU 相关的知识点：GPU device plugin、qGPU 切片、Pod 调度、容器内验证、排障等。

## 知识点

## TCE + qGPU 工作负载从 0 到跑通全流程 <2026-05-07>

**场景**：在 TCE（腾讯私有云，基于 K8s）控制台创建 GPU 工作负载跑 PyTorch，经历了脚本 `Killed`、容器内 `nvidia-smi` 报 NVML Unknown Error、Pod 未就绪、qGPU 切片不生效等一连串问题，最终彻底打通。本文沉淀整条链路。

**环境**：
- 集群：2 节点（`tcs-10-29-25-5`、`tcs-10-29-25-6`），既做 master 又做 worker
- GPU：每节点 2×Tesla V100-SXM2-32GB
- 驱动：`535.216.03` / `535.104.05`（均支持 CUDA ≤ 12.2，向下兼容）
- PyTorch：`1.9.0+cu102`
- qGPU 切片：`qgpu-core: 20`（算力 20%）+ `qgpu-memory: 50`（显存 50%）

### 1. 关键概念：qGPU 资源声明 ≠ 标准 GPU

标准 K8s device plugin 声明：

```yaml
resources:
  limits:
    nvidia.com/gpu: 1     # 整卡
```

qGPU（腾讯 TKE 切片方案）声明：

```yaml
resources:
  limits:
    tke.cloud.tencent.com/qgpu-core:    20   # 整卡算力 20%
    tke.cloud.tencent.com/qgpu-memory:  50   # 整卡显存 50%
```

同一个容器里不能混用两种方式。

### 2. qGPU 启用的三个前置条件（缺一个都不行）

1. **qgpu-operator 在跑**
   ```bash
   kubectl get pods -A | grep -i qgpu
   # 需要看到 qgpu-operator / qgpu-node-feature-discovery 之类 Running
   ```

2. **节点汇报了 qGPU 资源**
   ```bash
   kubectl describe nodes | grep -E "Name:|qgpu"
   # 期望: tke.cloud.tencent.com/qgpu-core: 100  (整卡=100)
   ```

3. **namespace 打了调度策略 label**（最容易漏！）
   ```bash
   kubectl label namespace <ns> \
     tke.cloud.tencent.com/qgpu-schedule-policy=fixed-share
   ```
   策略可选：`best-effort`（默认）、`fixed-share`（严格按比例，推荐）、`burst-share`（按比例+空闲时超用）。

### 3. TCE "System vs Tenant" 命名空间坑

TCE 平台根据 namespace label 把工作负载分成 System（系统）和 Tenant（租户）两类。**新建 namespace 如果只有 K8s 自动加的默认 label `kubernetes.io/metadata.name`，会被识别为 System**，导致 qGPU 调度器不注入策略、Pod 卡在未就绪。

**诊断**：

```bash
# 对比能跑通的 namespace 和有问题的 namespace
kubectl get ns <good-ns> -o yaml > /tmp/good.yaml
kubectl get ns <bad-ns>  -o yaml > /tmp/bad.yaml
diff /tmp/good.yaml /tmp/bad.yaml
```

把好 ns 多出来的 label 抄过去即可。

### 4. NVML Unknown Error 专项

**现象**：容器内 `nvidia-smi` 报 `Failed to initialize NVML: Unknown Error`，但 `/dev/nvidia*` 设备文件存在、`/proc/driver/nvidia/version` 也能读到驱动。

**根因**：NVIDIA Container Toolkit + systemd/cgroup 交互 bug。容器启动时 GPU 能用，但运行中宿主机上一次 `systemctl daemon-reload` / docker 重启 / cgroup v2 + 旧驱动就会把容器的 GPU cgroup 设备白名单清空，设备节点还在但内核不让访问。

**快速验证**：

```bash
ls -l /dev/nvidia*
# 如果 /dev/nvidia-uvm 和 /dev/nvidiaN 的时间戳差很大 → 发生过重新 attach，八成就是这个 bug
```

**修复优先级**：
1. **重启 Pod**（最快）：`kubectl delete pod <name> -n <ns>` 让它重建。99% 能恢复。
2. **宿主机根治**：`/etc/nvidia-container-runtime/config.toml` 加 `no-cgroups = true`，重启 docker。
3. **privileged 或显式 device 映射**（绕过 cgroup）：`--privileged` 或 `--device=/dev/nvidia*`。

### 5. 节点污点与容忍度

```bash
# 快速查所有节点污点
kubectl get nodes -o custom-columns=NAME:.metadata.name,TAINTS:.spec.taints
```

- 节点 `TAINTS: <none>` → **不需要配 tolerations**，直接部署即可
- 节点有污点 `nvidia.com/gpu=true:NoSchedule` → 需要在 Pod spec 里加：
  ```yaml
  tolerations:
  - key: "nvidia.com/gpu"
    operator: "Exists"
    effect: "NoSchedule"
  ```

**顺带解释** `node-role.kubernetes.io/master:NoSchedule`：K8s 默认给 master 节点加的污点，防止业务 pod 跑到 master 上抢资源影响控制平面稳定。小集群（比如本次 2 节点 all-in-one）可能会把这个污点移除让 master 也当 worker 用——方便但有风险，生产环境不推荐。

### 6. Pod 诊断三板斧

```bash
# ① 一眼看全集群异常 Pod
kubectl get po -A | grep -vE "Running|Completed"

# ② 看具体 Pod 状态
kubectl get pods -n <ns> -l app=<name> -o wide

# ③ 看 Pod 详细事件（最关键）
kubectl describe pod -n <ns> -l app=<name> | tail -50
```

**常见 STATUS 对照**：

| STATUS | 含义 | 排查方向 |
|---|---|---|
| `Pending` | 没分配到节点 | 资源不足 / 调度规则 |
| `ContainerCreating` 卡死 | 镜像/卷问题 | `describe` 看详情 |
| `ImagePullBackOff` | 拉镜像失败 | 镜像名、私服认证、网络 |
| `CrashLoopBackOff` | 起来立即崩 | `kubectl logs --previous` |
| `Running` 但 `READY=0/1` | Probe 失败 | 探针配置或应用未就绪 |
| `OOMKilled` | 内存爆 | 调大 limits.memory |

**常见调度失败事件对照**：

| 事件文本 | 原因 | 修复 |
|---|---|---|
| `Insufficient nvidia.com/gpu` / `Insufficient tke.cloud.tencent.com/qgpu-core` | GPU 被分完 | 看 `kubectl describe nodes` 剩余量 |
| `untolerated taint` | 节点污点未容忍 | 加 tolerations |
| `didn't match node selector` | nodeSelector 错 | 对照节点 label 重写 |
| `admission webhook denied` | Webhook 拦截 | 看 webhook 日志 |

### 7. "宿主机 nvidia-smi 看不到负载"的陷阱

**陷阱**：在任一 GPU 节点跑 `nvidia-smi` 看 GPU-Util 是 0%，就以为 Pod 没在用 GPU。

**真相**：`nvidia-smi` 只能看**本机**的 GPU。Pod 可能调度到另一台节点上。必须：

```bash
# 先查 Pod 所在节点
NODE=$(kubectl get pod -n <ns> <pod> -o jsonpath='{.spec.nodeName}')
echo "Pod 在: $NODE"

# SSH 到 Pod 所在节点再看
ssh $NODE 'nvidia-smi'
```

### 8. 容器内 GPU 验证链路

```bash
# ① PyTorch + CUDA 可用性
python -c "import torch; print(torch.__version__, torch.version.cuda, torch.cuda.is_available(), torch.cuda.device_count())"
# torch.version.cuda 为 None → CPU 版 PyTorch，需要换镜像

# ② 设备/驱动链路
ls -l /dev/nvidia* 2>&1
cat /proc/driver/nvidia/version 2>/dev/null | head -1
nvidia-smi 2>&1 | head -20

# ③ qGPU 注入的环境变量
env | grep -iE "cuda|nvidia|gpu|qgpu"
```

一段真实 GPU 负载测试（用来观察实际利用率）：

```python
import torch, time
assert torch.cuda.is_available()
x = torch.randn(4096, 4096, device='cuda')
y = torch.randn(4096, 4096, device='cuda')
for _ in range(5): z = x @ y    # warmup
torch.cuda.synchronize()
t0 = time.time()
for _ in range(100): z = x @ y
torch.cuda.synchronize()
print(f"{(time.time()-t0)/100*1000:.2f} ms/iter")
```

**参考耗时**：
- V100 整卡 ~3 ms/iter
- V100 qGPU 20% 切片 ~15-20 ms/iter
- CPU 数百 ms 到数秒（差几个数量级）

### 9. 宿主机视角的"真在干活"指标

比 GPU-Util 更诚实的是温度、功耗、显存：

| 状态 | GPU-Util | 显存 | 温度 | 功耗 |
|---|---|---|---|---|
| 空闲 | 0% | 0 MiB | ~33℃ | ~30W |
| qGPU 20% 切片跑 matmul | 20~26% | 1-2 GiB | ~48℃ | ~85W |
| 整卡跑大模型训练 | 95~99% | 数 GB~数十 GB | 65~80℃ | 250~300W |

qGPU core 实际可能浮动 ±5%（20% 配额跑到 26% 正常）。

### 10. "关闭 VNC 也不掉"的后台运行方案

**核心三件套**：

```bash
nohup python -u script.py > /tmp/gpu.log 2>&1 &
echo $! > /tmp/gpu.pid
disown
```

- `nohup` 忽略 SIGHUP（VNC 关闭发的挂断信号）
- `python -u` 无缓冲输出，日志实时可见
- `&` + `disown` 后台运行 + 脱离 shell 作业表
- 重定向输出到文件，不依赖终端
- PID 文件便于停止/查询

**更优方案：tmux**（断开后能再接回）：

```bash
tmux new -s gpu
python script.py
# Ctrl+B D 脱离
# 下次 tmux attach -t gpu 接回
```

**两个容易忽略的坑**：

- 容器 `/root/*` 是临时文件系统，Pod 重建后会丢。长期用要放 PVC 或打进镜像。
- 容器 PID 1 如果是 shell（而不是 `sleep infinity` / `tail -f` / systemd），退出 VNC 可能导致 PID 1 退出 → 整个容器重启。用 `cat /proc/1/comm` 验证。

### 11. 最小可用 Deployment 模板（qGPU 版）

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: gpu-demo
  namespace: <确保 ns 已打 qgpu-schedule-policy label>
spec:
  replicas: 1
  selector: { matchLabels: { app: gpu-demo } }
  template:
    metadata: { labels: { app: gpu-demo } }
    spec:
      containers:
      - name: torch
        image: <带 CUDA 的镜像>   # e.g. pytorch/pytorch:1.9.0-cuda10.2-cudnn7-runtime
        command: ["sleep", "infinity"]   # 保持常驻，方便 exec 进去
        resources:
          limits:
            tke.cloud.tencent.com/qgpu-core:    20
            tke.cloud.tencent.com/qgpu-memory:  50
```

---

## qGPU Checkpoint 僵尸分配导致调度失败 <2026-05-08>

**场景**：创建 GPU 整卡工作负载（`qgpu-core: 100`），Pod 一直 Pending，但 `nvidia-smi` 显示 GPU 物理层面完全空闲。

**根因**：kubelet 的 device-plugin checkpoint 文件（`/var/lib/kubelet/device-plugins/kubelet_internal_checkpoint`）残留了已删除 Pod 的 GPU 分配记录，导致 qGPU 调度器误认为资源已被占用。

**调度器报错示例**：
```
0/2 nodes are available:
  1 failed to allocate (100, 0, 1) on (80, 11, 16)(90, 11, 16)
  1 failed to allocate (100, 0, 1) on (90, 11, 16)(90, 11, 16)
```
格式：`(请求core, 请求memory, 卡数)` on `(已用core, 已用卡数, 总卡数)(...)`

**排查路弄**：

```bash
# 1. 确认 Pod Pending
kubectl describe pod <name> | grep -A 5 Events

# 2. nvidia-smi 确认物理GPU空闲
nvidia-smi

# 3. 查看 checkpoint 文件（在节点上执行）
cat /var/lib/kubelet/device-plugins/kubelet_internal_checkpoint
# 看 PodDeviceEntries 中的 PodUID

# 4. 验证这些 Pod 是否还存在
kubectl get pods --all-namespaces --field-selector metadata.uid=<pod-uid>
# 如果查不到 → 确认是僵尸分配
```

**解决方案**：

```bash
# 方案 1：重启 kubelet（推荐，会自动重建 checkpoint）
systemctl restart kubelet

# 方案 2：手动清理 checkpoint
systemctl stop kubelet
rm /var/lib/kubelet/device-plugins/kubelet_internal_checkpoint
systemctl start kubelet

# 方案 3：同时重启 qGPU plugin + kubelet
docker ps | grep qgpu
docker restart <qgpu-container-id>
systemctl restart kubelet
```

**重启 kubelet 的影响**：
- 节点上现有 Pod 短暂失联（10-30秒）
- 容器进程不会被杀死
- 如有重要业务，先 `kubectl cordon <node>` 禁止新调度，操作完后 `kubectl uncordon`

**关键经验**：
- qGPU 整卡请求（core=100）不能和共享 Pod 混在同一张 GPU 上
- 物理空闲 ≠ 逻辑空闲，`nvidia-smi` 只反映物理状态，checkpoint 才是调度器的判断依据
- Pod 被强制删除（如 `--force --grace-period=0`）后更容易出现 checkpoint 残留
- YAML 中 `cpu: '0'` 和 `memory: '0'` 不合理，应设实际值

---

## 关键结论速查

1. **节点 `TAINTS: <none>` → 不用配 tolerations**
2. **qGPU 不生效 90% 是 namespace label 缺失**（忘打 `qgpu-schedule-policy`）
3. **NVML Unknown Error → 基本是 cgroup 设备白名单丢失，重启 Pod 最快**
4. **在非 GPU 宿主机跑 `nvidia-smi` 看不到负载是正常的，必须 SSH 到 Pod 所在节点**
5. **验证 GPU 真在跑：看温度/功耗/显存三个指标比 Util% 更诚实**
6. **qGPU core 配额有 ±5% 浮动（20% 跑到 26%），属正常**
7. **宿主机驱动版本 ≥ PyTorch 要求的 CUDA 就行，不需要完全匹配（CUDA 向下兼容）**
8. **VNC 关闭 ≠ 进程退出**，`nohup + disown + 重定向 + python -u` 四件套后台稳跑

---
