# Tasks — E2E Background Window

> Spec：[`doc.md`](./doc.md)
> 分支：`feat/background-automation`
> 闸门：`pnpm pre-commit` 必须全绿

- [x] Task 1: 主进程 E2E 模式接入「不 show + accessory policy + dock.hide」三件套
    - 1.1: 编辑 `src/app/main/window.ts`，在 E2E 模式下跳过 `win.show()`
    - 1.2: 编辑 `src/app/main/index.ts`，在 macOS + E2E 模式下 `app ready` 前调 `setActivationPolicy('accessory')`，`whenReady` 后调 `dock.hide()`
    - 1.3: 本地跑 `pnpm test:e2e` 验证 mvp-smoke 通过
    - 1.4: 手动验证：跑 E2E 时当前活动编辑器窗口不失焦、Dock 不出现 Morrow 图标
    - 1.5: 反向验证：`pnpm dev` 启动时窗口照常可见、Dock 正常、可聚焦（防回归）

- [x] Task 2: 同步过期文档与注释
    - 2.1: 更新 `playwright.config.ts` 顶部 JSDoc 注释（offscreen → hidden + accessory policy）
    - 2.2: 更新 `scripts/test-e2e-with-window-fallback.mjs` 顶部注释（移除"降级链 TODO"，改为说明已实装 hidden 模式的现状与未来 SDD 边界）
    - 2.3: 更新 `docs/development/DEBUGGING.md` 行 47-48 与行 98 关于窗口模式的描述
    - 2.4: 更新 `DEVELOPMENT.md` 行 251-252

- [ ] Task 3: 收尾：CHANGELOG + 提交
    - 3.1: 在 `CHANGELOG.md` 的 `[Unreleased]` 段落追加 user-visible 变更说明
    - 3.2: 跑 `pnpm pre-commit` 全闸门
    - 3.3: 按 §5 Commit Hygiene 用原生 `git` 提交（`feat(main): ...`）；不调 auto-commit skill
    - 3.4: 生成 `summary.md`
