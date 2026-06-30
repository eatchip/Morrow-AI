#!/usr/bin/env node
/**
 * test:e2e launcher.
 *
 * 职责：
 *   1. 若产物 `out/main/index.js` 不存在，先跑 `pnpm build`；
 *   2. 调 Playwright 跑 tests/e2e；
 *   3. 透传 CLI 参数。
 *
 * 窗口模式：当前固定 `hidden` 一档（main 进程在 `MORROW_E2E=1` 下不调 `win.show()`，
 *   macOS 加 `setActivationPolicy('accessory')` + `dock.hide()`）。多档降级
 *   （`hidden → offscreen → inactive`）若未来需要，由独立 SDD `e2e-window-fallback` 推进。
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const repoRoot = resolve(new URL('.', import.meta.url).pathname, '..');
const mainBundle = resolve(repoRoot, 'out/main/index.js');

function run(cmd, args) {
  // 部分宿主环境（如嵌入了 Node 的 IDE）会把 ELECTRON_RUN_AS_NODE=1 透传下来，
  // 导致真·Electron 被当成 Node 启动；E2E 路径下必须剔除。
  const env = { ...process.env };
  delete env['ELECTRON_RUN_AS_NODE'];
  const res = spawnSync(cmd, args, { stdio: 'inherit', cwd: repoRoot, shell: false, env });
  if (res.error) {
    console.error(`[test:e2e] spawn error:`, res.error);
    process.exit(1);
  }
  return res.status ?? 1;
}

if (!existsSync(mainBundle)) {
  console.log('[test:e2e] out/main/index.js missing, running `pnpm build` first ...');
  const buildStatus = run('pnpm', ['build']);
  if (buildStatus !== 0) {
    console.error('[test:e2e] build failed, abort.');
    process.exit(buildStatus);
  }
}

const extraArgs = process.argv.slice(2);
const status = run('pnpm', ['exec', 'playwright', 'test', ...extraArgs]);
process.exit(status);
