# Harness Refinement v1 — Tasks

> 依据 `.comate/specs/harness-refinement-v1/doc.md`。
> 全部任务均为文档编辑，零源码产物。每个顶层任务完成后立即打勾。

---

- [x] Task 1: 新增 ADR 0004（技术栈正式选型）
    - 1.1: 创建 `docs/decisions/0004-tech-stack.md`，Status = Accepted，Date = 2026-05-12
    - 1.2: Context / Decision / Consequences / Alternatives Considered / Follow-ups 五段齐全
    - 1.3: Decision 内显式列出 Electron / electron-vite / React / TS / pnpm / Vitest / Playwright / electron-builder / electron-updater / oxlint / prettier / husky / lint-staged 的大版本
    - 1.4: Alternatives 段说明 Tauri / Jest / Webpack 为什么没选
    - 1.5: Follow-ups 段列出 0005 命名前缀 / 0006 发布流程 / 0007 i18n 三个后续 ADR 占位

- [x] Task 2: 在 `docs/decisions/README.md` 索引中追加 ADR 0004
    - 2.1: 表格新增一行 `| 0004 | Tech stack selection | Accepted | 2026-05-12 |`

- [x] Task 3: 回填 `DEVELOPMENT.md § Setup`
    - 3.1: 删除 TBD 占位块
    - 3.2: 写入 Prerequisites（Node >= 22.12.0 / pnpm >= 9.6.0 / 三平台）
    - 3.3: 写入 Commands 表（install / dev / build / test / test:e2e / check / lint:fix / format / pre-commit）
    - 3.4: 写入使用注意事项（Playwright 前须 build、Main/Preload 不 HMR）

- [x] Task 4: 回填 `DEVELOPMENT.md § 项目结构`
    - 4.1: 删除 TBD 占位
    - 4.2: 写入 DDD + Clean + 三进程 的规则文字
    - 4.3: 指向 `docs/architecture/ARCHITECTURE.md`
    - 4.4: 说明"具体目录树等首个代码 SDD 落地后补快照"

- [x] Task 5: 回填 `DEVELOPMENT.md § Pre-commit 闸门`
    - 5.1: 删除 TBD 备注
    - 5.2: 写入 `pnpm pre-commit` 的 8 步命令链（line-check / secret-check / naming-check / lint:fix / format-check / check / test:staged / test:e2e:pre-commit）
    - 5.3: 写入使用约束（先 git add / 超长文件先拆 / 可感知变更必跑 E2E）
    - 5.4: 写入 CI 对齐说明

- [x] Task 6: 新增 `DEVELOPMENT.md § 测试分层与 E2E 策略`
    - 6.1: 表格定义 Unit / Contract / Integration / E2E 四层目录与跑法
    - 6.2: 写入跨平台用例命名约定（`*.windows.spec.ts` / `*.mac.spec.ts` / `*.linux.spec.ts`）
    - 6.3: 写入 E2E 执行规约（窗口模式 / 崩溃降级 / 单独跑 Playwright 前 build）
    - 6.4: 写入"什么时候必须跑 E2E" 与 "什么时候只跑 Unit/Contract"

- [x] Task 7: 扩展 `DEVELOPMENT.md § 安全通用规则` 为独立章节 `§ Electron 安全与 IPC 契约`
    - 7.1: 进程模型硬规则（Context Isolation / Node Integration / Sandbox / CSP）
    - 7.2: IPC 契约规则（白名单 channel / runtime validate / Command vs Query / 统一错误语义）
    - 7.3: Host Process 故障隔离规则
    - 7.4: 禁止的做法清单
    - 7.5: 同步更新目录（Index）

- [x] Task 8: 新增 `docs/architecture/ARCHITECTURE.md`
    - 8.1: 创建文件，11 节结构对齐 opencove 原版
    - 8.2: 去除 opencove 业务语义（Workspace / Space / Endpoint / Mount / Session / PTY / OpenCode / Codex / Terminal / React Flow 全部删掉或替换为中性表达）
    - 8.3: 占位替换：`window.opencoveApi` → `window.morrowApi`（标注待 ADR 0005 确认）、`.opencove/` → `.morrow/`（同上）
    - 8.4: 验证 project-agnostic 不变量：通读一遍，不得出现任何 Morrow 业务假设

- [x] Task 9: 新增 `docs/development/DEBUGGING.md`
    - 9.1: 创建文件骨架（规则 / 首轮动作 / 层级选择索引 / E2E 原则 / 状态污染排查 / 视觉调试 / 案例库占位 / 一句话原则）
    - 9.2: 不抄 opencove 的具体 xterm/React Flow/Playwright 案例
    - 9.3: 案例库留"本节空着 + 每次真实 bug 后沉淀"的资产化提示

- [x] Task 10: 更新 `AGENTS.md § 7 Setup & Commands`
    - 10.1: 删除 TBD 占位
    - 10.2: 写入技术栈一行概述 + 常用命令 + 指向 `DEVELOPMENT.md § Setup / § Pre-commit 闸门`
    - 10.3: 验证 AGENTS.md 总行数仍然在合理范围（不引入业务判断）

- [x] Task 11: 更新 `CONTRIBUTING.md`
    - 11.1: Prerequisites 段回填 Node/pnpm/OS 版本
    - 11.2: Setup 段回填 `git clone / pnpm install / pnpm dev`
    - 11.3: Verification 段回填三件套命令表
    - 11.4: 保持 Morrow 风格，不引入 opencove 特有 CLA / Trademarks 段落

- [x] Task 12: 更新 `CHANGELOG.md`
    - 12.1: `[Unreleased] > Changed` 追加两条（ADR 0004 / DEVELOPMENT.md 补齐 / 新增 architecture + debugging 两文档）
    - 12.2: 保持 Keep a Changelog 格式

- [x] Task 13: 生成 summary.md 并全局自检
    - 13.1: 自检 § 6 四条不变量是否都满足（Doc↔ADR 一致 / AGENTS.md 业务中立 / ARCHITECTURE project-agnostic / 零脚手架污染）
    - 13.2: 自检所有文档互引链接可达
    - 13.3: 写 `.comate/specs/harness-refinement-v1/summary.md`
