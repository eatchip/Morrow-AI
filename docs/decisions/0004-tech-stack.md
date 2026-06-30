# ADR 0004: 技术栈选型（Tech Stack Selection）

- **Status**: Accepted
- **Date**: 2026-06-30
- **Deciders**: 项目 owner
- **Tags**: tooling / architecture / runtime

---

## Context

Morrow 海外版需要一个跨平台桌面基座（macOS / Windows / Linux）。项目尚无源代码，团队首要诉求是：
- **尽快做出可演示的 demo**，验证产品方向
- **降低工程决策成本**：团队对桌面技术栈经验有限，再自选一遍"最优组合"成本高、风险大
- **可移植的工程规约**：AI agent 与人类贡献者都要能依靠明确的命令、目录、测试层级协作

同仓内存在一个已经在生产迭代、采用成熟工程规约的参考项目 `opencove`。其栈已经在多平台、多 agent（Claude Code / Codex / Cursor 等）协作下稳定运行 6 个月以上。

约束：
- 团队对 Rust / Go / Swift / Kotlin 等原生栈经验较少
- 需要支持真实的 AI agent 嵌入（长进程、IPC、流式输出）
- 希望 AI agent 与人类都能在同一套 harness 下高效工作

---

## Decision

**Morrow 采用与 OpenCove 一致的核心技术栈**。具体：

### Runtime & Shell
- **Electron 35+** — 跨平台桌面框架
- **Node.js >= 22.12.0** — 主进程运行时

### Build & Dev
- **electron-vite 5+** — 主 / 预加载 / 渲染三端一体化构建
- **Vite 6+** — 底层打包器

### UI
- **React 19+** — 渲染层框架
- **TypeScript 5.7+** — 全栈类型系统

### Package Manager
- **pnpm >= 9.6.0** — 依赖管理（lockfile 稳定、monorepo 友好、disk 友好）

### Testing
- **Vitest 4+** — 单元 / Contract / Integration 测试
- **happy-dom** — 轻量 DOM 模拟
- **@testing-library/react** — React 组件测试工具
- **Playwright 1.58+** — E2E 测试（Electron driver）

### Packaging & Distribution
- **electron-builder 26+** — 三平台打包（macOS dmg / Windows nsis / Linux AppImage）
- **electron-updater** — 自动更新（发布流程细节留给未来 ADR 0006）

### Code Quality
- **oxlint 1.55+** — Lint（相比 ESLint 速度数量级优势）
- **prettier 3+** — 格式化
- **husky 9 + lint-staged 16** — Git hooks 与 staged 级校验
- **secretlint 11+** — 密钥扫描（可选，但推荐）

### Scope of this Decision
- 全仓库适用
- 不锁定具体业务运行时依赖（数据库、IM、AI 提供商等），留给各模块 ADR 决定
- 不锁定发布与签名流程，留给 ADR 0006

---

## Consequences

### Positive
- **零决策成本启动**：可直接参照 opencove 的 `package.json` 与工程脚本
- **AI agent 友好**：opencove 已在 AGENTS.md / Claude Code / Codex 协作下跑熟，规约可平移
- **生态成熟**：Electron + React + TS + Vite + Vitest + Playwright 是桌面 AI 工具领域最主流组合（Cursor、VS Code、Zed Web、Notion Desktop 等都在此生态内）
- **踩坑资料丰富**：任一问题在 StackOverflow / GitHub Issue 都有可参考案例
- **构建产物跨平台**：electron-builder 开箱支持 macOS / Windows / Linux

### Negative / Trade-offs
- **内存占用偏大**：相比 Tauri（Rust + 系统 WebView）约多 100–200MB；若未来定位超轻量产品需重新评估
- **包体较大**：单平台安装包约 80–150MB（含 Chromium runtime）
- **oxlint 规则生态不如 ESLint 完整**：个别插件（如 eslint-plugin-react-hooks 的深度规则）需自行补齐或回退 ESLint
- **electron-updater 仅支持 GitHub / 自托管**：若未来走企业私服还需改造

### Mitigations
- 架构约束（DDD + Clean，见 `docs/architecture/ARCHITECTURE.md`）是**运行时无关**的；未来如需切换到 Tauri，业务层可平滑迁移
- oxlint 不够用时可在 `package.json` 中并列接入 ESLint，渐进替换
- 发布流程独立到 ADR 0006 决定，不被本 ADR 锁死

### Neutral
- 团队需要补齐 Electron 进程模型（Main / Preload / Renderer）与 IPC 的基础知识
- pnpm 的 `onlyBuiltDependencies` / `overrides` 语义需要工程师理解，避免误改

---

## Alternatives Considered

| 方案 | 评估 | 未采纳原因 |
|---|---|---|
| **Tauri 2 + Rust + WebView** | 体积小、内存低、启动快 | 团队 Rust 经验缺失；IPC 范式与 Electron 差异大；AI agent 工具链（Playwright Electron driver 等）成熟度不如 Electron |
| **VS Code Extension Host** | 直接在 VS Code 生态中做 | 产品定位是独立应用，不是 IDE 扩展；会被 VS Code UI 语言限制 |
| **Web App + PWA** | 无需打包、部署简单 | 本地文件 / 长进程 / IPC / 系统集成能力受限；AI agent 的本地工作区场景难以实现 |
| **Jest（替代 Vitest）** | 生态大 | 与 Vite 非同源，冷启动慢 1–2 个数量级；happy-dom 集成不如 Vitest 丝滑 |
| **Webpack / Rspack（替代 Vite）** | 老牌稳定 | electron-vite 已内置 Vite；再叠一层 Webpack 无收益 |
| **ESLint（替代 oxlint）** | 规则生态最完整 | 10–100 倍速度差异在 pre-commit 闸门上体感明显；留切换口即可 |
| **npm / yarn（替代 pnpm）** | npm 零配置 | lockfile 稳定性、disk 占用、monorepo 支持都弱于 pnpm |

---

## Follow-ups

本 ADR **只决定技术栈**，以下独立 ADR 后续补齐：

- **ADR 0005（规划中）**：命名前缀决策（`morrow:` vs `Morrow` vs `.morrow/` 等）
- **ADR 0006（规划中）**：发布流程（签名、CI、自动更新通道）
- **ADR 0007（规划中）**：i18n 策略（locale 文件组织、fallback、热切换）

同时，本 ADR 落地需要一个独立 SDD：**`tech-stack-scaffold`**，负责生成实际的 `package.json / tsconfig / electron-vite.config / scripts/*.mjs / .husky/`。本 ADR 只是规约决策，不产出代码文件。

---

## References

- OpenCove `package.json` 与 `DEVELOPMENT.md`（本仓库所在机器：`../opencove/`）
- [AGENTS.md 开放标准](https://agents.md/)
- [electron-vite 官方文档](https://electron-vite.org/)
- [Vitest vs Jest 性能对比](https://vitest.dev/guide/comparisons.html)
- 本仓前置 ADR：[0002 Harness 双文件架构](./0002-harness-dual-file.md)、[0003 SDD 工作流](./0003-sdd-workflow.md)
