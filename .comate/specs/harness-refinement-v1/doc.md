# Harness Refinement v1 — Spec

> 在技术栈已对齐 OpenCove 的前提下，把 OpenCove 已验证的工程约束裁剪迁移到 Morrow 的 harness，
> 让 `AGENTS.md + DEVELOPMENT.md + docs/` 从"原则占位"升级到"可执行规约"。

---

## 1. 背景与触发

上一个 SDD（`project-harness-bootstrap`）完成了 harness 的骨架（26 个文件），但留下 3 类 TBD：

| TBD 区域 | 当前状态 | 阻塞 |
|---|---|---|
| `DEVELOPMENT.md § Setup` | 空命令 | 开发者无从 `pnpm install` |
| `DEVELOPMENT.md § 项目结构` | 仅原则 | agent 不知道代码往哪放 |
| `DEVELOPMENT.md § Pre-commit 闸门` | 顺序未绑定命令 | CI/本地都跑不起来 |

用户已明确：**技术栈完全沿用 opencove**（Electron + React + TS + electron-vite + pnpm + Vitest + Playwright + electron-builder + oxlint + prettier + husky + lint-staged）。

因此本 SDD 的目标是：**把这批 TBD 一次性补齐，同时把 opencove 已验证的 2 项成熟资产（DDD+Clean 架构规则、DEBUGGING 规约）搬过来**。

---

## 2. 范围（In / Out Scope）

### In Scope
1. **新增 ADR 0004** — 技术栈正式选型决策（含版本锁定策略）
2. **回填 `DEVELOPMENT.md § Setup`** — 具体命令
3. **回填 `DEVELOPMENT.md § 项目结构`** — DDD + Clean 架构规则（不列具体业务模块）
4. **回填 `DEVELOPMENT.md § Pre-commit 闸门`** — 具体命令链
5. **新增 `DEVELOPMENT.md` 章节**：
   - `§ 测试分层与 E2E 策略`（对齐 opencove Unit/Contract/Integration/E2E 四层）
   - `§ Electron 安全与 IPC 契约`（把 `§ 安全通用规则 > 进程与沙箱` 扩展为可执行规约）
6. **新增 `docs/architecture/ARCHITECTURE.md`** — DDD + Clean + 进程边界规则（裁剪自 opencove，去业务语义）
7. **新增 `docs/development/DEBUGGING.md`** — 骨架 + 首轮调试动作 + 测试层级选择原则（不抄 opencove 的 terminal/xterm 案例；案例库等 Morrow 真实踩坑后再补）
8. **更新 `AGENTS.md § 7 Setup & Commands`** — 从 TBD 改为直接指向 `DEVELOPMENT.md § Setup`
9. **更新 `CONTRIBUTING.md § Prerequisites / Setup / Verification`** — 从占位升级为具体命令
10. **更新 `CHANGELOG.md`** — `[Unreleased]` 追加一条
11. **更新 `docs/decisions/README.md`** — 把 ADR 0004 加进索引

### Out of Scope（明确不在本轮做）
- ❌ **具体业务代码 / 模块目录**（等首个 demo SDD）
- ❌ **i18n locales 文件**（等真有 UI）
- ❌ **命名前缀 ADR**（opencove 是 `cove/OpenCove`；Morrow 的命名等首批代码落地再定）
- ❌ **发布 / 签名 / 更新流程**（等需要发版时再做）
- ❌ **CI workflow 配置**（github actions / 签名证书等）
- ❌ **scripts/\*.mjs 实际脚本实现**（本轮只定义命令契约，脚本实现是独立 SDD）
- ❌ **安装依赖 / `pnpm install`**（本 SDD 纯文档；真装依赖是下一个 SDD 的事）

**Scope Discipline**：本 SDD 只改文档，**不产生 `package.json` / `tsconfig.json` / 任何源码文件**。技术栈落地是下一个 SDD (`tech-stack-scaffold`) 的工作。这样可以让「规约定义」和「工程落地」两轮独立验证，避免一次大爆炸。

---

## 3. 业界最佳实践参考

