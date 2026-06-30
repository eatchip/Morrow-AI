# DEVELOPMENT.md — Morrow Source of Truth

> 本文件是 Morrow 仓库**开发方法论的权威来源**。
> `AGENTS.md` 定义"必须遵守什么"，本文件定义"具体怎么做"。
> 任何与本文件冲突的实践，要么本文件错了（发起修订 PR），要么实践错了（停下对齐）。

---

## 开发导航（Index）

- [如何使用本文件](#如何使用本文件)
- [Setup](#setup)
- [项目结构](#项目结构)
- [核心编码原则（Core Coding Principles）](#核心编码原则-core-coding-principles)
- [架构执行触发器（Architecture Triggers）](#架构执行触发器-architecture-triggers)
- [高风险问题预防策略](#高风险问题预防策略)
- [通用参考学习与方案生成法（Research → Synthesize → Adapt → Verify）](#通用参考学习与方案生成法)
- [风险与合规检查清单](#风险与合规检查清单)
- [测试分层与 E2E 策略](#测试分层与-e2e-策略)
- [Pre-commit 闸门](#pre-commit-闸门)
- [交付与发布闭环](#交付与发布闭环)
- [Electron 安全与 IPC 契约](#electron-安全与-ipc-契约)
- [Observability / Logging 原则](#observability--logging-原则)
- [安全通用规则](#安全通用规则)

---

## 如何使用本文件

| 读者 | 怎么用 |
|---|---|
| **AI Agent** | 在 `AGENTS.md § 0 First Read` 要求下必读。编码前对照 § Pre-Coding Checks 与本文 § 风险与合规检查清单。 |
| **人类工程师** | 首次 onboarding 读全文；之后按需查阅特定章节。 |
| **Reviewer** | PR 评审时用 § 风险与合规清单 作为底线。 |

遇到本文件没覆盖的情境：
1. 先查 `docs/playbooks/{任务类型}.md`
2. 再查 `docs/decisions/`（历史决策）
3. 仍无答案 → 发起讨论，必要时沉淀为新 ADR 或 playbook

---

## Setup

技术栈决策见 [ADR 0004](./docs/decisions/0004-tech-stack.md)：
Electron + React + TypeScript + electron-vite + pnpm + Vitest + Playwright + electron-builder。

### Prerequisites

- **Node.js** `>= 22.12.0`
- **pnpm** `>= 9.6.0`
- **OS**：macOS / Windows / Linux 任一

### Commands

| 目的 | 命令 |
|---|---|
| 安装依赖 | `pnpm install` |
| 启动开发（HMR） | `pnpm dev` |
| 构建产物 | `pnpm build` |
| 类型检查 | `pnpm check` |
| Lint（自动修复） | `pnpm lint:fix` |
| Format（全仓） | `pnpm format` |
| 运行 Unit / Contract 测试 | `pnpm test -- --run` |
| 运行 E2E | `pnpm test:e2e`（内部会先 `pnpm build`） |
| **提交前全量闸门** | `pnpm pre-commit` |

### 使用注意

- **单独跑 Playwright 前必须先 `pnpm build`**，否则 Playwright 会使用旧的 `out/` 产物，造成"代码已改、现象未变"的假失败。
- **Main / Preload 改动不走 HMR**：修改 `src/app/main/` 或 `src/app/preload/` 后必须重启 `pnpm dev` 或 `pnpm build` 后重启。
- **渲染层改动走 Vite HMR**：`src/app/renderer/` 下改动通常无需重启。
- **依赖变更后先 `pnpm install`**，再启动；不要手工改 `pnpm-lock.yaml`。

### 脚手架状态

脚手架已由 SDD `tech-stack-scaffold` 落地（`.comate/specs/tech-stack-scaffold/summary.md`）：`package.json` / `.npmrc` / `tsconfig.*` / `.oxlintrc.json` / `.prettier*` / `.secretlintrc.json` / `electron.vite.config.ts` / `vitest.config.ts` / `playwright.config.ts` / `scripts/*.mjs` / `.husky/pre-commit` 均已入库，上述命令可直接执行。

---

## 项目结构

Morrow 采用 **DDD 划分领域 + Clean 约束依赖 + Electron 三进程边界**：

- **一级组织单位是 context（业务领域）**，不是 `controllers/`、`models/` 这类文件类型目录。
- **每个 context 内按 Clean 四层组织**：`domain / application / infrastructure / presentation`。
- **`src/app/main / src/app/preload / src/app/renderer` 只负责进程边界装配**，不是业务 owner。
- **跨 context 通信必须通过 application 层的端口**，不得直接写对方 store / 数据库。

详细规则（含依赖方向、反模式、进程边界的 host process 故障隔离）见
[`docs/architecture/ARCHITECTURE.md`](./docs/architecture/ARCHITECTURE.md)。

### 当前结构快照（tech-stack-scaffold 落地后）

```
src/app/
  main/          # Electron 主进程（supervisor / 窗口 / 生命周期）
    index.ts
    window.ts
  preload/       # 白名单桥接（contextBridge）
    index.ts
    index.d.ts
  renderer/      # React 渲染层
    index.html
    src/
      main.tsx
      App.tsx
      index.css
tests/
  unit/          # 纯函数 / 状态迁移
  contract/      # IPC payload / DTO 形状
  integration/   # 真实 persistence（占位）
  e2e/           # Playwright + Electron
  setup/         # vitest setup
scripts/         # 闸门脚本（check-*.mjs / run-*.mjs / test-e2e-with-window-fallback.mjs）
.husky/          # pre-commit hook
```

业务 context 目录（`src/contexts/{ctx}/{domain,application,infrastructure,presentation}`）由后续业务 SDD 引入，脚手架阶段仅留三进程边界壳。

---

## 核心编码原则（Core Coding Principles）

以下原则在本项目**高于个人偏好与风格争议**：

1. **Prioritize Reuse**
   动手前先搜已有实现。重复实现同类逻辑 2 次以上，第 3 次必须抽公共单元。

2. **State Ownership**
   每一份可变状态必须有**唯一** owner。派生态（UI 投影、缓存）标注来源，不得反向修改源头。

3. **Keep Boundaries Clean**
   进程边界 / 模块边界 / 网络边界都要有显式的数据契约与校验。边界内代码互信，边界外代码不信。

4. **Encapsulate Cross-Cutting Concerns**
   日志、重试、权限、i18n 等横切关注点集中封装，不在业务逻辑里散点处理。

5. **Logic Internalization**
   业务规则应当在领域层内部表达，而不是散落在 UI 层或胶水代码里。

6. **Structural Clarity > Patch Accumulation**
   当第 3 个补丁仍在打同一个坑时，停下来做结构性重构，而不是继续糊。

7. **SOLID as a Check, Not a Religion**
   用 SOLID 做设计 sanity check，不为了 SOLID 而过度抽象。

8. **In-App Feedback, Not System Dialogs**
   用户级错误使用应用内一致的提示系统；系统对话框仅用于不可恢复的致命错误。

---

## 架构执行触发器（Architecture Triggers）

出现以下任一信号，**必须从 Small 升级到 Large，或从打补丁升级到结构性重构**：

1. 同一类问题第 3 次出现
2. 修复 bug 需要跨 ≥ 3 个模块同时改动
3. 有不可表述的"隐式约定"（"这里只能这样调，别动"）
4. 某类状态在 ≥ 2 个地方被独立维护
5. 添加新 feature 需要修改多处无关代码
6. 测试难以写是因为设计难以切分，不是因为测试工具不行

---

## 高风险问题预防策略

### 状态分类
每个可变状态归入 4 类之一，明确生命周期与持久性：
- **User Intent**：用户显式表达的意愿（应持久化）
- **Durable Fact**：系统已确认的事实（应持久化）
- **Runtime Observation**：运行时观察值（进程内）
- **UI Projection**：UI 层派生（不持久化，不做事实源）

### 不变量优先
写测试前先写 1–3 条不变量，用场景枚举补齐边角。

### 失败模型
对每个关键路径显式回答：
- 失败时会出现什么状态？
- 能否自动恢复？恢复后状态是否一致？
- 重启后是否还能回到一致态？

### 按风险层分配测试
详见 § 测试分层与 E2E 策略。

---

## 通用参考学习与方案生成法

处理成熟工业问题时必须走：

```
Research → Synthesize → Adapt → Verify
```

1. **Research**：找 2–3 个最佳参考（头部开源项目 / 领域论文 / 成熟商业实现），阅读关键代码与设计文档
2. **Synthesize**：抽取共同模式与关键 trade-off，形成一张对比表
3. **Adapt**：结合 Morrow 约束做裁剪（不是抄，是迁移）
4. **Verify**：用最小实验证伪关键假设，再展开

详见 `docs/playbooks/research-method.md`。

---

## 风险与合规检查清单

**Large 任务在 Spec 与 PR 中必须显式回答**：

### Critical Stability Checklist
- [ ] **Async Gap Safety**：是否存在异步中途状态被破坏的窗口？
- [ ] **Concurrency & Race**：并发访问是否有序？临界区是否明确？
- [ ] **State Ownership**：owner 明确？允许的迁移？
- [ ] **Restart / Recovery Semantics**：崩溃后能否恢复一致态？
- [ ] **IPC / Process Boundary Security**：跨进程输入是否校验？
- [ ] **Resource Lifecycle**：连接 / 文件 / 订阅是否有 close 路径？
- [ ] **Performance**：有没有 O(n²) 以上的隐藏复杂度？
- [ ] **Data Integrity**：写路径是否保证原子性或可回滚？

### Triggered Compliance Gates
- [ ] **Architecture**：是否违反既定边界？（见 `docs/architecture/ARCHITECTURE.md`）
- [ ] **Type Safety**：是否引入隐式 any / 裸 string union？
- [ ] **Security**：是否涉及敏感数据 / 凭证 / 网络？（见 § Electron 安全与 IPC 契约）
- [ ] **Licensing**：新依赖许可证是否兼容？

---

## 测试分层与 E2E 策略

按**最低成本先定位**原则分配测试层级。

### 四层划分

| 层级 | 目录 | 适用场景 | 命令 |
|---|---|---|---|
| **Unit** | `tests/unit/` | 纯函数、状态迁移、协议解析、normalize | `pnpm test -- --run tests/unit/<target>.spec.ts` |
| **Contract** | `tests/contract/` | IPC payload 校验、DTO、跨层边界、错误码约定 | `pnpm test -- --run tests/contract/<target>.spec.ts` |
| **Integration** | `tests/integration/` | 真实 persistence、watcher、hydration、lifecycle 组合 | `pnpm test -- --run tests/integration/<target>.spec.ts` |
| **E2E** | `tests/e2e/` | 用户可感知路径、跨进程链路、真实交互 | `pnpm test:e2e tests/e2e/<target>.spec.ts` |

### 跨平台用例命名

- 平台通用：`foo.spec.ts`
- Windows 专属：`foo.windows.spec.ts`
- macOS 专属：`foo.mac.spec.ts`
- Linux 专属：`foo.linux.spec.ts`

对应 runner 必须在 CI 的同平台机器上执行；凡修复平台特有 bug，必须补对应平台的 E2E。

### E2E 执行规约

- 默认窗口模式：`hidden`（`show: false` 且不调 `show()`），跑测时不抢焦点、不进 Dock / ⌘+Tab。macOS 额外加 `setActivationPolicy('accessory')` + `dock.hide()`。
- 由 `MORROW_E2E=1` 触发，真实用户启动路径完全不受影响。CI 禁用 `normal` 模式（会抢焦点）。
- **单独跑 Playwright 前必须先 `pnpm build`**。
- 失败后首轮动作见 [`docs/development/DEBUGGING.md`](./docs/development/DEBUGGING.md)。

### 什么时候必须跑 E2E

- 新增用户可感知功能
- 修复用户可见 bug
- UX 改动（布局、动画、命中区域）
- 默认行为变化
- 主题 / 样式改动（附带截图）

### 什么时候可以只跑 Unit / Contract

- 纯内部重构
- 类型收敛
- 工具链 / 脚本调整
- 文档变更

---

## Pre-commit 闸门

`pnpm pre-commit` 按固定顺序执行以下检查，任一失败即拒绝提交：

```bash
pnpm line-check:staged        # 1. 单文件行数上限（超长强制拆分）
&& pnpm secret-check:staged   # 2. 密钥 / 凭证扫描
&& pnpm naming-check:staged   # 3. 命名规范（详见未来命名 ADR）
&& pnpm lint:fix              # 4. oxlint 修复模式
&& pnpm format-check:staged   # 5. prettier 格式校验（只看 staged 文件）
&& pnpm check                 # 6. tsc 类型检查
&& pnpm test:staged           # 7. vitest related-to-staged
&& pnpm test:e2e:pre-commit   # 8. 受影响的 E2E 子集（用户可感知改动时触发）
```

### 使用约束

- **先 `git add` 再跑闸门**：staged 类检查只看已暂存文件。
- **超长文件先拆分再跑**：`line-check:staged` 失败时不要带病过关。
- **可感知变更必跑 E2E**：`test:e2e:pre-commit` 是硬要求，不是可选。
- **失败先读 `DEBUGGING.md`**：不要盲目重跑。
- **不允许绕过**：任何 `--no-verify` 或 `SKIP_*` 的用法需在 PR 中显式说明理由。

### CI 对齐

CI 在 PR 上运行的最低门槛 = 本地 `pnpm pre-commit` 全绿。
不允许"本地过 / CI 挂"或"CI 过 / 本地挂"的状态长期存在——出现即属优先级 0 bug。

### 闸门脚本现状

- `scripts/check-max-lines.mjs`：staged 文件单文件 ≤ `MAX_LINES`（默认 400），二进制跳过
- `scripts/check-secrets-staged.mjs`：staged 过滤后转调 `secretlint`
- `scripts/check-naming-staged.mjs`：占位（exit 0 + stderr "rules TBD"），待命名规范 ADR 落地后补齐，由独立 SDD `naming-rules` 承接
- `scripts/check-format-staged.mjs`：`prettier --check --ignore-unknown`
- `scripts/run-vitest-related-staged.mjs`：`vitest related --run`
- `scripts/run-precommit-e2e.mjs`：staged 命中 renderer/preload/main/e2e 才跑 E2E，否则 skip
- `.husky/pre-commit`：注入 Node 22 + corepack pnpm PATH 后调 `pnpm pre-commit`

---

## 交付与发布闭环

详细步骤见 [`docs/playbooks/release-handoff.md`](./docs/playbooks/release-handoff.md)。

- 用户明确说“可以合入 / 发布 / 更新 GitHub / 让所有人使用 / 打包”时，视为已授权完整发布闭环，不再二次确认。
- 发布闭环必须覆盖文档与版本、验证、打包、合入 `main`、推送 GitHub、tag release、`releases/latest` 核验。
- 每次实现或发布的最终回复必须给一行可复制体验命令，例如 `cd /Users/songhuiyu/Morrow && pnpm dev`。

---

## Electron 安全与 IPC 契约

### 进程模型硬规则

- **Context Isolation**：始终启用
- **Node Integration in Renderer**：禁用
- **Sandbox**：能开则开；若某模块需要关闭沙箱，必须在 ADR 中说明必要性与缓解
- **CSP**：生产环境禁止 `style-src 'unsafe-inline'`（仅开发环境允许）；配置入口 `electron.vite.config.ts`

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
- ❌ Renderer 直连 host process（必须经 `main-ipc`）
- ❌ IPC payload 里混入不可序列化对象（function / Symbol / DOM node）
- ❌ 用 `eval / new Function / require` 动态加载用户输入
- ❌ 在 `main` 进程内承载会 `abort / segfault` 的 native 运行时

---

## Observability / Logging 原则

1. **结构化日志优先**：key=value 或 JSON，禁止未分级的纯文本日志
2. **日志分级**：`TRACE / DEBUG / INFO / WARN / ERROR / FATAL`，默认生产环境 INFO 及以上
3. **不记录敏感信息**：凭证、PII、token 必须脱敏
4. **关键链路打点**：启动 / 关键状态迁移 / 失败分支 / 性能热点
5. **可追踪**：跨模块流程带 trace id 或 correlation id

---

## 安全通用规则

> Electron 进程与 IPC 相关的具体规约已独立至上文 § Electron 安全与 IPC 契约。

### 密钥与凭证
- 严禁硬编码；走环境变量或安全存储
- `.env*` 除 `.env.example` 外全部 gitignore
- 任何疑似硬编码凭证 → 立即 rotate + 清理历史

### 输入校验
- 所有跨边界输入都需校验：类型、长度、格式、取值范围
- **允许列表优先于拒绝列表**

### 第三方依赖
- 新增依赖必须在 Spec 或 ADR 中声明：用途 / 许可证 / 维护状态 / 替代方案
- 避免单点维护（< 3 名活跃 maintainer 的关键依赖要警惕）

---

## 附：本文件的更新规则

- 本文件的修改属于 `AGENTS.md § 6 Out of Scope`，**agent 不得擅自修改**
- 修订路径：issue / 讨论 → Spec → ADR（若涉及方向性变更）→ PR
- 每次修订必须更新 `CHANGELOG.md`
