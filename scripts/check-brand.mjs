#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const ignoredDirs = new Set([
  '.git',
  'node_modules',
  '.pnpm-store',
  'dist',
  'out',
  'coverage',
  'build',
  'playwright-report',
  'test-results',
]);
const oldTokens = [
  String.fromCharCode(68, 117, 109, 97, 116, 101),
  String.fromCharCode(100, 117, 109, 97, 116, 101),
  String.fromCharCode(68, 85, 77, 65, 84, 69),
];
const maxTextBytes = 5 * 1024 * 1024;
const failures = [];

function hasOldToken(value) {
  return oldTokens.some((token) => value.includes(token));
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.' || entry.name === '..') continue;
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = join(dir, entry.name);
    const rel = relative(root, full) || entry.name;
    if (hasOldToken(rel)) {
      failures.push(`${rel}: path contains old brand token`);
    }
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.isFile()) continue;
    const stat = statSync(full);
    if (stat.size > maxTextBytes) continue;
    const buf = readFileSync(full);
    if (buf.includes(0)) continue;
    const text = buf.toString('utf8');
    const lines = text.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (hasOldToken(line)) {
        failures.push(`${rel}:${index + 1}: contains old brand token`);
      }
    });
  }
}

walk(root);

if (failures.length > 0) {
  console.error('Brand check failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log('Brand check passed.');