| 来源 | 关键启示 | 如何迁移 |
|---|---|---|
| **OpenCove `DEVELOPMENT.md`** | 四类状态分类（User Intent / Durable Fact / Runtime Observation / UI Projection）、Pre-commit 闸门顺序、测试层级映射 | 直接沿用方法论；命令链结构搬过来，脚本名前缀保持 `morrow-` / 或与 opencove 同名以利搬运 |
| **OpenCove `ARCHITECTURE.md`** | DDD context 组织 + Clean 四层（domain/application/infrastructure/presentation）+ 进程边界规则 + host process 故障隔离 | 全量迁移架构骨架；删除 `WorkspaceCapability / Space / Endpoint / Mount / Session` 等业务 context 举例 |
| **OpenCove `DEBUGGING.md`** | 「先确认是不是旧构建」「先看 trace 和持久化状态」「测试层级选择」「失败后的首轮动作」 | 迁移方法论章节；删除 xterm / React Flow / PTY / Playwright-specific 案例，只留骨架与通用原则 |
| **OpenCove `CONTRIBUTING.md`** | Prerequisites（Node >= 22.12.0, pnpm 9.6.0）、Verification 三件套表格 | 直接沿用版本约束；golden rules 4 条不抄（已在 Morrow AGENTS.md），只留 PR 流程 |
| **OpenCove `package.json` scripts** | `pnpm pre-commit` 组合顺序、lint-staged 配置、staged 校验脚本命名 | 沿用命令名约定（`line-check:staged` / `naming-check:staged` / `format-check:staged` / `test:staged` / `test:e2e:pre-commit`）；脚本实现留给下一轮 |

**不照抄的部分**：
- OpenCove 的 `oxlint` 选择（vs ESLint）—— Morrow 可以考虑 Biome 或仍选 oxlint，留给 ADR 0004 定
- OpenCove 的 `better-sqlite3 / node-pty / @xyflow/react / xterm` 等业务运行时依赖
- OpenCove 的 `Worker / Web UI / CLI` 多产物复合构建
- OpenCove 的命名前缀策略（`cove:` / `OpenCove` / `.opencove/`）

---

## 4. State Ownership（本次仅涉及文档资产）

| 资产 | Owner | 变更路径 |
|---|---|---|
| `AGENTS.md` 硬规则 | 人类决策者 + ADR | 修改 `§ 7 Setup & Commands` 一节（本 SDD），其余章节不动 |
| `DEVELOPMENT.md` 方法论 | 本文件 + ADR | 本 SDD 补 TBD 与新增章节 |
| `docs/decisions/` ADR | 提案者（一人）+ 批准者（另一人） | 新增 0004，不改历史 0001/0002/0003 |
| `docs/architecture/*` | 架构 owner | 本 SDD 新增 `ARCHITECTURE.md` |
| `docs/development/DEBUGGING.md` | 调试知识库 owner | 本 SDD 新建骨架 |

**不变量**：
1. **AGENTS.md 不得写业务判断**（只含硬规则与流程门），本 SDD 继续遵守。
2. **DEVELOPMENT.md 的命令必须与 ADR 0004 技术栈一致**，否则任一方错了就要同步修。
3. **docs/architecture/ARCHITECTURE.md 必须是 project-agnostic**（不暗示 Morrow 做什么），只定"代码该怎么放"。

---

## 5. 详细设计（Per-File Delta）

### 5.1 新增 `docs/decisions/0004-tech-stack.md`

状态：`Proposed` → 用户确认本 SDD 后改 `Accepted`

内容要点：
- **Context**：Morrow 海外版需要跨平台桌面基座；团队无经验，借鉴 OpenCove 已验证栈可降低决策成本。
- **Decision**：
  - Runtime：**Electron 35+**（非 Tauri：生态成熟度 + 我司团队 Node 熟悉度）
  - Build：**electron-vite 5+**（主/预加载/渲染一体化）
  - UI：**React 19 + TypeScript 5.7+**
  - Package Manager：**pnpm 9.6+**（lockfile 稳定、monorepo 友好、disk 友好）
  - Test Unit/Contract：**Vitest 4+ + happy-dom + @testing-library/react**
  - Test E2E：**Playwright 1.58+**（Electron driver）
  - Packaging：**electron-builder 26+**（macOS/Windows/Linux 三平台；AppImage / dmg / nsis）
  - Auto-update：**electron-updater**（留接口；发布流程独立 ADR）
  - Lint：**oxlint**（快；vs ESLint 有较大速度优势），fallback `typescript` 自己的 typecheck
  - Format：**prettier 3+**
  - Git Hooks：**husky 9 + lint-staged 16**
  - Node：**>=22.12.0**
