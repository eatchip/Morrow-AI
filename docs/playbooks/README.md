# Playbooks

Playbook = **常见任务类型的 step-by-step 指引**，同时面向 AI agent 与人类贡献者。

## 何时用哪本

| 你要做什么 | 用哪本 |
|---|---|
| 加一个新 feature / 模块 | [`new-feature.md`](./new-feature.md) |
| 修一个 bug | [`bug-fix.md`](./bug-fix.md) |
| 做结构性重构 | [`refactor.md`](./refactor.md) |
| 在进入 Spec 之前做调研 | [`research-method.md`](./research-method.md) |
| 评审一份 Spec（自审或他审） | [`spec-review.md`](./spec-review.md) |

## Playbook 与其他文档的关系

- **硬规则** 在 `AGENTS.md`
- **方法论与原则** 在 `DEVELOPMENT.md`
- **历史决策** 在 `docs/decisions/`
- **当下的这个任务该怎么一步步走** → 在本目录

Playbook 可以被更新。发现更优路径时，起 PR 修订对应 playbook，并在 `CHANGELOG.md` 登记。

## 新增 Playbook 的标准

- 有**可重复**的任务模式（至少第 3 次做同类事 → 值得 playbook）
- 比起原则说教，能给出**具体步骤 / 清单 / 模板**
- 文件名用 kebab-case，与任务类型直接对应
