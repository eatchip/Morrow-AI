# Contributing to Morrow

欢迎贡献。本文档聚焦**人类贡献者的流程**。AI agent 的硬规则见 [`AGENTS.md`](./AGENTS.md)。

---

## 基本约定

1. **先读 `AGENTS.md` 与 `DEVELOPMENT.md`**。其中的规则对人类同样适用。
2. 任何**非平凡**改动（跨模块、结构变更、新依赖）必须走 Spec → Plan 流程（见 `AGENTS.md § 2 Decision Framework`）。
3. **Small 改动**可直接 PR，但 PR 描述中必须说明验证了什么。

---

## Getting started

### Prerequisites

- **Node.js** `>= 22.12.0`
- **pnpm** `>= 9.6.0`
- **OS**：macOS / Windows / Linux 任一

详见 [ADR 0004 技术栈选型](./docs/decisions/0004-tech-stack.md)。

### Setup

```bash
git clone <this repo>
cd Morrow
pnpm install
pnpm dev
```

### Verification

提交 PR 前必须跑通：

| 命令 | 作用 |
|---|---|
| `pnpm pre-commit` | **终极闸门**：lint / format / typecheck / 测试 / E2E |
| `pnpm test -- --run` | 单元 + Contract 测试 |
| `pnpm test:e2e` | Playwright E2E（内部先 build） |

完整命令与使用约束见 [`DEVELOPMENT.md § Setup`](./DEVELOPMENT.md#setup) 与 [`§ Pre-commit 闸门`](./DEVELOPMENT.md#pre-commit-闸门)。

> 脚手架尚未落地（属独立 SDD `tech-stack-scaffold`）。在此之前上述命令作为**规约**存在。

## 开一个新任务

### 路径 A — Small 改动
1. 从最新 `main` 拉新分支：`git checkout -b <type>/<short-desc>`
2. 改代码 → 本地验证 → commit（见 `AGENTS.md § 5 Commit Hygiene`）
3. 开 PR，走 PR 模板 checklist

### 路径 B — Large 改动
1. 在 `.comate/specs/{feature-name}/` 下起 `doc.md`（Spec）
2. 与维护者对齐 Spec
3. 起 `tasks.md`（Plan），再次对齐
4. 按 task 执行 → TDD 循环
5. 完成后写 `summary.md`
6. 涉及方向性决策 → 同步起一条 ADR（`docs/decisions/`）

详细流程见 [`docs/playbooks/new-feature.md`](./docs/playbooks/new-feature.md)。

---

## PR 流程

1. PR 模板必填项全部填写（Size / Type / Linked spec / Verification / Risk）
2. 用户可感知变更 → 更新 [`CHANGELOG.md`](./CHANGELOG.md) `[Unreleased]`
3. 至少 1 位 reviewer 批准
4. CI / Pre-commit 全绿
5. Squash merge 或 rebase merge（以仓库约定为准；当前未约定，先 squash）

## Commit message

见 [`AGENTS.md § 5`](./AGENTS.md#5-commit-hygiene)。

格式：
```
<type>(<scope>): <what> · <why>
```

## 代码评审期望

- 评审对事不对人；关注**正确性 / 可维护性 / 风险**
- 用 `DEVELOPMENT.md § 风险与合规检查清单` 作为评审底线
- 非阻塞意见用 `nit:` 前缀
- 需 reviewer 回复后才能合并的关键问题用 `blocking:` 前缀

## 行为准则

本项目遵循基本的开源社区行为准则：
- 尊重、包容、专业
- 对事不对人
- 不做无助于项目进展的争辩

正式 CoC 文档将在 ADR 决定开源策略后补齐。

---

## 提问与讨论

- **Bug**：走 Issue（`bug_report` 模板）
- **Feature**：走 Issue（`feature_request` 模板）
- **设计讨论**：优先走 Spec doc；无法立刻 Spec 的可先开 Discussion / Issue
