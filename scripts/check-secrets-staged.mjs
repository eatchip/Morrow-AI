#!/usr/bin/env node
/**
 * 闸门 2：staged 文件密钥扫描。转调 secretlint 对 staged 文件做过滤。
 */
import { spawnSync } from 'node:child_process';

const stagedRes = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
});
if (stagedRes.status !== 0) {
  console.error('[secret-check] git diff failed');
  process.exit(1);
}
const files = stagedRes.stdout.split('\n').filter(Boolean);
if (files.length === 0) {
  process.exit(0);
}

const res = spawnSync('pnpm', ['exec', 'secretlint', '--maskSecrets', '--', ...files], {
  stdio: 'inherit',
  shell: false,
});
process.exit(res.status ?? 1);