- **Consequences**：
  - ✅ 完整搬迁 opencove 工程基础设施
  - ✅ 社区生态成熟，踩坑资料丰富
  - ⚠️ Electron 内存占用偏大（vs Tauri）—— 如未来定位超轻量可重新评估
  - ⚠️ oxlint 规则生态不如 ESLint 完整 —— 预留切换口
- **Alternatives Considered**：Tauri（Rust 门槛、IPC 范式差异大）、Webpack/Rspack（electron-vite 已内置 Vite，无需自搭）、Jest（Vitest 与 Vite 同源，冷启动更快）
- **Follow-ups**：
  - Morrow 命名前缀 ADR（未来 0005）
  - 发布流程 ADR（未来 0006）
  - i18n 策略 ADR（未来 0007）

### 5.2 `DEVELOPMENT.md § Setup`（回填）

```markdown
## Setup

### Prerequisites
- Node.js >= 22.12.0
- pnpm >= 9.6.0
- OS: macOS / Windows / Linux

### Commands

| 目的 | 命令 |
|---|---|
| 安装依赖 | `pnpm install` |
| 启动开发（HMR） | `pnpm dev` |
| 构建产物 | `pnpm build` |
| 运行单元 + Contract 测试 | `pnpm test -- --run` |
| 运行 E2E | `pnpm test:e2e`（内部会先 `pnpm build`） |
| 类型检查 | `pnpm check` |
| Lint（修复） | `pnpm lint:fix` |
| Format（全仓） | `pnpm format` |
| **提交前全量闸门** | `pnpm pre-commit` |

注意：
- 单独跑 Playwright 前必须先 `pnpm build`，否则会用旧 `out/` 产物。
- 涉及 Main/Preload 改动，HMR 不覆盖，需重启 `pnpm dev` 或 `pnpm build` 后重启。
```

### 5.3 `DEVELOPMENT.md § 项目结构`（回填）

只写**规则**，不画具体目录树（留给首个代码 SDD）。规则直接引用新的 `docs/architecture/ARCHITECTURE.md`：

```markdown
## 项目结构

Morrow 采用 **DDD 划分领域 + Clean 约束依赖 + Electron 三进程边界**。

- 一级组织单位是 **context**（业务领域），不是 `controllers/`、`models/` 这类文件类型目录。
- 每个 context 内按 **Clean 四层**组织：`domain / application / infrastructure / presentation`。
- `src/app/main / src/app/preload / src/app/renderer` 只负责**进程边界装配**，不是业务 owner。
- 跨 context 通信必须通过 **application 层的端口**，不得直接写对方 store / 数据库。

详细规则见 `docs/architecture/ARCHITECTURE.md`。
具体目录树会随第一个代码 SDD 落地，落地后在此处补一份"当前结构快照"。
```

### 5.4 `DEVELOPMENT.md § Pre-commit 闸门`（回填）

```markdown
## Pre-commit 闸门

`pnpm pre-commit` 按固定顺序执行以下检查，任一失败即拒绝提交：

```bash
pnpm line-check:staged        # 单文件行数上限（超长强制拆分）
&& pnpm secret-check:staged   # 密钥/凭证扫描
&& pnpm naming-check:staged   # 命名规范（详见未来命名 ADR）
&& pnpm lint:fix              # oxlint 修复模式
&& pnpm format-check:staged   # prettier 格式校验（只看 staged 文件）
&& pnpm check                 # tsc 类型检查
&& pnpm test:staged           # vitest related-to-staged
&& pnpm test:e2e:pre-commit   # 受影响的 E2E 子集（用户可感知改动时触发）
```

### 使用约束
- 跑 `pnpm pre-commit` 前必须先 `git add`，因为 staged 类检查只看已暂存文件。
- 若 staged 里有超过 `line-check` 上限的文件，先拆分再跑闸门，不要带病过关。
- 用户可感知变更（feature / UX / bug fix / 默认行为变化）必须跑一次 E2E；
  纯内部重构可跳过 `test:e2e:pre-commit`，但必须跑 `test:staged`。
- 闸门失败先看 `docs/development/DEBUGGING.md § 失败后的首轮动作`，不要盲目重跑。

### CI 对齐
CI 在 PR 上运行的最低门槛 = 本地 `pnpm pre-commit` 全绿。
不允许"本地过 / CI 挂"或"CI 过 / 本地挂"的状态长期存在。
```

