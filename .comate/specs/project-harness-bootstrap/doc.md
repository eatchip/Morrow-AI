# Morrow · Harness Bootstrap 设计文档

> 目标：在当前几乎为空的 `/Users/songhuiyu/Morrow` 仓库里，一次性落地一套**完整的工程流程规范体系**（harness），用于约束、引导、校验未来所有任务的执行。
>
> Harness = 一系列相互配合的规范文件 + 目录结构 + 工作流定义，**不是单个文件**。

---

## 1. 核心认知

### 1.1 Harness 是什么
Harness 是项目的"执行脚手架"——一组在**任何任务开始前就已就位的约束与流程规范**，确保：
- 任何 agent（Claude Code / Codex / Cursor / Comate）进入仓库后能立刻知道怎么工作
- 任何人类贡献者能按统一流程做事
- 任何 PR / commit / spec / 决策都有对应的承载文件与审查口径

### 1.2 Harness 的组成维度
一套完整 harness 至少覆盖以下 6 个维度：

| 维度 | 作用 | 典型承载物 |
|---|---|---|
| **Agent 指令** | 让 AI 工具一进仓库就拿到硬规则 | `AGENTS.md`（开放标准） |
| **开发规范** | 架构原则、编码规范、工作流详细方法 | `DEVELOPMENT.md` |
| **决策记忆** | 重要选型/方案的"为什么" | `docs/decisions/` (ADR) |
| **任务规范** | 单次任务怎么拆、怎么评审、怎么交付 | `docs/playbooks/`、SDD 流程 |
| **变更追踪** | 每次改动留痕，长任务可接续 | `CHANGELOG.md`、git commit 约定 |
| **质量闸门** | 提交前/合并前的硬性检查 | `.editorconfig`、PR 模板、Issue 模板 |

### 1.3 本次 Bootstrap 的范围边界
- ✅ **做**：流程规范、文档骨架、决策记录模板、PR/Issue 模板、编辑器/VCS 配置
- ❌ **不做**：任何与 Morrow **产品方向、业务形态、技术选型**相关的具体内容（方向未定，填进去就是约束后续判断）
- ❌ **不做**：任何业务代码、package.json / tsconfig、CI workflow（等技术选型后单独立项）

---

## 2. 调研结论（作为设计依据）

### 2.1 业界开放标准（2026-05）
- **`AGENTS.md`** 已成为事实标准（60k+ 仓库采用，Linux Foundation Agentic AI Foundation 托管），兼容 Codex / Claude Code / Cursor / Jules / Aider / Zed / Warp / VS Code 等 20+ 工具
- Codex 支持层级合并：`~/.codex/AGENTS.md` → 仓库根 `AGENTS.md` → 子目录 `AGENTS.md`（就近覆盖）
- Claude Code 自 2026 Q1 起原生读取根 `AGENTS.md`，不再强依赖 `CLAUDE.md`
- **`SKILL.md`** 是 skills 的开放标准（跨 Claude / Codex / Gemini / Cursor）
- Anthropic 长任务最佳实践：**`AGENTS.md` 指令 + `CHANGELOG.md` 记忆 + 频繁 git 提交**

### 2.2 本地 opencove 的可复用模式
- **双文件架构**：`AGENTS.md`（精简硬规则）+ `DEVELOPMENT.md`（详细方法论）
- **决策框架**：`Small vs Large`——Large 必须 `Spec → Approval → (Feasibility) → Plan → Approval`
- **前置检查**：所有权 / 不变量 / 异步生命周期 / 边界
- **TDD 工作流**：Red → Green → Refactor
- **风险清单**：状态/并发/IPC/资源生命周期/性能/数据完整性
- **研究法**：Research → Synthesize → Adapt → Verify
- **任务账本**：`task.md` 记录活跃任务
- **docs/ 分层**：architecture / agent / runtime / cli 等

