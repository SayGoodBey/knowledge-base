# AI Skill

记录 Skill 开发、SKILL.md 编写规范、技能设计模式等知识。

## 知识点

## 在新机器上部署 CodeBuddy Skill 的标准流程 2026-05-25

**场景**: 换机器/新环境后，需要把 GitHub 上独立维护的 skill 仓库（如 `skill-knowledge-writer`）安装到 CodeBuddy 让其全局生效。

**要点**:

- CodeBuddy 全局 skill 安装位置：`~/.codebuddy/skills/<skill-name>/`，目录名必须等于 `SKILL.md` frontmatter 里的 `name` 字段
- 该目录下其他子目录（`skills-marketplace/`、`plugins/`）是不同来源的技能，**自定义 skill 必须放在 `skills/` 下**才会被识别为 user-location skill
- 推荐"源码仓库 + 安装目录"双份策略：
  - 源码留在 `<workspace>/skill-xxx`（保留 `.git`，便于后续 commit/push 维护）
  - 复制一份到 `~/.codebuddy/skills/xxx`（运行时实际加载的版本）
- 装好后通过 `use_skill` 工具或对话触发词激活，base 路径会回报为 `/root/.codebuddy/skills/<name>`

**示例**（一行命令完成安装）:

```bash
git clone https://github.com/<user>/skill-xxx.git /data/workspace/skill-xxx
mkdir -p ~/.codebuddy/skills
cp -r /data/workspace/skill-xxx ~/.codebuddy/skills/<skill-name>
```

---

## SKILL.md 中的"本地路径"必须用占位符而非硬编码 2026-05-25

**场景**: knowledge-writer skill 的 SKILL.md 第 14 行写死了 `~/.openclaw/workspace/knowledge-base`，迁移到新机器（实际工作区是 `/data/workspace`）后路径不存在，skill 触发时会找错目录。

**要点**:

- skill 描述里所有"本地路径"字段都应使用 `<workspace>/xxx` 占位符，由 skill 在运行时通过 IDE 的工作区根目录变量解析
- 描述里给"具体例子"只能作为参考说明，不能作为唯一真相来源；多机器协作时硬编码路径必然失败
- 修改后两份都要同步：源仓库 `/data/workspace/skill-knowledge-writer/SKILL.md` + 已安装版 `~/.codebuddy/skills/knowledge-writer/SKILL.md`，否则下次拉源仓库覆盖时又会回滚

**反例**:

```markdown
- **本地路径**: `<workspace>/knowledge-base`（即 `~/.openclaw/workspace/knowledge-base`）
                                                ↑ 硬编码，换机器即失效
```

**正例**:

```markdown
- **本地路径**: `<workspace>/knowledge-base`（`<workspace>` 即当前 IDE 工作区根目录，由 skill 在运行时自适应解析）
```

---
