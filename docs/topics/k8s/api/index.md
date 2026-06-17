# K8s API 基础

记录 Kubernetes API 设计、Label/Selector、Namespace、YAML 结构等知识。

## 知识点

## API 设计基础 <2026-06-17>

**场景**：学习 K8s API 的基本形式，理解所有资源的统一结构。

**访问方式**：
- `kubectl` 命令行工具
- Dashboard Web UI
- 直接用 `curl` 调 REST API

**REST URL 格式**：`/api/v1/namespaces/{ns}/pods/{name}`

**YAML 四字段结构**（所有资源通用）：

| 字段 | 含义 | 示例 |
|------|------|------|
| `apiVersion` | API 版本 | `v1`, `apps/v1`, `networking.k8s.io/v1` |
| `kind` | 资源类型 | `Pod`, `Service`, `Deployment` |
| `metadata` | 元数据 | `name`, `labels`, `namespace` |
| `spec` | 规格定义 | `containers`, `replicas`, `selector` |

---

## Label 和 Selector <2026-06-17>

**场景**：理解 K8s 松耦合关联的核心机制——Label 粘贴 + Selector 筛选。

**Label**：给资源贴 Key-Value 标签（`app: nginx`, `env: prod`, `version: v1.2.3`）

**Selector**：按标签筛选资源（`color=red` → 筛出 apple 和 strawberry，筛不掉 banana）

**核心价值**：资源之间不靠硬编码的名字或 IP 关联，全凭 Label 匹配。Service 用 `app=nginx` 找到 Pod，Deployment 用 Label 找到 ReplicaSet——被找的不知道谁在找它，只管贴标签。

---

## Namespace <2026-06-17>

**场景**：理解 Namespace 作为逻辑隔离单元的作用。

**三大价值**：
- **环境隔离**：dev / staging / prod 不同 Namespace，各自配置互不干扰
- **资源配额**：dev 只能吃 10 核 20G，prod 配 50 核 100G——防止单环境吃空集群
- **权限隔离**：RBAC 让 dev 团队只能操作 dev Namespace

**核心规则**：同 Namespace 内资源名唯一，不同 Namespace 可重名。

---