### 2.3 本次不沿用 opencove 的部分
- 不抄它的 `cove` 命名前缀（属于 opencove 专属）
- 不抄它的 Electron main/preload/renderer 细节（Morrow 技术栈未定）
- 不抄它的 Playwright/pnpm 具体命令（同上）

---

## 3. 架构设计

### 3.1 信息分层原则
```
  读取频次/紧迫度
     ▲
     │  AGENTS.md           每次任务必读，硬规则，≤150 行
     │  DEVELOPMENT.md      需要时查，详细方法，可长
     │  README.md           人类首次入口
     │  CONTRIBUTING.md     贡献流程
     │  docs/playbooks/*    具体任务类型的 step-by-step
     │  docs/decisions/*    历史决策档案（ADR）
     │  CHANGELOG.md        变更历史
     ▼
```

### 3.2 双文件权威分工
- `AGENTS.md` = **"必须遵守什么"**：红线、决策门、non-negotiables；不写"怎么做"
- `DEVELOPMENT.md` = **"具体怎么做"**：架构原则、工作流、命令、示例、检查清单

任何"具体做法"都不应出现在 `AGENTS.md`，而应在 `DEVELOPMENT.md` 或 `docs/playbooks/` 里，`AGENTS.md` 用引用指向它们。

### 3.3 工作流协议（project-agnostic）
规范层面定义：
1. **任务三态**：Triage（Small/Large 判定）→ Execute → Verify
2. **Large 任务五步**：Spec → Approval → (Feasibility) → Plan → Approval → Execute
3. **Comate SDD 兼容**：涉及 Comate agent 的任务，产物走 `.comate/specs/{feature-name}/{doc,tasks,summary}.md`
4. **Commit 约定**：`<type>(<scope>): <what> · <why>`，每个 meaningful unit 提交一次
5. **变更留痕**：用户可感知变更必须更新 `CHANGELOG.md [Unreleased]`

### 3.4 跨 Agent 可移植策略
- **一级权威**：`AGENTS.md`（开放标准）
- **二级兼容壳**：`CLAUDE.md` 仅一行 "See AGENTS.md"（避免双份维护）
- **不引入**：`.cursorrules`（Cursor-only，锁定单一工具）
- **子目录支持**：未来子模块可自带 `AGENTS.md`，层级合并语义由开放标准保证

---

## 4. 受影响文件清单

所有操作均为**新建**；`README.md` 为**重写**。

### 4.1 根目录（根级规范）
| 路径 | 操作 | 作用 |
|---|---|---|
| `/Users/songhuiyu/Morrow/AGENTS.md` | 新建 | Agent 一级指令（开放标准入口） |
| `/Users/songhuiyu/Morrow/CLAUDE.md` | 新建 | 兼容壳，指向 AGENTS.md |
| `/Users/songhuiyu/Morrow/DEVELOPMENT.md` | 新建 | 开发方法论 source of truth |
| `/Users/songhuiyu/Morrow/CONTRIBUTING.md` | 新建 | 人类贡献流程 |
| `/Users/songhuiyu/Morrow/CHANGELOG.md` | 新建 | 变更记录 + agent 长期记忆 |
| `/Users/songhuiyu/Morrow/README.md` | 重写 | 项目入口（仅导航，不写业务） |
| `/Users/songhuiyu/Morrow/.editorconfig` | 新建 | 编辑器一致性 |
| `/Users/songhuiyu/Morrow/.gitattributes` | 新建 | 行尾/二进制处理 |
| `/Users/songhuiyu/Morrow/.gitignore` | 新建 | 基础忽略规则（OS / IDE / logs / env） |

