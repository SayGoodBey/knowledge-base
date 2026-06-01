# AI 工作流

记录 AI Agent 工作流设计、编排、最佳实践等知识。

## 知识点

## cbc -p 模式调用项目级 slash command 的真实行为 2026-06-01

**场景**: 给 v0.3 LangGraph orchestrator 设计 apply / e2e 阶段的 cbc 调用方式，本想让 orchestrator 直接调 `cbc -p "/opsx:apply ..."` 复用 `infrastructure-web/.codebuddy/commands/opsx/` 已沉淀的 14 个 SOP 命令，节省"重写 5 个 skill"的提示词工程成本。三次实验交叉验证后得出真值。

**要点**:

- `cbc --print`（即 -p 非交互模式）**会加载** 项目级 `.codebuddy/commands/<namespace>/*.md` 作为 slash 命令，注册到 init 阶段返回的 `slash_commands` 字段（首次扫描某 cwd 时可能冷缓存假阴性，第二次起稳定列出）
- 但 `cbc -p` **不展开** 这些项目级命令的 prompt 模板。把 `/opsx:explore ...` 当 prompt 喂进去，cbc 把它当成普通用户问题，**不会去读 `commands/opsx/explore.md` 的工作流指令**——这是 IDE 交互模式独有的能力
- **唯一可行的"复用 SOP 命令"路径**：主程序自己读 `commands/xxx.md` 全文，拼到用户 prompt 头部，再喂给 `cbc -p`。等价于"手动展开" slash command 模板

**实验对照**:

| 实验 | 命令形式 | init 含 opsx? | cbc 是否真按 opsx workflow 执行? |
|---|---|---|---|
| 1 | `cbc -p "/opsx:explore ..."` 位置参数 | ❌ 无（冷缓存） | ❌ 当未知 skill |
| 2 | `cat opsx/explore.md \| cbc -p` 喂全文 | (没看) | ✅ 11 turns 严格按 explore mode |
| 3 | 复测实验 1 | ✅ 14 条 opsx | ❌ thinking 不读 explore.md |

实验 2 vs 3 决定方案：cbc -p 注册 slash 命令但不展开模板。

**示例**（程序化复用 commands/opsx/apply.md SOP）:

```python
# 错误做法（cbc 不会展开 slash 命令模板）
result = await codebuddy.run(
    prompt="/opsx:apply add-auth",
    cwd=worktree_path,
)

# 正确做法（主程序自己拼）
with open(f"{infra_web}/.codebuddy/commands/opsx/apply.md") as f:
    command_body = f.read()
prompt = f"{command_body}\n\n---\n\n用户参数：change=add-auth"
result = await codebuddy.run(prompt=prompt, cwd=worktree_path)
```

**适用范围**:

- 任何 LangGraph / 自建 agent 框架想复用 cbc 项目级 commands 时
- 写"按 SOP 跑流水线"的自动化工具时

---
