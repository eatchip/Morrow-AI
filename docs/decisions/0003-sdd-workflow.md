# ADR 0003: Large 任务默认采用 Comate SDD 工作流

- **Status**: Accepted
- **Date**: 2026-06-30
- **Deciders**: Morrow 初始团队
- **Tags**: workflow, sdd, agent

---

## Context

Morrow 日常开发会用到 Comate（百度 AI 编程智能体），Comate 内置 Spec-Driven Development（SDD）工作流：

```
doc.md (Spec) → tasks.md (Plan) → 执行 → summary.md
```

产物存放在 `.comate/specs/{feature-name}/`。

`AGENTS.md § 2 Decision Framework` 要求 Large 任务必走 `Spec → Approval → Plan → Approval → Execute`。这与 SDD 流程天然同构。

问题：是采纳 SDD 作为 Large 任务的默认承载，还是自建一套？

---

## Decision

**Large 任务默认采用 Comate SDD 流程**，产物存放在 `.comate/specs/{feature-name}/`：

- `doc.md` = `AGENTS.md` 中要求的 Spec
- `tasks.md` = `AGENTS.md` 中要求的 Plan
- `summary.md` = 任务完成后的小结与学习沉淀

对于**不使用 Comate** 的贡献者（用其他 agent 或纯手工），同样鼓励使用此目录结构，保证产物一致性。

与 ADR 的配合：若 Spec 过程中触达"方向性选型"，必须同时起 ADR；ADR 和 SDD spec 互相引用。

---

## Consequences

### Positive
- 零重建成本：直接复用 Comate 能力与产物结构
- 产物可检索、可审计，形成"任务档案"
- 与 `AGENTS.md` Decision Framework 无缝对接
- 跨人协作有统一语言

### Negative / Trade-offs
- 不用 Comate 的工具也得遵守目录结构（但这是价值而非代价）
- `.comate/` 路径看起来像工具锁定；通过 ADR 明确声明这只是**目录名复用**，与具体工具解耦

### Neutral
- 未来若切换主力 agent，`.comate/specs/` 可保留或重命名，内容不丢

---

## Alternatives Considered

| 方案 | 评估 | 未采纳原因 |
|---|---|---|
| 自建 `docs/specs/` 规范 | 工具无关 | 与已验证能力重复造轮子 |
| 纯 issue / PR 驱动（不落地文档） | 轻量 | Large 任务缺乏 Spec 沉淀，agent 上下文不完整 |
| Feature branch 里 freeform 写方案 | 低约束 | 无统一结构，难复用、难检索 |

---

## References

- Comate SDD 工作流（内置于 Comate agent）
- `AGENTS.md § 2 Decision Framework`
- `AGENTS.md § 4 Workflow`
- `CONTRIBUTING.md` 路径 B（Large 改动）
