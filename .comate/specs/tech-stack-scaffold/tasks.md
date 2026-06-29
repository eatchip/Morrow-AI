# Plan: tech-stack-scaffold

按"每一步都能独立通过一个具体命令验证"的原则拆分。执行顺序从**最小可安装** → **可启动** → **可测试** → **可 E2E** → **可 pre-commit** → **文档闭环**，每完成一个 Task 就对应一次 atomic commit。

---

- [x] Task 1: 落地包管理骨架（可 `pnpm install`）
    - 1.1: 创建 `package.json`（含 engines / packageManager / scripts 全集 / dependencies / devDependencies / lint-staged / pnpm.overrides / pnpm.onlyBuiltDependencies）
    - 1.2: 创建 `.npmrc`（`engine-strict=true` / `auto-install-peers=true`）
    - 1.3: 更新 `.gitignore`（追加 `out/` `dist/` `coverage/` `playwright-report/` `test-results/` `node_modules/`）
    - 1.4: 验证 `pnpm install` 干净通过；记录 lock 文件生成
    - 1.5: commit: `chore(scaffold): bootstrap package manifest and install baseline`

- [x] Task 2: TypeScript / Lint / Format / Secret 配置
    - 2.1: 创建 `tsconfig.json`（root references）
    - 2.2: 创建 `tsconfig.node.json`（main + preload 侧，target ES2022，module NodeNext，isolatedModules）
    - 2.3: 创建 `tsconfig.web.json`（renderer 侧，jsx react-jsx，lib DOM + ES2022）
    - 2.4: 创建 `.oxlintrc.json`（基础 + react + ts 规则；`no-restricted-imports` 守住 renderer 不 import electron / main / preload）
    - 2.5: 创建 `.prettierrc` + `.prettierignore`
    - 2.6: 创建 `.secretlintrc.json`（启用 `@secretlint/secretlint-rule-preset-recommend`）
    - 2.7: 验证 `pnpm check` / `pnpm lint` / `pnpm format:check` 空仓均零错（空仓情况下三者应 pass-through）
    - 2.8: commit: `chore(scaffold): wire typescript / oxlint / prettier / secretlint configs`

- [x] Task 3: Electron 三进程最小骨架 + electron-vite 配置
    - 3.1: 创建 `electron.vite.config.ts`（三端装配 + React 插件 + alias + 产物到 `out/`）
    - 3.2: 创建 `src/app/main/window.ts`（`createMainWindow` 工厂，安全默认三开关全开）
    - 3.3: 创建 `src/app/main/index.ts`（`app.whenReady` → `createMainWindow`；macOS activate；window-all-closed 退出）
    - 3.4: 创建 `src/app/preload/index.ts`（`contextBridge.exposeInMainWorld('morrowApi', Object.freeze({}))`）
    - 3.5: 创建 `src/app/preload/index.d.ts`（global `Window['morrowApi']` 类型声明）
    - 3.6: 创建 `src/app/renderer/index.html`（含基础 CSP meta；mount `<div id="root">`）
    - 3.7: 创建 `src/app/renderer/src/main.tsx` + `App.tsx`（`<p data-testid="scaffold-ok">scaffold ok</p>`）
    - 3.8: 创建 `src/app/renderer/src/index.css`（空占位 + 注释声明 token 系统待落地）
    - 3.9: 验证 `pnpm build` 产出 `out/main/index.js` / `out/preload/index.js` / `out/renderer/index.html`；`pnpm dev` 人工肉眼验证显示 "scaffold ok"
    - 3.10: commit: `feat(scaffold): wire electron main/preload/renderer entry with safe defaults`

