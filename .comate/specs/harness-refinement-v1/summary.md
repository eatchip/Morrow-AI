# Harness Refinement v1 — Summary

- **Status**: ✅ Completed
- **Date**: 2026-05-12
- **Spec**: `.comate/specs/harness-refinement-v1/doc.md`
- **Plan**: `.comate/specs/harness-refinement-v1/tasks.md`

---

## 背景

在技术栈已确认完全沿用 OpenCove 的前提下（`Electron + React + TypeScript + electron-vite + pnpm + Vitest + Playwright + electron-builder + oxlint + prettier + husky + lint-staged`），
把 OpenCove 已验证的工程约束**裁剪迁移**到 Morrow 的 harness，让 `AGENTS.md + DEVELOPMENT.md + docs/` 从"原则占位"升级到"可执行规约"。

---

## 交付物清单

### 新增文件（3）

| 文件 | 职责 |
|---|---|
| `docs/decisions/0004-tech-stack.md` | 技术栈正式选型 ADR，含 Context / Decision / Consequences / Alternatives / Follow-ups |
| `docs/architecture/ARCHITECTURE.md` | DDD + Clean + Electron 三进程 + host process 故障隔离的架构规则（project-agnostic） |
| `docs/development/DEBUGGING.md` | 失败首轮动作 / 测试层级选择 / E2E 稳定运行 / 状态污染排查 / 视觉调试原则 |

### 修改文件（5）

| 文件 | 变更 |
|---|---|
| `DEVELOPMENT.md` | § Setup / § 项目结构 / § Pre-commit 闸门 从 TBD 补齐；新增 § 测试分层与 E2E 策略、§ Electron 安全与 IPC 契约 |
| `AGENTS.md` | § 7 Setup & Commands 从 TBD 升级为具体命令 + ADR 链接 |
| `CONTRIBUTING.md` | § Getting started 补齐 Prerequisites / Setup / Verification |
| `CHANGELOG.md` | `[Unreleased]` 追加本轮交付 |
| `docs/decisions/README.md` | 索引表追加 ADR 0004 |

### 任务完成度

13 / 13 顶层任务已打勾，子任务全部完成。

---

## 不变量自检（四条）

1. **Doc ↔ ADR 一致** — ✅
   - `DEVELOPMENT.md § Setup` 中声明的 Node 版本、pnpm 版本、技术栈名称，与 ADR 0004 Decision 段 1-1 对应。
   - `§ Pre-commit 闸门` 的 8 步命令链中每一步在 ADR 0004 都有对应工具（oxlint / prettier / tsc / vitest / playwright / husky / lint-staged / secretlint）。

2. **AGENTS.md 业务中立** — ✅
   - § 7 仅写了技术栈名与命令入口；全文无 "Morrow 做什么产品 / 面向什么用户 / 竞品 X" 等业务判断。

3. **ARCHITECTURE project-agnostic** — ✅
   - 逐条去除了 OpenCove 的业务术语（Workspace / Space / Endpoint / Mount / Session / PTY / OpenCode / Codex / Terminal / React Flow）。
   - `window.opencoveApi` → `window.morrowApi`（标注待 ADR 0005）；`.opencove/` 相关引用已删除。
   - 不引入任何 Morrow 业务假设。

4. **零脚手架污染** — ✅
   - 本轮仅产出 `.md` 文件；未生成 `package.json / tsconfig / electron.vite.config / 任何 .ts / .js / .mjs`。
   - 所有 `pnpm *` 命令在文档中明确标注为"规约先行，脚手架随后"。

---

## 验证手段回顾

| 手段 | 结论 |
|---|---|
| 静态检查（链接可达、TOC 对齐） | 已手工核对，无悬挂链接 |
| 不变量自检（上节四条） | 全通过 |
| Spec 反向校验（新 agent 能否独立回答"怎么装依赖 / 怎么跑测试 / 代码放哪"） | 能——`DEVELOPMENT.md` 有 Commands 表 + `ARCHITECTURE.md` 有 Clean 四层规则 |
| 冷启动测试（agent 读完能否继续作业） | 能——"添加新功能"可定位到 `docs/playbooks/new-feature.md` + Clean 四层 |

---

## Follow-up SDDs（按优先级）

1. **`tech-stack-scaffold`**（下一步）
   生成 `package.json / tsconfig.*.json / electron.vite.config.ts / scripts/*.mjs / .husky/` 等真实脚手架文件，把本 SDD 定义的命令规约落成可执行工程。

2. **ADR 0005 — 命名前缀决策**
   解决 `window.morrowApi` / `.morrow/` / `morrow:*` 等占位名的正式命名。

3. **`hello-world-app`**
   第一个最小可运行产物（空窗口 + renderer 打印 hello world），验证脚手架闭环。

4. **ADR 0006 — 发布流程** / **ADR 0007 — i18n 策略**（按需）

---

## 给下一位 Agent / 工程师的话

- 读完 `AGENTS.md → DEVELOPMENT.md → docs/decisions/0004-tech-stack.md → docs/architecture/ARCHITECTURE.md → docs/development/DEBUGGING.md` 这条路径，整个工程底座就清楚了。
- 本轮**没有**真实运行过任何 `pnpm *` 命令——因为脚手架还没生成。不要被文档里的命令骗到，下一个 SDD 会把它们变成可执行的。
- 若发现任何"规约 vs 脚手架不一致"，以 `DEVELOPMENT.md` + ADR 为准，脚手架服从规约，而不是反过来。
