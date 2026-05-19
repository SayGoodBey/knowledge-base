# 容器技术

## 核心概念 <2026-05-18>

### 容器

**定义**: 和系统其他部分隔离开的**进程集合**

- 容器不是虚拟机，本质就是进程
- 这些进程被 Namespace + Cgroups "圈"起来——看不到外面、也不能用超额资源
- "进程集合"——一个容器里可以有多个进程（但推荐只有一个主进程）

### 镜像

**定义**: 容器所需要的**所有文件集合** — Build once, Run anywhere

- 镜像 = 文件系统快照（代码 + 依赖 + 配置 + 运行时）
- Build once — 构建一次打成镜像
- Run anywhere — 在任何有容器引擎的地方都能跑

### 两者关系

| | 类比 | 说明 |
|---|---|---|
| 镜像 | "菜谱" | 静态的文件集合 |
| 容器 | "做出来的菜" | 运行中的隔离进程 |

镜像提供文件 → 容器引擎用这些文件启动隔离的进程 → 就是一个运行中的容器。

---

## 容器生命周期 <2026-05-18>

### 单进程模型

```
容器启动 → Init 进程（PID 1）启动
      ↓
Init 进程运行中 → 容器运行中
      ↓
Init 进程退出 → 容器停止 ☠️
```

**关键点:**
- PID 1 进程（Init 进程）就是容器的"灵魂"
- "单进程模型"不是说只能有一个进程，而是只有 PID 1 的生死决定容器的生死
- `docker exec` 启动的是额外进程，退出不影响容器（用于调试运维）

### 数据持久化

容器可写层是临时的（ephemeral），容器删除数据就丢。要持久化数据，必须用数据卷——生命周期独立于容器。

**两种数据卷方式:**

| 方式 | 命令示例 | 数据存放位置 |
|------|---------|-------------|
| Bind Mount | `docker run -v /host/path:/container/path ...` | 宿主机你指定的目录 |
| Docker Volume（推荐） | `docker volume create mydata` + `docker run -v mydata:/data ...` | Docker 托管 `/var/lib/docker/volumes/` |

**查看日志两种方式:**

| 方式 | 命令 | 场景 |
|------|------|------|
| `docker logs` | `docker logs -f demo` | 查看 stdout/stderr（推荐） |
| exec + cat | `docker exec demo cat /var/log/app.log` | 查看容器内日志文件 |

**最佳实践:** 云原生推荐日志输出到 stdout/stderr，不写文件：
- ✅ `docker logs` 直接看
- ✅ K8s Fluentd 自动采集
- ✅ 不撑爆容器内磁盘

---

## 镜像分层机制 <2026-05-18>

**场景**: 理解 Docker 镜像是如何组织文件的

**要点:**
- 每一层就像对磁盘做了一次快照，只记录相对于上一层的变化（增/删/改了哪些文件）
- 类似 Git commit：每个 commit 只记录 diff，多个分支共享相同的历史 commit
- 好处：复用层（100 个容器用同一个 alpine 只存一份）、增量下载、节省磁盘

---

## Dockerfile 核心指令 <2026-05-18>

### COPY vs ADD

| 指令 | 功能 | 建议 |
|------|------|------|
| COPY | 单纯复制文件 | ✅ 优先使用 |
| ADD | 复制 + 自动解压 tar + 支持 URL | ⚠️ 只在需要解压时用 |

Docker 官方建议：能用 COPY 就不用 ADD，因为 COPY 行为更明确可预测。

### 分层 COPY 优化构建（利用层缓存）

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./     # ← 先复制依赖声明
RUN npm install           # ← 安装依赖
COPY . .                  # ← 再复制源码
```

改源码时只重建最后一层，`npm install` 命中缓存 → 大幅加速构建。

### docker build -t

给镜像"取名字"，方便后续引用和管理：

```bash
docker build . -t app:v1              # 镜像名 app，标签 v1
docker build . -t app:v1 -t app:latest  # 同时打多个标签
```

### docker run 参数

```bash
docker run [-d] --name demo busybox:1.25 top
#         │      │           │           │
#         │      │           │           └─ 执行的命令
#         │      │           └─────────── 镜像:tag
#         │      └──────────────────────── 容器名
#         └──────────────────────────────── 后台运行（detach）
```

---

## 容器 vs VM <2026-05-18>

| 对比项 | 容器 | 虚拟机 |
|--------|------|--------|
| 本质 | 进程隔离 | 硬件模拟 |
| 隔离方式 | Namespace + Cgroups | Hypervisor |
| 启动速度 | 秒级 | 分钟级 |
| 体积 | MB 级 | GB 级 |
| 性能 | 接近原生 | 有损耗 |
| 安全性 | 共享内核（相对弱） | 独立内核（更强） |

---

## 云原生架构标准 <2026-05-18>

以下标准可用来考察应用架构是否"云原生"：

- ✅ **弹性水平扩展** — 实例能快速 Scale out
- ✅ **镜像打包** — 使用镜像保证环境一致性
- ✅ **数据写在数据卷** — 不依赖容器可写层
- ✅ **声明式 API** — 描述期望状态
- ✅ **不可变基础设施** — 容器运行后不修改
- ✅ **自动化运维** — 自愈、滚动更新

**不可变基础设施原则:**
- 需要修改文件 → 改 Dockerfile，重新构建镜像
- 需要配置变更 → 用 ConfigMap / Secret
- 需要持久化数据 → 用 PV/PVC
- 需要调试 → `kubectl exec` 临时进入（不改生产）
- 口诀：容器是"养牛"不是"养宠物"——坏了就换新的

---

## Kubernetes 定位 <2026-05-18>

- K8s 是容器编排平台，**不是 PaaS**
- 提供编排"原语"（Pod、Service、Deployment 等）
- 不提供完整应用开发流程（构建、日志、监控需自建或用插件）
- 可以基于 K8s 构建 PaaS（KubeSphere、Rancher），但 K8s 本身不是
- 标准扩展机制：CNI、CSI、CRD、Operator、Device Plugin

### 与 K8s 功能重合度最高的项目

**SwarmKit / Docker Swarm 模式**（非旧版 Docker Swarm）

| 项目 | 定位 | 与 K8s 重合度 |
|------|------|--------------|
| Docker Swarm 模式（SwarmKit） | 容器编排引擎 | ⭐⭐⭐⭐⭐ |
| Docker Swarm（旧版） | 轻量编排 | ⭐⭐⭐ |
| Mesos | 通用资源调度器 | ⭐⭐ |
| Cloud Foundry | PaaS 平台 | ⭐⭐ |

SwarmKit 是 Docker 1.12+ 内置的全功能编排引擎（2016），直接对标 K8s。2017 年 Docker 公司宣布原生支持 K8s，竞争结束。

### 云原生不等于必须用 CNCF 项目

- CNCF 只是治理组织，不是"必选清单"
- 关键是遵循设计原则，而非绑定特定项目
- 用 AWS ECS + 容器化 + 自动弹性 + CI/CD = 同样是云原生架构
