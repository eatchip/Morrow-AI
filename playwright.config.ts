import { defineConfig } from '@playwright/test';

/**
 * Playwright E2E config for Morrow Electron app.
 *
 * 运行方式：`pnpm test:e2e`
 * 入口脚本 `scripts/test-e2e-with-window-fallback.mjs` 负责：
 *   - 检测 `out/main/index.js` 不存在时自动先跑 `pnpm build`；
 *   - 透传参数给 playwright。
 *
 * 窗口模式：`MORROW_E2E=1` 下主进程不调 `win.show()`，macOS 额外用 `setActivationPolicy('accessory')`
 *   + `dock.hide()` 让 App 在背后运行，不抢焦点、不进 Dock / ⌘+Tab。CI 禁用 `normal`。
 * 实现见 `src/app/main/index.ts` 与 `src/app/main/window.ts`。
 */
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : [['list']],
  forbidOnly: !!process.env['CI'],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
});
