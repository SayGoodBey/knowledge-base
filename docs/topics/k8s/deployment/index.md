# Deployment

记录 Deployment 配置、滚动更新、回滚、自愈机制等知识。

## 知识点

## Deployment 核心概念 <2026-06-17>

**场景**：学习 Deployment 管理 Pod 副本数和版本的机制。

**两层结构**：**Deployment → ReplicaSet → Pod**

- Deployment 管版本（镜像 tag）、更新策略
- ReplicaSet 管数量（副本数），维持指定数量 Pod 运行
- 每次版本变更新建一个 ReplicaSet

**两大核心能力**：

**1. 自愈（Self-healing）**：
- 声明 `replicas: 3`，Controller 持续对比期望 vs 实际
- 挂了几个就自动补几个，无需人工干预

**2. 滚动更新 + 回滚**：
- 改镜像版本 → 创建新 ReplicaSet → 逐步替换旧 Pod（中间不断服务）
- 有问题时 `kubectl rollout undo` 一键回滚——旧 ReplicaSet 还在，只是 replicas 缩到 0 了

---
