#!/usr/bin/env node
/**
 * 闸门 1：staged 文件单文件行数上限。
 * 默认 400 行；通过 MAX_LINES 覆盖。二进制文件跳过。
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const MAX_LINES = Number(process.env['MAX_LINES'] ?? 400);
const repoRoot = process.cwd();

// SDD 归档文档（doc.md / tasks.md / summary.md）属规约/复盘长文，不适用代码行数约束。
const EXEMPT_PREFIXES = ['.comate/specs/'];
const EXEMPT_FILES = new Set(['pnpm-lock.yaml']);

const stagedRes = spawnSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], {
  encoding: 'utf8',
});
if (stagedRes.status !== 0) {
  console.error('[line-check] git diff failed');
  process.exit(1);
}
const files = stagedRes.stdout.split('\n').filter(Boolean);
if (files.length === 0) {
  process.exit(0);
}

function isBinary(buf) {
  // 简易判定：前 8000 字节含 \0 视为二进制
  const slice = buf.subarray(0, Math.min(buf.length, 8000));
  return slice.includes(0);
}

function isExempt(rel) {
  return EXEMPT_FILES.has(rel) || EXEMPT_PREFIXES.some((p) => rel.startsWith(p));
}

let failed = 0;
for (const rel of files) {
  if (isExempt(rel)) continue;
  const abs = resolve(repoRoot, rel);
  try {
    const st = statSync(abs);
    if (!st.isFile()) continue;
    const buf = readFileSync(abs);
    if (isBinary(buf)) continue;
    const text = buf.toString('utf8');
    const lines = text.split('\n').length;
    if (lines > MAX_LINES) {
      console.error(`[line-check] ${rel}: ${lines} lines > MAX_LINES=${MAX_LINES}`);
      failed += 1;
    }
  } catch {
    // 文件可能在 staged 列表里但实际被删除 → 跳过
  }
}

if (failed > 0) {
  console.error(`[line-check] ${failed} file(s) exceed MAX_LINES. Split them before committing.`);
  process.exit(1);
}
