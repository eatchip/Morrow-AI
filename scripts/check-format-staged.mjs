#!/usr/bin/env node
/**
 * 闸门 5：staged 文件 prettier 格式校验。
 */
import { spawnSync } from 'node:child_process';

const stagedRes = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
});
if (stagedRes.status !== 0) {
  console.error('[format-check] git diff failed');
  process.exit(1);
}
const files = stagedRes.stdout.split('\n').filter(Boolean);
if (files.length === 0) {
  process.exit(0);
}

const res = spawnSync(
  'pnpm',
  ['exec', 'prettier', '--check', '--ignore-unknown', '--no-error-on-unmatched-pattern', ...files],
  {
    stdio: 'inherit',
    shell: false,
  },
);
process.exit(res.status ?? 1);
