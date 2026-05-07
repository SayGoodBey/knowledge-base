# 自动化

记录 MCP + 本地 Agent、Shell 脚本技巧、AI 驱动的工作流自动化（TAPD/WeTerm3/浏览器）等。

## 知识点

## nohup + disown + python -u：让脚本脱离终端常驻运行 <2026-05-07>

**场景**：通过 VNC/SSH 进入远程容器或服务器跑长任务，关闭终端后希望进程继续运行。

**要点**：

```bash
nohup python -u script.py > /tmp/task.log 2>&1 &
echo $! > /tmp/task.pid
disown
```

四件套原理：

| 机制 | 作用 |
|---|---|
| `nohup` | 忽略 SIGHUP（终端关闭时发的挂断信号） |
| `python -u` | 无缓冲输出，日志实时写入文件 |
| `> /tmp/task.log 2>&1` | stdout + stderr 重定向到文件，不依赖终端 |
| `&` | 后台运行，不占 shell |
| `disown` | 从 shell 作业表移除，shell 退出时不会尝试 kill |

**管理脚本模板**：start/stop/status/logs/restart，配 PID 文件管理。完整示例见 [K8s / GPU 工作负载](/topics/k8s/gpu/) 第 10 节。

**更优方案：tmux**（支持断开后再接回）：

```bash
tmux new -s task        # 创建会话
# 前台跑你的脚本
# Ctrl+B D 脱离
tmux attach -t task     # 下次接回
tmux kill-session -t task  # 终止
```

**容器特别注意**：

- 容器 `/root/` 是临时文件系统，Pod 重建后内容丢失。长期运行的脚本应放 PVC 或打进镜像。
- 容器 PID 1 如果是 shell（而非 `sleep infinity` / `tail -f` / systemd），退出 VNC 可能连带 PID 1 退出 → 整个容器重启。用 `cat /proc/1/comm` 验证。

---