### 5.5 `DEVELOPMENT.md` 新增 § 测试分层与 E2E 策略

```markdown
## 测试分层与 E2E 策略

按**最低成本先定位**原则分配测试层级：

| 层级 | 目录 | 适用 | 跑法 |
|---|---|---|---|
| Unit | `tests/unit/` | 纯函数、状态迁移、协议解析、normalize | `pnpm test -- --run tests/unit/<target>.spec.ts` |
| Contract | `tests/contract/` | IPC payload、DTO 校验、跨层边界、错误码约定 | `pnpm test -- --run tests/contract/<target>.spec.ts` |
| Integration | `tests/integration/` | 真实 persistence、watcher、hydration、lifecycle 组合 | `pnpm test -- --run tests/integration/<target>.spec.ts` |
| E2E | `tests/e2e/` | 用户可感知路径、跨进程链路、真实交互 | `pnpm test:e2e tests/e2e/<target>.spec.ts` |

### 跨平台用例命名
- 平台通用：`foo.spec.ts`
- Windows 专属：`foo.windows.spec.ts`
- macOS 专属：`foo.mac.spec.ts`
- Linux 专属：`foo.linux.spec.ts`

对应 runner 必须在 CI 的同平台机器上执行。

### E2E 执行规约
- 默认窗口模式 `offscreen`；CI 环境禁用 `normal`（会抢焦点）。
- 崩溃自动降级链：`hidden → offscreen → inactive`（实现放在 `scripts/test-e2e-with-window-fallback.mjs`，脚本实现属下一个 SDD）。
- 单独跑 Playwright 必须先 `pnpm build`。

### 什么时候必须跑 E2E
- 新增用户可感知功能
- 修复用户可见 bug
- UX 改动（布局、动画、命中区域）
- 默认行为变化
- 主题 / 样式改动（附带截图）

### 什么时候可以只跑 Unit/Contract
- 纯内部重构
- 类型收敛
- 工具链 / 脚本调整
- 文档变更
```

### 5.6 `DEVELOPMENT.md` 扩展 § Electron 安全与 IPC 契约

把现有 `§ 安全通用规则 > 进程与沙箱` 扩展为独立章节：

```markdown
## Electron 安全与 IPC 契约

### 进程模型硬规则
- **Context Isolation**: 始终启用
- **Node Integration in Renderer**: 禁用
- **Sandbox**: 能开则开
- **CSP**: 生产禁止 `style-src 'unsafe-inline'`（仅开发环境允许）；配置入口 `electron.vite.config.ts`

### IPC 契约规则
- IPC channel 必须走**白名单**；禁止通配转发。
- Renderer → Main 的所有 payload 必须 **runtime validate**（推荐 zod 或手写 schema）。
- `main-ipc` handler 只做：`validate → map → invoke usecase → map result`，不承载长流程业务。
- 所有 `Command` 的副作用必须可解释、可恢复；`Query` 必须无副作用。
- 输出走统一的结构化错误语义（类似 `AppErrorDescriptor`），不暴露裸异常。

### Host Process（故障隔离）
当子系统满足以下任一条件，必须使用独立进程（`utilityProcess` / `child_process`）承载，而不是塞进 `main`：
- 加载 **native addon**（可能 `abort / segfault`）
- 运行不受信任或长时间保持的外部命令
- 其故障应表现为"子系统不可用"而不是"全应用退出"

`main` 只承担 supervisor 角色：启停、重启退避、health 汇总、统一日志、统一降级语义。

### 禁止的做法
- ❌ Renderer 直读写持久化
- ❌ Renderer 直连 host process
- ❌ IPC payload 里混入不可序列化对象（function / Symbol / DOM node）
- ❌ 用 `eval` / `new Function` / `require` dynamic load 用户输入
```

### 5.7 新增 `docs/architecture/ARCHITECTURE.md`

内容直接裁剪自 opencove `ARCHITECTURE.md` 第 1-11 节，**去业务化**处理：

