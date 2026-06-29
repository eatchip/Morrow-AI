# gui-launch-path 任务计划

- [x] Task 1: `shell-path.ts` 工具模块
    - 1.1: `mergePaths()` 纯函数（保序去重、过滤空串）
    - 1.2: `getShellPathFromLogin()`（spawnSync $SHELL -ilc，3s 超时，异常返回 null）
    - 1.3: `hydrateProcessPath()` 编排 + dev 跳过逻辑

- [x] Task 2: 接入 main 入口
    - 2.1: `src/app/main/index.ts` 首行调用 `hydrateProcessPath()`

- [x] Task 3: 单测
    - 3.1: `tests/unit/shell-path.spec.ts` 覆盖 `mergePaths` + `hydrateProcessPath` 幂等

- [x] Task 4: 本地打 dmg 自验
    - 4.1: `pnpm dist:mac` 重新出包
    - 4.2: 双击 arm64 dmg → 拖进 Applications → 启动 → 看 Home 页是否识别出 codex

- [x] Task 5: 切版 · CHANGELOG · 发布
    - 5.1: `package.json` bump `0.1.1`
    - 5.2: CHANGELOG `[0.1.1] - 2026-05-12` 段
    - 5.3: commit · tag `v0.1.1` · push → CI 自动构建 draft release → PATCH 发布
