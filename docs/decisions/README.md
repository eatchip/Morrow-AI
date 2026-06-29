# Architecture Decision Records (ADR)

本目录承载 Morrow 项目的**架构决策记录**。每一条记录固化一次重要选型/方向的"为什么"，避免决策理由随时间消散。

---

## 什么情况下写 ADR

**必须写 ADR**：
- 引入新的顶层技术（语言、框架、运行时、数据库、云服务）
- 改变模块边界或所有权
- 影响所有子模块的横切规则（安全、日志、i18n、错误处理）
- 从 A 方案迁到 B 方案（无论大小）
- 推翻或取代之前的 ADR

**不需要 ADR**：
- 局部实现细节
- 可逆的小规模尝试
- 已经在 `DEVELOPMENT.md` / `AGENTS.md` 里规定的普遍规则

---

## 编号规则

- 四位数字，从 `0001` 开始，递增，永不回收
- 文件名：`{NNNN}-{kebab-case-title}.md`
- 即使 ADR 被废弃或取代，文件保留，状态改为 `Deprecated` 或 `Superseded by ADR-MMMM`

---

## 状态流转

```
Proposed ──→ Accepted ──→ Deprecated
                   │
                   └──→ Superseded by ADR-MMMM
```

- **Proposed**：讨论中，未落地
- **Accepted**：已采纳，当前有效
- **Deprecated**：仍保留但不推荐新用
- **Superseded**：被另一条 ADR 替代（必须指明替代方）

---

## 写作规范

- 使用 [`template.md`](./template.md) 作为起点
- 关键在于 **Context（当时为什么要做选择）** 和 **Alternatives（考虑过哪些别的）**
- 避免事后美化：如实记录当时的信息与约束

---

## 索引

| 编号 | 标题 | 状态 |
|---|---|---|
| [0001](./0001-adopt-agents-md.md) | 采用 AGENTS.md 作为 Agent 指令开放标准 | Accepted |
| [0002](./0002-harness-dual-file.md) | Harness 采用 AGENTS.md + DEVELOPMENT.md 双文件架构 | Accepted |
| [0003](./0003-sdd-workflow.md) | Large 任务默认采用 Comate SDD 工作流 | Accepted |
| [0004](./0004-tech-stack.md) | 技术栈选型（Electron + React + TS + Vite + pnpm + Vitest + Playwright） | Accepted |