- 保留：第 1 节（DDD + Clean 一句话）、第 2 节（一级组织规则）、第 3 节（Context 规则）、第 4 节（Clean 四层模板）、第 5 节（依赖规则 + 图）、第 6 节（进程边界 + host process）、第 7 节（恢复与持久化状态四分类）、第 8 节（Renderer 组织）、第 9 节（Main / IPC）、第 10 节（测试映射）、第 11 节（反模式）
- 删除：所有 `WorkspaceCapability / Space / Endpoint / Mount / Session / PTY / OpenCode / Codex / Terminal / React Flow` 具体业务例子
- 替换：`window.opencoveApi` → `window.morrowApi`（占位名，等 ADR 0005 命名 ADR 确认）
- 替换：`.opencove/` → `.morrow/`（同上）

完整内容见实现任务。

### 5.8 新增 `docs/development/DEBUGGING.md`

骨架（不抄 opencove 的具体案例）：

```markdown
# Debugging Guide — Morrow

## 规则
- 凡遇到 `pnpm pre-commit` / `pnpm test` / `pnpm test:e2e` / 单独 Playwright 用例失败，**继续排查前先读本文件**。
- 先缩小复现范围，再改代码；不要一上来跑全量。
- 若 UI 表现与代码不一致，先怀疑是否跑到了旧构建产物。

## 失败后的首轮动作
1. 记录**原始失败命令**与**首个失败用例/报错**。
2. 判断失败类型：`format/lint / typecheck / unit / contract / integration / E2E / runtime crash`。
3. 若是单独跑 Playwright，先 `pnpm build`。
4. 只重跑目标失败项，确认稳定复现。
5. 若是 E2E，优先看 `trace.zip`、`screenshot`、`console`、持久化状态。

## 测试层级选择策略
[同 DEVELOPMENT.md § 测试分层，此处只做索引]

## E2E 稳定运行原则
- 优先使用仓库脚本 `pnpm test:e2e`，不要直接调 `playwright test`。
- 默认窗口模式 `offscreen`；崩溃自动降级。
- 单独调 Playwright 前先 `pnpm build`。

## 持久化与状态污染排查
- 测试优先使用 seed 状态，不要依赖多步 UI 创建流程。
- 检查是否被前一个用例污染（localStorage / 数据库 / 全局单例）。
- 当 UI 与断言不一致时，直接读持久化状态确认真实结果。

## 视觉调试原则（UI 相关）
- 复杂交互（拖拽、滚动、动画、命中点）用真实 mouse 事件，不要只信 `dragTo()`。
- 主题/样式 bug 必须做**视觉验证**，不只看 DOM / 日志。
- 窗口模式不是越"隐藏"越稳；抓真实命中异常时用 `inactive` 或 `normal`。

## 案例库
> 本节空着。每次真实 bug 修复完毕后，把复盘沉淀到 `docs/cases/{kebab-slug}.md` 并在此处加索引。
> "每个真实 bug 留下可复用资产" 是 AGENTS.md Golden Rule #7。

## 一句话原则
- **先确认是不是旧构建，再怀疑代码。**
- **先看 trace 和持久化状态，再猜 UI。**
- **写不出稳定回归测试，就说明结构有问题，不是测试工具的问题。**
```

### 5.9 `AGENTS.md § 7` 更新

把 `§ 7 Setup & Commands` 从 TBD 占位改为：

```markdown
## 7. Setup & Commands

技术栈：Electron + React + TypeScript + electron-vite + pnpm + Vitest + Playwright（详见 ADR 0004）。

常用命令：`pnpm install / pnpm dev / pnpm build / pnpm test / pnpm test:e2e / pnpm pre-commit`。
完整命令表、版本约束、执行约束：见 `DEVELOPMENT.md § Setup` 与 `§ Pre-commit 闸门`。
```

### 5.10 `CONTRIBUTING.md` 更新

- `## Prerequisites`：写入 Node >= 22.12.0 / pnpm >= 9.6.0 / macOS·Windows·Linux
- `## Setup`：`git clone / pnpm install / pnpm dev`
- `## Verification`：三件套命令表（同 opencove）
- 保持 Morrow 已有风格；不照抄 opencove 的 CLA / Trademarks 段落（那是 opencove 开源治理特有）

### 5.11 `docs/decisions/README.md` 更新

在 Index 表格增加一行：
```
| 0004 | Tech stack selection | Accepted | 2026-05-12 |
```

### 5.12 `CHANGELOG.md` 更新