### 4.2 决策与方法论
| 路径 | 操作 | 作用 |
|---|---|---|
| `/Users/songhuiyu/Morrow/docs/decisions/README.md` | 新建 | ADR 索引与使用说明 |
| `/Users/songhuiyu/Morrow/docs/decisions/template.md` | 新建 | ADR 模板 |
| `/Users/songhuiyu/Morrow/docs/decisions/0001-adopt-agents-md.md` | 新建 | 首条 ADR：采用 AGENTS.md 标准 |
| `/Users/songhuiyu/Morrow/docs/decisions/0002-harness-dual-file.md` | 新建 | ADR：双文件 harness 架构 |
| `/Users/songhuiyu/Morrow/docs/decisions/0003-sdd-workflow.md` | 新建 | ADR：SDD 为 Large 任务默认流程 |

### 4.3 Playbooks（可重复任务的模板）
| 路径 | 操作 | 作用 |
|---|---|---|
| `/Users/songhuiyu/Morrow/docs/playbooks/README.md` | 新建 | Playbook 索引 |
| `/Users/songhuiyu/Morrow/docs/playbooks/new-feature.md` | 新建 | 新功能开发 playbook |
| `/Users/songhuiyu/Morrow/docs/playbooks/bug-fix.md` | 新建 | Bug 修复 playbook |
| `/Users/songhuiyu/Morrow/docs/playbooks/refactor.md` | 新建 | 重构 playbook |
| `/Users/songhuiyu/Morrow/docs/playbooks/research-method.md` | 新建 | Research → Synthesize → Adapt → Verify 方法 |
| `/Users/songhuiyu/Morrow/docs/playbooks/spec-review.md` | 新建 | Spec 评审清单 |

### 4.4 GitHub 协作模板
| 路径 | 操作 | 作用 |
|---|---|---|
| `/Users/songhuiyu/Morrow/.github/pull_request_template.md` | 新建 | PR 模板（含 checklist） |
| `/Users/songhuiyu/Morrow/.github/ISSUE_TEMPLATE/bug_report.md` | 新建 | Bug issue 模板 |
| `/Users/songhuiyu/Morrow/.github/ISSUE_TEMPLATE/feature_request.md` | 新建 | Feature issue 模板 |
| `/Users/songhuiyu/Morrow/.github/ISSUE_TEMPLATE/config.yml` | 新建 | Issue 模板入口配置 |

### 4.5 占位目录（保持结构可见）
| 路径 | 操作 | 作用 |
|---|---|---|
| `/Users/songhuiyu/Morrow/docs/architecture/.gitkeep` | 新建 | 架构文档占位（等技术选型后填） |
| `/Users/songhuiyu/Morrow/.comate/specs/.gitkeep` | 新建 | SDD 产物目录（本次 bootstrap 本身会先产出 doc/tasks） |

**共计约 22 个文件**，全部为流程/规范/文档，零业务内容。

---

## 5. 关键文件骨架（不含业务判断）

### 5.1 `AGENTS.md`（≤150 行，只写流程/硬规则）
```
# AGENTS.md — Morrow
0. First Read: AGENTS.md → DEVELOPMENT.md
1. Golden Rules（project-agnostic 通用铁律）
2. Decision Framework: Small vs Large
3. Pre-Coding Checks（Large 任务必做）
4. Workflow: Plan → Code → Verify → Handoff
5. Commit Hygiene
6. Out of Scope（未经批准不能做的事）
7. Setup & Commands → 指向 DEVELOPMENT.md
```
**不写**：任何产品定位、场景、对标、技术栈判断。

### 5.2 `DEVELOPMENT.md`（方法论为主）
```
# DEVELOPMENT.md
## 开发导航（Index）
## Setup（TBD 占位，等技术选型）
## 项目结构（TBD 占位）
## 核心编码原则
## 架构执行触发器
## 高风险问题预防策略
## Research → Synthesize → Adapt → Verify
## 风险与合规检查清单（通用）
## Pre-commit 闸门（命令 TBD）
## Observability / Logging 原则
## 安全（密钥、边界、输入校验）通用规则
```
**不写**：具体技术栈相关的命令（等选型 ADR 产出后补）。

