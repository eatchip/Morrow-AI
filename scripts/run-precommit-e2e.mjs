#!/usr/bin/env node
/**
 * 闸门 8：pre-commit 阶段的受影响 E2E 子集。
 *
 * 本最小版的策略：若 staged 文件命中 renderer / preload / main / e2e 路径，则跑一次完整 E2E 冒烟；
 * 否则跳过（非 user-facing 改动）。
 *
 * TODO: 未来用 `playwright test --grep` 或测试->源码影响图做更精细的子集选择。
 */
import { spawnSync } from 'node:child_process';

const stagedRes = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
});
if (stagedRes.status !== 0) {
  console.error('[test:e2e:pre-commit] git diff failed');
  process.exit(1);
}
const files = stagedRes.stdout.split('\n').filter(Boolean);
const userFacingPatterns = [
  /^src\/app\/renderer\//,
  /^src\/app\/preload\//,
  /^src\/app\/main\//,
  /^tests\/e2e\//,
  /^electron\.vite\.config\.ts$/,
  /^playwright\.config\.ts$/,
];
const hit = files.some((f) => userFacingPatterns.some((p) => p.test(f)));
if (!hit) {
  console.log('[test:e2e:pre-commit] no user-facing change detected, skip.');
  process.exit(0);
}

console.log('[test:e2e:pre-commit] user-facing change detected, running `pnpm test:e2e` ...');
const res = spawnSync('pnpm', ['test:e2e'], { stdio: 'inherit', shell: false });
process.exit(res.status ?? 1);