- [x] Task 4: Vitest 配置与单元/契约冒烟测试
    - 4.1: 创建 `vitest.config.ts`（happy-dom + `@testing-library/jest-dom` setup；include 白名单 `tests/unit/` `tests/contract/` `tests/integration/`）
    - 4.2: 创建 `tests/unit/scaffold.spec.ts`（trivial sanity）
    - 4.3: 创建 `tests/contract/preload-api-shape.spec.ts`（断言桥导出 shape 为冻结空对象：直接 import preload 模块时的静态形状校验，不跨进程）
    - 4.4: 验证 `pnpm test -- --run` 全绿
    - 4.5: commit: `test(scaffold): add vitest config and smoke unit/contract specs`

- [x] Task 5: Playwright E2E 冒烟
    - 5.1: 创建 `playwright.config.ts`（electron project；默认 `offscreen` 窗口；forbid CI `normal`）
    - 5.2: 创建 `scripts/test-e2e-with-window-fallback.mjs`（最小版：检测 `out/main/index.js` 不存在时自动先跑 `pnpm build`，然后调 `playwright test`；降级链留 TODO）
    - 5.3: 创建 `tests/e2e/scaffold-smoke.spec.ts`（启动 electron → 断言 `[data-testid="scaffold-ok"]` 文本）
    - 5.4: 验证 `pnpm test:e2e` 绿
    - 5.5: commit: `test(scaffold): add playwright e2e smoke and window fallback launcher`

- [x] Task 6: Pre-commit 闸门脚本 + Husky hook
    - 6.1: 创建 `scripts/check-max-lines.mjs`（staged 文件行数上限；默认 400，`MAX_LINES` 可覆盖；二进制跳过）
    - 6.2: 创建 `scripts/check-secrets-staged.mjs`（转调 `secretlint` + staged 过滤）
    - 6.3: 创建 `scripts/check-naming-staged.mjs`（占位，stderr 打 "rules TBD"，exit 0）
    - 6.4: 创建 `scripts/check-format-staged.mjs`（转调 `prettier --check` + staged 过滤）
    - 6.5: 创建 `scripts/run-vitest-related-staged.mjs`（转调 `vitest related --run` + staged 过滤）
    - 6.6: 创建 `scripts/run-precommit-e2e.mjs`（staged 命中 renderer/presentation 路径才跑 E2E，否则 skip）
    - 6.7: 创建 `.husky/pre-commit`（单行 `pnpm pre-commit`）
    - 6.8: 验证：空 staged → `pnpm pre-commit` 绿；伪造超长文件 staged → `line-check` 拦截；伪造含假 AWS key 文件 → `secret-check` 拦截
    - 6.9: commit: `chore(scaffold): wire pre-commit gate scripts and husky hook`

- [x] Task 7: 文档联动（CHANGELOG + 需批准的 DEVELOPMENT/AGENTS 改写）
    - 7.1: 更新 `CHANGELOG.md` § [Unreleased]：Added 段加本 SDD 产物；Notes 段把"下一步 tech-stack-scaffold"改写为"已完成"，并声明 naming-check / E2E 降级链 / design-token lint 三项延后 SDD
    - 7.2: **需用户批准**后再改：`DEVELOPMENT.md § Setup / § 项目结构 / § Pre-commit 闸门` 三处 🚧 规约提示去除 + 加"当前结构快照"小节
    - 7.3: **需用户批准**后再改：`AGENTS.md § 1.8` 末句"`tech-stack-scaffold` 落地前……其后由 lint 强制"改写为"延后到独立 SDD `design-tokens-enforcement`"
    - 7.4: 全量回归：`pnpm pre-commit` 再跑一遍全绿
    - 7.5: commit: `docs(scaffold): close changelog and update harness status`（若 7.2/7.3 获批则合并为同一 commit，否则单独 commit 且标注"pending user manual edits"）

- [x] Task 8: 生成 summary.md 并自审
    - 8.1: 汇总各 Task 产物、命令验证结果、遗留 TODO（降级链 / naming / token lint）
    - 8.2: 对照 `doc.md § 9 验收标准` 逐条打勾
    - 8.3: 写入 `.comate/specs/tech-stack-scaffold/summary.md`
