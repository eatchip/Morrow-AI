#!/usr/bin/env node
/**
 * 闸门 7：针对 staged 文件跑相关 vitest 用例（related mode）。
 */
import { spawnSync } from 'node:child_process';

const stagedRes = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
});
if (stagedRes.status !== 0) {
  console.error('[test:staged] git diff failed');
  process.exit(1);
}
const files = stagedRes.stdout.split('\n').filter(Boolean);
// 只关心可能影响测试的代码/测试源
const testable = files.filter((f) => /\.(ts|tsx|mjs|cjs|js|jsx)$/.test(f));
if (testable.length === 0) {
  console.log('[test:staged] no testable files staged, skip.');
  process.exit(0);
}

const res = spawnSync('pnpm', ['exec', 'vitest', 'related', '--run', ...testable], {
  stdio: 'inherit',
  shell: false,
});
process.exit(res.status ?? 1);
