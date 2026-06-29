# Morrow Harness Bootstrap · 任务总结

**Feature**: `project-harness-bootstrap`
**执行日期**: 2026-05-11
**状态**: 全部任务完成

---

## 做了什么

在几乎为空的 `/Users/songhuiyu/Morrow` 仓库里，落地了一套**完整的工程流程规范体系（harness）**，共产出 **26 个文件**（22 个文档/配置 + 2 个 SDD 产物 + 2 个占位 `.gitkeep`）。

### 核心架构
- **双文件 harness**：`AGENTS.md`（硬规则，≤150 行） + `DEVELOPMENT.md`（方法论 source of truth）
- **开放标准优先**：采用 `AGENTS.md` 跨 agent 可移植（Codex / Claude Code / Cursor / Jules / Aider / Zed / Warp / VS Code 等 20+ 工具原生支持）
- **SDD 作为 Large 任务默认流程**：产物走 `.comate/specs/{feature-name}/`

### 文件清单

**根目录规范（9 个）**
- `AGENTS.md` / `DEVELOPMENT.md` / `CLAUDE.md`（兼容壳） / `README.md`（重写）/ `CONTRIBUTING.md` / `CHANGELOG.md`
- `.editorconfig` / `.gitattributes` / `.gitignore`

**决策记录（5 个）**
- `docs/decisions/README.md` / `template.md`
- ADR 0001: 采用 AGENTS.md 开放标准
- ADR 0002: Harness 双文件架构
- ADR 0003: Large 任务默认走 SDD

**Playbook（6 个）**
- `README.md` / `new-feature.md` / `bug-fix.md` / `refactor.md` / `research-method.md` / `spec-review.md`

**GitHub 模板（4 个）**
- `pull_request_template.md` / `bug_report.md` / `feature_request.md` / `config.yml`

**占位（2 个）**
- `docs/architecture/.gitkeep` / `.comate/specs/.gitkeep`

---

## 关键决策与理由

| 决策 | 理由 | 存档 |
|---|---|---|
| 用 `AGENTS.md` 而非 `.cursorrules` / 仅 `CLAUDE.md` | 跨 agent 可移植，避免锁定 | ADR-0001 |
| 双文件而非单文件 / 多文件 | 平衡 context 预算与方法论深度 | ADR-0002 |
| Large 任务沿用 Comate SDD 结构 | 复用已验证能力，与 `AGENTS.md` 决策框架天然同构 | ADR-0003 |
| 不掺入 Morrow 产品判断 | 方向未定，任何业务内容都会成为未来的包袱 | doc.md § 1.3 |
| Setup / 命令留 TBD | 技术栈未选型，待 ADR 产出后回填 | DEVELOPMENT.md § Setup |

---

## 验证

- ✅ 所有 `doc.md § 4` 列明的 22 个目标文件全部落地且非空
- ✅ 关键字扫描确认无业务判断泄漏（东南亚 / 跨境 / 搭子 / IM-native / Shopee / WhatsApp / Manus / Genspark / SOUL.md / USER.md / influencer / consultant 全部零出现；"Codex" 仅以工具兼容清单身份出现；"场景/竞品"仅作通用方法论术语）
- ✅ 导航闭环：`README → AGENTS.md → DEVELOPMENT.md → docs/playbooks/** + docs/decisions/**`
- ✅ `CHANGELOG.md [Unreleased]` 已登记本次 bootstrap

---

## 尝试过但调整的方案

1. **最初把产品判断（IM-native / 海外切点 / SOUL.md）写入 `docs/product/vision.md`** — 用户明确反馈"Morrow 具体怎么做还不清楚，harness 里不该引入更细致介绍"，整段抽离。
2. **最初项目名用 "Morrow Overseas"** — 用户确认项目名就是 `Morrow`，移除海外版前缀。
3. **最初 `AGENTS.md` 结构化得过于 opencove 风格** — 调整为更通用的决策框架与黄金法则，去除 Electron / pnpm 等专属内容。

---

## 已知限制与后续 follow-up

1. **Setup / 命令 TBD**：`DEVELOPMENT.md § Setup` 与 Pre-commit 闸门命令需等技术栈 ADR 产出后回填。
2. **项目结构 TBD**：等首批模块落地后需要在 `DEVELOPMENT.md § 项目结构` 中回填并可能新增 `docs/architecture/overview.md`。
3. **CI 未接入**：按 `AGENTS.md § 6 Out of Scope`，CI 配置需单独立项 ADR + 实施。
4. **行为准则**：`CONTRIBUTING.md` 中 CoC 为占位，待开源策略 ADR 产出后决定是否引入正式 CoC。
5. **Skills 体系**：未来引入 skills 时预计采纳 `SKILL.md` 开放标准（已在 ADR-0001 中预告），届时新增 `skills/` 目录与相应 ADR。
6. **AGENTS.md 层级合并**：子模块可自带 `AGENTS.md`，目前无子模块，暂不展开。

---

## 对未来使用的期望

- 任何新加入的 agent 或人类，读 `README → AGENTS.md → DEVELOPMENT.md` 三文件（总计 ≤ 600 行）即可开始工作
- 任何 Large 任务都沿 `doc.md → tasks.md → execute → summary.md` 流转
- 任何方向性决策都沉淀为 ADR，不靠口头约定
- 任何用户可感知变更都经过 `CHANGELOG.md`，形成跨会话长期记忆
- Harness 本身迭代走 ADR（禁止 agent 擅自修改 `AGENTS.md` / `DEVELOPMENT.md`）

Harness 就位，项目可以正式开始下一阶段（技术栈选型 / 产品方向探索）了。