### 5.3 `README.md`（纯导航）
```
# Morrow
（一句话占位，不描述产品形态）

## Working in this repo
- AI agents: read AGENTS.md first.
- Humans: read CONTRIBUTING.md.

## Key files
- AGENTS.md
- DEVELOPMENT.md
- CHANGELOG.md
- docs/decisions/
- docs/playbooks/
```

### 5.4 ADR 模板
```
# ADR NNNN: {Title}
Status: Proposed | Accepted | Deprecated | Superseded by ADR-MMMM
Date: YYYY-MM-DD
## Context
## Decision
## Consequences
  ### Positive
  ### Negative / Trade-offs
## Alternatives considered
```

### 5.5 PR 模板
```
## Summary
## Type: feat / fix / refactor / docs / chore
## Change Size: Small / Large
## Linked Spec / ADR / Issue
## Verification
  - [ ] Targeted tests
  - [ ] Full suite (if Large)
  - [ ] CHANGELOG updated (if user-visible)
## Risk Checklist
  - [ ] Async / concurrency reviewed
  - [ ] Input boundaries validated
  - [ ] Security implications considered
## Screenshots (if UI)
```

---

## 6. 边界条件与异常处理

| 情况 | 处理 |
|---|---|
| Agent 未读 AGENTS.md 就动手 | AGENTS.md § 0 "First Read" 硬性声明 + PR 模板 checklist 中要求"已阅读 AGENTS.md" |
| 子目录需要差异化规则 | 开放标准原生支持子目录 `AGENTS.md` 层级合并，未来直接用 |
| 与 Comate SDD 工作流是否冲突 | 不冲突：AGENTS.md 明确"Comate 任务产物走 .comate/specs/"，两套机制共存 |
| 技术栈未定导致 Setup 写不出来 | Setup / 命令部分留明确 `TBD（等 ADR 00XX 产出后填）` 标记，不硬编造 |
| 未来要把 harness 同步到开源版本 | 当前所有文件都 project-agnostic，不含内部敏感信息，天然可开源 |
| AGENTS.md 与 CLAUDE.md 双维护负担 | CLAUDE.md 只写 "See AGENTS.md" 一行，避免双份维护 |

---

## 7. 数据流 / 使用流

```
新任务到达
    │
    ▼
[Triage] Agent/人类读 AGENTS.md
    │
    ├── Small ───→ 按 DEVELOPMENT.md 执行 → 提交 PR（走 PR 模板）
    │
    └── Large ───→ 进入 SDD 流程
                      │
                      ▼
                 .comate/specs/{feature}/doc.md    ← Spec
                      ↓ (Approval)
                 .comate/specs/{feature}/tasks.md  ← Plan
                      ↓ (Approval)
                 执行 → 代码 → CHANGELOG.md → commit
                      ↓
                 .comate/specs/{feature}/summary.md
                      ↓
                 涉及架构/选型决策 → docs/decisions/{NNNN}.md
```

---

## 8. 预期产出

Bootstrap 完成后：
- ✅ 任何 agent 或人类新人，读 `README → AGENTS.md → DEVELOPMENT.md` 三个文件（总计 ≤ 600 行）就能知道怎么在本仓库工作
- ✅ 每一类任务（feature / bug / refactor / research）都有对应 playbook 可查
- ✅ 每一次重要决策都有 ADR 归档模板可用
- ✅ 仓库完全 project-agnostic，Morrow 方向后续怎么变都不需要重构 harness
- ✅ 遵循 2026 开放标准，跨 agent 可移植，未来切换或新增工具无成本

---

## 9. 非目标（本次明确不做）

- ❌ 不写 Morrow 产品定位、目标用户、场景分析、竞品研究
- ❌ 不引入 package.json / tsconfig / 构建工具
- ❌ 不配置 CI / GitHub Actions workflow
- ❌ 不创建业务目录（`src/` / `skills/` / `app/`）
- ❌ 不预设技术栈相关的命令或闸门具体实现
- ❌ 不写任何代码
