# AGENTS.md — Morrow

本文件是本仓库所有 AI Coding Agent 的**统一指令**。
遵循 [AGENTS.md 开放标准](https://agents.md/)（Linux Foundation · Agentic AI Foundation 托管），
兼容 Codex / Claude Code / Cursor / Jules / Aider / Zed / Warp / VS Code 等 20+ 工具。

人类贡献者请先读 `CONTRIBUTING.md`，但本文件中的硬规则对所有参与者同样适用。

---

## 0. First Read（开始任何任务前）

按顺序加载以下上下文：
1. **本文件（AGENTS.md）** — 硬规则与决策门
2. **`DEVELOPMENT.md`** — 方法论、架构原则、命令、检查清单
3. **`docs/decisions/`** — 历史决策（仅在任务触达相关领域时）
4. **`docs/playbooks/{任务类型}.md`** — 当前任务类型的 step-by-step

如果子目录存在 `AGENTS.md`，其规则在该子目录下**覆盖**根目录规则（开放标准语义）。

---

## 1. Golden Rules

1. **不改未读的文件**。修改前必须完整读过相关文件。
2. **不过度工程化**。只做被要求的事：不加未请求的 feature、不提前抽象、不做无用兼容垫片、不做无依据的"改进"。
3. **不凭空创造文件**。能编辑就不新建；确需新建必须在 Spec 中说明必要性。
4. **不跨平台硬编码**。路径、换行、命令差异必须显式处理。
5. **边界校验，内部信任**。外部输入（用户、API、文件）必须校验；内部代码相信自身约定。
6. **删就删干净**。移除功能时同时清理无用代码、依赖、文档、注释，不留"已废弃"坟墓。
7. **每个真实 bug 留下可复用资产**：测试、断言、规则、或文档更新。
8. **设计契约优于手感**。UI 实现必须引用 [`docs/design/DESIGN.md`](./docs/design/DESIGN.md) 的 tokens 与原语组件；禁止硬编码色值、字号、间距、圆角、阴影、动效参数。升级为 lint 强制延后到独立 SDD `design-tokens-enforcement`；在此之前由 code review 把关。

---

## 2. Decision Framework — Small vs Large

**每次收到指令，先判定并向用户声明任务规模**。

### Small（小步快反馈）
- 局部、低风险、非结构性
- 直接做，做完说明验证过什么
- 触发以下任一项 → 升级为 Large：
  - 跨模块影响
  - 运行时风险（并发 / 生命周期 / 持久化）
  - 所有权或语义模糊
  - 对外接口/协议/数据契约变动

### Large（深思熟虑）
- 新功能、重构、schema/API 变更、跨模块逻辑、运行时风险
- **必须流程**：`Spec → Approval → (Feasibility Check) → Plan → Approval → Execute`
- `Spec` 必须显式覆盖：
  1. 业界最佳实践参考（成熟问题必须研究，见 `docs/playbooks/research-method.md`）
  2. 业务逻辑与验收标准
  3. 状态所有权、不变量、主要风险
  4. 预期验证方式
- `Feasibility Check` 在以下情况必须做：引入新技术 / 高性能诉求 / 系统级依赖 / 核心重构
- `Plan` 必须拆成**独立可验证**的步骤

### 与 Comate SDD 的配合
Large 任务默认走 SDD 流程，产物位置：
```
.comate/specs/{feature-name}/
├── doc.md       ← Spec
├── tasks.md     ← Plan
└── summary.md   ← 收尾
```

---

## 3. Pre-Coding Checks（Large 任务必做）

编码前必须显式回答：

- **状态所有权**：可变状态的 owner 是谁？允许的状态迁移？什么是派生 UI？
- **不变量**：写下 1–3 条系统不变量，优先于场景枚举。
- **边界**：源头 / 路由 / owner 分别是谁？IPC / 网络 / 文件系统的校验在哪一层？
- **异步 & 生命周期**：是否存在异步 gap、并发竞态、资源未释放？
- **合规**：是否触及隐私数据、第三方 API 条款、许可证？
- **研究前置**：成熟工业问题必须先看外部参考实现，再写方案。

若**所有权 / 权限 / 语义**不清，**停下来对齐**，不要先打补丁。

---

## 4. Workflow

```
Plan → Code → Verify → Handoff
```

1. **Plan**：Triage（Small/Large）→ Spec（Large）→ Approval → Feasibility（如需）→ Plan → Approval
2. **Code**：可测场景走 TDD（Red → Green → Refactor）；不可测场景至少写下验证手段
3. **Verify**：
   - Small：最小可信层级的定向测试
   - Large：全量检查（具体命令见 `DEVELOPMENT.md § Pre-commit 闸门`）
4. **Handoff**：自审 → 更新 PR 说明 → 必要时更新 `CHANGELOG.md` → 给出一行可复制体验命令

### 视觉稿前置闸门（含 UI 变更的 Large 任务必做）

若任务含用户可见界面变更，按 [`docs/design/DESIGN.md § 9 触发表`](./docs/design/DESIGN.md#9-视觉稿前置闸门触发表) 判定档位：

- 🔴 新页面 / 新 Flow / 布局重构 / 新原语组件 → Plan 必须包含"视觉稿产出"任务
- 🟡 新动效 / 新过渡 → Plan 必须包含"交互原型产出"任务
- 🟢 已有组件局部修改 → 截图放 PR 即可
- ⚪ 不可见变更 → 无要求

🔴/🟡 档位：**视觉稿产出并经用户确认前，不得开始实现代码**。具体流程见 [`docs/playbooks/design-review.md`](./docs/playbooks/design-review.md)。

---

## 5. Commit Hygiene

- **粒度**：每个 meaningful unit of work 一次提交；不堆巨型 commit
- **Message 格式**：
  ```
  <type>(<scope>): <what> · <why>

  [body, optional]
  [refs / ADR / spec links, optional]
  ```
  `type`: `feat | fix | refactor | docs | chore | test | perf | build | ci`
- **用户可感知变更** → 同步更新 `CHANGELOG.md` 的 `[Unreleased]` 段落
- **禁止**：手工修改 lock 文件、生成产物、或未被要求的无关改动混入本次提交

### Commit 工具链（本仓库）

- Morrow 是**外部 GitHub 仓库**（`github.com/eatchip/Morrow`），不对接 iCafe / 其他内部工作流
- 提交时**使用原生 `git` 命令**按上文 Message 格式手写；**不得调用 `auto-commit` skill**（它强制绑定公司内部卡片流程，在本仓库不适用且会引入不必要阻塞）
- 提交前必须通过 `pnpm pre-commit`；闸门失败时**禁止 `--no-verify` 绕过**
- 推送目标统一为 `origin main`（当前阶段无 PR flow，未来启用后另行更新本节）
- 当用户明确说“可以合入 / 发布 / 更新 GitHub / 让所有人使用 / 直接 merge 到 main”时，视为完整发布授权。agent 不得停在本地 commit、未发布 tag、draft release 或只给用户下一步；必须自动完成 `README.md` / `CHANGELOG.md` / 版本号（若用户可感知）、`pnpm pre-commit`、`pnpm dist:mac`、合入 `main`、推送 `origin main`、创建或更新 `vX.Y.Z` tag、推送 tag，并验证 GitHub `releases/latest` 指向新版本且 dmg asset 存在。若 GitHub 权限、workflow 失败或账号失效阻塞发布，必须把阻塞点说清楚。
- 每次完成实现或发布，最终回复必须包含**体验命令**：开发体验优先给 `cd <绝对工作区路径> && pnpm dev`；若必须先切分支，给 `cd <路径> && git switch <branch> && pnpm dev`；若已发布给最终用户，补充 GitHub Latest 链接或一行安装命令。不要等用户追问。
- **并发写保护**：同一 workspace 同时只允许**一个**活跃 AI 会话执行 `git add` / `git commit`。
  - **多会话必用 `git worktree`**：若存在并发 AI 会话，每个会话必须在独立 `git worktree add ../Morrow-<slug> -b <type>/<slug>` 目录中工作；`git checkout -b` 仅在单会话 / 串行场景下可用。
  - 物理原因：`.git/HEAD`、工作树、index 都是仓库全局唯一的。`checkout -b` 只是把指针挪名字，多会话共享同一张桌面，`git add -A` 会互相吞噬对方未完工的改动。`worktree` 为每个会话分配独立 HEAD + 工作树 + index（`.git/objects` 共享），才是真正的隔离。
  - 用户提示词若含"新开 worktree"或明确有并发会话，agent 一律用 `git worktree add`，不得在主目录执行 `checkout -b`。收尾时 `git worktree remove ../Morrow-<slug>` 清理。
  - 曾踩坑（2026-05）：4 个 SDD 用 `git switch` 切来切去堆在同一棵工作树，被迫合成一个 commit。

---

## 6. Out of Scope（未经批准不得做）

以下行为 agent 不得自行决定，必须获得用户明确批准：

- 引入新顶层依赖（新语言、新框架、新云服务、新付费 SaaS）
- 修改本文件 `AGENTS.md`、`DEVELOPMENT.md`
- 修改 CI / 发布配置
- 删除或改变 ADR 状态
- 批量自动重构（> 5 文件的非机械性修改）
- 触碰密钥、生产凭证、线上数据
- 在未读原始需求的情况下"优化"他人代码

---

## 7. Setup & Commands

技术栈：Electron + React + TypeScript + electron-vite + pnpm + Vitest + Playwright
（决策见 [ADR 0004](./docs/decisions/0004-tech-stack.md)）。

常用命令：`pnpm install` / `pnpm dev` / `pnpm build` / `pnpm test` / `pnpm test:e2e` / `pnpm pre-commit`。

完整命令表、版本约束、使用注意、闸门细节：见
[`DEVELOPMENT.md § Setup`](./DEVELOPMENT.md#setup) 与 [`§ Pre-commit 闸门`](./DEVELOPMENT.md#pre-commit-闸门)。

脚手架（`package.json / scripts/ / .husky/` 等）已由 SDD `tech-stack-scaffold` 落地，上述命令可直接执行。

### 设计契约

视觉与交互决策遵循 [`docs/design/DESIGN.md`](./docs/design/DESIGN.md) 与 [ADR 0005](./docs/decisions/0005-design-north-stars.md)（Linear 为骨架、Arc 为血肉）。视觉评审流程见 [`docs/playbooks/design-review.md`](./docs/playbooks/design-review.md)。

---

## 8. Escalation

当你遇到以下情况，**停止执行，回到用户对齐**：
- Spec 中出现相互冲突的要求
- 发现需要违反本文件的 Golden Rules 才能完成
- 实际工作量与 Plan 预估显著偏离
- 触达 § 6 Out of Scope 中的任一项

告知用户：现状、冲突点、至少两个可选方案、你的推荐及理由。
