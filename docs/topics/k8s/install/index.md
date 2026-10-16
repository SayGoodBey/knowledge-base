# kubeadm 安装部署

记录用 kubeadm 从零部署 K8s 单节点集群的完整流程和踩坑。

## 完整安装流程 <2026-10-16>

**环境**：TencentOS Server 4.4（RHEL9 系）、containerd 1.7.29、32C/61G、swap/selinux/firewalld 已关。

### 第 1 步：内核与网络参数

```bash
# 加载内核模块
cat > /etc/modules-load.d/k8s.conf <<'EOF'
overlay
br_netfilter
EOF
modprobe br_netfilter

# 开启网络转发
cat > /etc/sysctl.d/k8s.conf <<'EOF'
net.bridge.bridge-nf-call-iptables  = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.ipv4.ip_forward                 = 1
EOF
sysctl --system
```

### 第 2 步：配置 containerd（容器运行时）

```bash
containerd config default > /etc/containerd/config.toml

# 用国内 pause 镜像 + 开启 systemd cgroup
sed -i 's#sandbox_image = "registry.k8s.io/pause:3.8"#sandbox_image = "registry.aliyuncs.com/google_containers/pause:3.10"#' /etc/containerd/config.toml
sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml

systemctl enable --now containerd
systemctl restart containerd
```

### 第 3 步：安装 kubeadm / kubelet / kubectl

```bash
# 配阿里云镜像源
cat > /etc/yum.repos.d/kubernetes.repo <<'EOF'
[kubernetes]
name=Kubernetes
baseurl=https://mirrors.aliyun.com/kubernetes-new/core/stable/v1.32/rpm/
enabled=1
gpgcheck=0
EOF

dnf install -y kubelet kubeadm kubectl
systemctl enable kubelet
```

### 第 4 步：初始化集群（kubeadm init）

```bash
kubeadm init \
  --apiserver-advertise-address=30.184.62.206 \   # 本机内网 IP
  --pod-network-cidr=10.244.0.0/16 \              # Pod 网段（flannel 用这个）
  --image-repository=registry.aliyuncs.com/google_containers \
  --kubernetes-version=v1.32.13
```

### 第 5 步：让 kubectl 能用

```bash
mkdir -p $HOME/.kube
cp -f /etc/kubernetes/admin.conf $HOME/.kube/config
```

### 第 6 步：安装网络插件 flannel

```bash
kubectl apply -f https://raw.githubusercontent.com/flannel-io/flannel/master/Documentation/kube-flannel.yml
```

### 第 7 步（单节点必需）：解除 master 污点

```bash
kubectl taint nodes --all node-role.kubernetes.io/control-plane-
```

> 默认 master 节点带 NoSchedule 污点、不让业务 Pod 调度上来。单节点必须解除，否则自己部署的应用跑不起来。

### 第 8 步（TencentOS 特有坑）：修复 CNI 插件路径

```bash
for f in /usr/libexec/cni/*; do ln -sf "$f" /opt/cni/bin/$(basename "$f"); done
```

---

## 踩坑：CNI 插件路径 <2026-10-16>

**问题**：Pod 一直 `ContainerCreating`，事件反复报错：

```
failed to setup network for sandbox: failed to find plugin "loopback" in path [/opt/cni/bin]
```

**根因**：`containerd config default` 生成的配置默认 `bin_dir = /opt/cni/bin`，但 TencentOS 的 CNI 插件（loopback/bridge 等）实际装在 `/usr/libexec/cni/`，导致 containerd 找不到插件，Pod 网络沙箱创建失败。

**解决**：把标准插件软链到 containerd 找的路径：

```bash
for f in /usr/libexec/cni/*; do ln -sf "$f" /opt/cni/bin/$(basename "$f"); done
```

**教训**：生成 containerd 默认配置后，要检查 `bin_dir` 是否指向系统实际安装插件的位置；不同发行版插件路径可能不同（Debian 系通常是 `/opt/cni/bin`，TencentOS 是 `/usr/libexec/cni/`）。

---

## kubeadm init 参数说明 <2026-10-16>

| 参数 | 作用 |
|------|------|
| `--apiserver-advertise-address` | API Server 对外 IP（填节点内网 IP，避免多网卡自动探测选错） |
| `--pod-network-cidr` | Pod 网段（flannel 用 `10.244.0.0/16`，Calico 用 `192.168.0.0/16`） |
| `--image-repository` | 镜像仓库（国内用阿里云 `registry.aliyuncs.com/google_containers` 避免拉取失败） |
| `--kubernetes-version` | 指定版本（不写则用仓库最新） |

---

## 单节点解除污点 <2026-10-16>

master 节点默认带污点 `node-role.kubernetes.io/control-plane:NoSchedule`，意味着普通 Pod 不会调度上来。单节点部署时节点既是 master 又是 worker，必须解除：

```bash
kubectl taint nodes --all node-role.kubernetes.io/control-plane-
```

验证：`kubectl get nodes` 应显示 `Ready`，`kubectl describe node <name> | grep Taints` 应为空或只剩系统污点。

---

## 初始化完成后各 Pod 清单 <2026-10-16>

`kubectl get pods -A` 看到的一堆 Pod，分三类：

| 命名空间 | Pod | 作用 |
|---------|-----|------|
| `kube-system` | `etcd` | K8s 数据库，存集群数据 |
| `kube-system` | `kube-apiserver` | 集群唯一入口 |
| `kube-system` | `kube-controller-manager` | 维持期望状态 |
| `kube-system` | `kube-scheduler` | 决定 Pod 放哪台节点 |
| `kube-system` | `kube-proxy` | Service 流量转发 |
| `kube-system` | `coredns` ×2 | 集群内 DNS 解析 |
| `kube-flannel` | `kube-flannel-ds` | 容器网络插件 |
| `default` | 你自己部署的应用 | 业务 Pod |

前 7 个是 K8s 自带的控制平面组件，就是集群本身，不用管。