`[Unreleased]` 段落追加：
```
### Changed
- Harness: 技术栈正式选型（ADR 0004），DEVELOPMENT.md Setup / 项目结构 / Pre-commit 闸门回填具体命令
- Harness: 新增 docs/architecture/ARCHITECTURE.md 与 docs/development/DEBUGGING.md
```

---

## 6. 不变量（Invariants）

在所有实现与后续演进中始终成立：

1. **Doc ↔ ADR 一致性**：`DEVELOPMENT.md` 的命令 / 版本 / 结构，必须能在某条 ADR 中找到决策依据；反之，ADR 的每个 Decision 条目必须在 `DEVELOPMENT.md` 有落地位置。
2. **AGENTS.md 的业务中立**：`AGENTS.md` 仍然不含任何 Morrow 业务判断（不说我们做什么产品，只说我们怎么做工程）。
3. **架构文档的 project-agnostic**：`docs/architecture/ARCHITECTURE.md` 不引入"Morrow 是 codex 类产品 / 海外版 / 某某场景"等业务假设。
4. **零脚手架污染**：本 SDD 不生成 `package.json / tsconfig / vite.config / 任何源代码`；所有产物都是 `.md`。

---

## 7. 主要风险

| 风险 | 可能性 | 影响 | 缓解 |
|---|---|---|---|
| 写入具体命令但脚手架还没落地，文档与现实不一致 | 高 | 中 | 本 SDD 产出后下一步立即启动 `tech-stack-scaffold` SDD；在 CHANGELOG 明确标记"规约先行，脚手架随后" |
| 从 opencove 迁移架构规则时，带入了 opencove 特有假设（PTY / workspace / 外部 CLI） | 中 | 高 | 按 5.7 的"删除清单"逐条对照；评审时专门检查 project-agnostic 不变量 |
| oxlint / Biome / ESLint 选型未来反悔 | 中 | 低 | ADR 0004 写明 alternatives considered + 切换成本；oxlint 属易替换层 |
| Electron 内存 / 启动时间不达预期未来要换 Tauri | 低 | 高 | ADR 0004 明确"Electron 是当下最优解，非终身绑定"；架构规则（DDD + Clean）是运行时无关的，可平滑迁移 |
| 用户之后想改 harness 本身 | 中 | 低 | `AGENTS.md § 6 Out of Scope` 已禁止 agent 擅改；人类改动走 PR + CHANGELOG |

---

## 8. 验证方式

本 SDD 纯文档。验证手段：

1. **静态检查**：
   - 所有链接可达（ADR 索引、文档互引）
   - `DEVELOPMENT.md` 目录（TOC）与正文章节一致
2. **不变量自检**：人工逐条对照 § 6 四条不变量
3. **Spec 反向校验**：读完新 `DEVELOPMENT.md`，能否独立回答「怎么装依赖 / 怎么跑测试 / 怎么过闸门 / 代码放哪层」？
4. **人类 reviewer 评审**：按 `docs/playbooks/spec-review.md` 清单走一遍
5. **冷启动测试**：假装一个 AI agent 从零读 `AGENTS.md` + `DEVELOPMENT.md`，问它"我要加一个设置面板，下一步怎么走"——答案应该明确到"去 `settings` context 下新建 4 层 + 写 Spec"。

---

## 9. 预期成果

执行完毕后：
- ✅ Morrow 有正式的技术栈决策（ADR 0004）
- ✅ `pnpm install / pnpm dev / pnpm test / pnpm pre-commit` 在文档中都有明确定义
- ✅ 新 agent 看到「架构规则」「测试分层」「调试套路」有据可查
- ✅ 下一步可直接启动 `tech-stack-scaffold` SDD，把规约变成真实的 `package.json + tsconfig + electron-vite.config + scripts/`
- ✅ 整套 harness 从"骨架完成"升级到"骨架 + 血肉"，具备接收第一个业务 SDD 的能力

---

## 10. Follow-up SDDs（本次不做）

- `tech-stack-scaffold` — 生成实际的 `package.json / tsconfig / electron-vite.config / scripts/*.mjs / .husky/`
- `naming-prefix-adr` — ADR 0005，决定 `morrow:` / `Morrow` / `.morrow/` 等命名前缀
- `hello-world-app` — 第一个最小可运行产物（空窗口 + 一个 renderer hello world）
- `release-pipeline` — 发布与自动更新
