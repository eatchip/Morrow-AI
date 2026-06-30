# ADR 0002: Harness 采用 AGENTS.md + DEVELOPMENT.md 双文件架构

- **Status**: Accepted
- **Date**: 2026-06-30
- **Deciders**: Morrow 初始团队
- **Tags**: harness, documentation

---

## Context

Harness 文件要同时服务两类读者（AI agent + 人类），且两种使用模式差异很大：

- **Agent**：每次任务开始必读，上下文预算有限，需要**高密度硬规则**
- **人类 / Reviewer**：按需查阅，需要**详细方法论、示例、命令**

把所有内容塞进一个文件的结果：
- 文件过长 → agent 每次消耗大量 context
- 硬规则与解释混杂 → agent 抓不住重点
- 人类找细节要翻很长的规则墙

业界参考（本地 opencove 项目已验证）：用**精简指令文件 + 详细方法论文件**双层承载。

---

## Decision

**采用双文件架构**：

| 文件 | 定位 | 规模 | 读者优先级 |
|---|---|---|---|
| `AGENTS.md` | "必须遵守什么"：硬规则、决策门、红线 | ≤ 150 行 | Agent 首要 / 人类次要 |
| `DEVELOPMENT.md` | "具体怎么做"：方法论、架构、命令、清单 | 按需 | 人类首要 / Agent 按需 |

**分工铁律**：
- `AGENTS.md` 不写"怎么做"，只写"什么不能做 / 决策门 / 流程声明"
- `DEVELOPMENT.md` 不写新的硬规则，只详述 `AGENTS.md` 声明的规则怎么落地
- 任何引用 / 跳转通过显式链接实现

附加层级：
- 决策档案 → `docs/decisions/`（ADR）
- 任务 step-by-step → `docs/playbooks/`
- 变更历史 / 长期记忆 → `CHANGELOG.md`
- 人类贡献流程 → `CONTRIBUTING.md`

---

## Consequences

### Positive
- Agent 每次调用只需加载 `AGENTS.md`（小），需要细节时再加载 `DEVELOPMENT.md`（可选）
- 硬规则与"参考方法"不混淆，降低 agent 误判空间
- 人类可从 `README.md` 出发自然分流到对应文档
- 与 opencove 已验证模式对齐，有实践基础

### Negative / Trade-offs
- 需要维护两文件同步（通过明确分工边界缓解）
- 对新贡献者有上手成本（通过 README 导航缓解）

### Neutral
- `DEVELOPMENT.md` 可能长期膨胀，需要定期拆分为 playbooks 或 ADR

---

## Alternatives Considered

| 方案 | 评估 | 未采纳原因 |
|---|---|---|
| 单一 `AGENTS.md` 承载所有内容 | 简单 | 要么太长（context 爆炸），要么缺细节 |
| 三文件：rules / methods / examples | 分得更细 | 边界难界定，维护成本更高，收益边际递减 |
| 按主题拆分（security.md / testing.md 等） | 模块化好 | 入口分散，agent/人类都难以知道该读哪几篇 |

---

## References

- 本地 opencove 项目（参考来源）
- 本仓库 `AGENTS.md`、`DEVELOPMENT.md`
- ADR-0001（AGENTS.md 开放标准）
