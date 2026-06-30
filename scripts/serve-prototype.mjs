#!/usr/bin/env node
/**
 * serve-prototype.mjs
 *
 * 为 SDD 视觉评审阶段的 HTML 可交互原型提供本地静态服务，规避 file:// 下的
 * CORS / ESM / dynamic import 限制。
 *
 * 规约来源：SDD `design-review-html-first` / `docs/playbooks/design-review.md § AI 产出 HTML 原型规约`
 *
 * 用法：
 *   pnpm prototype:serve <feature-name>          # 默认端口 5178
 *   pnpm prototype:serve <feature-name> --port 6000
 *
 * 解析顺序（跨平台）：
 *   1. .comate/specs/{feature}/prototype/latest  （软链，macOS / Linux 首选）
 *   2. .comate/specs/{feature}/prototype/latest.txt  （内容形如 "v2"，跨平台兜底）
 */
import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat, readFile, realpath } from 'node:fs/promises';
import { join, resolve, extname, sep, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.htm': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

function parseArgs(argv) {
  const args = { feature: null, port: 5178 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--port' || a === '-p') {
      args.port = Number(argv[++i]);
    } else if (!args.feature && !a.startsWith('-')) {
      args.feature = a;
    }
  }
  return args;
}

function usageAndExit(code = 1) {
  console.error(
    [
      'Usage: pnpm prototype:serve <feature-name> [--port <n>]',
      '',
      'Serves .comate/specs/<feature-name>/prototype/latest/ at http://localhost:<port>/',
    ].join('\n'),
  );
  process.exit(code);
}

async function resolveLatestDir(featureDir) {
  const linkPath = join(featureDir, 'latest');
  try {
    const s = await stat(linkPath);
    if (s.isDirectory()) return await realpath(linkPath);
  } catch {
    // fallthrough to latest.txt
  }
  const txtPath = join(featureDir, 'latest.txt');
  try {
    const version = (await readFile(txtPath, 'utf8')).trim();
    if (!version) throw new Error('latest.txt is empty');
    const dir = join(featureDir, version);
    const s = await stat(dir);
    if (!s.isDirectory()) throw new Error(`${dir} is not a directory`);
    return dir;
  } catch (err) {
    throw new Error(
      `Cannot resolve current prototype version.\n` +
        `  Neither <featureDir>/latest (symlink) nor <featureDir>/latest.txt works.\n` +
        `  featureDir: ${featureDir}\n` +
        `  inner error: ${err.message}`,
      { cause: err },
    );
  }
}

function safeJoin(rootDir, urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const target = normalize(join(rootDir, relative));
  if (!target.startsWith(rootDir + sep) && target !== rootDir) {
    return null;
  }
  return target;
}

async function main() {
  const { feature, port } = parseArgs(process.argv.slice(2));
  if (!feature || !Number.isFinite(port) || port <= 0 || port > 65535) usageAndExit();

  const featureDir = join(REPO_ROOT, '.comate', 'specs', feature, 'prototype');
  const rootDir = await resolveLatestDir(featureDir);

  const server = createServer(async (req, res) => {
    try {
      const target = safeJoin(rootDir, req.url || '/');
      if (!target) {
        res.writeHead(400).end('bad path');
        return;
      }
      let filePath = target;
      const s = await stat(filePath).catch(() => null);
      if (s?.isDirectory()) filePath = join(filePath, 'index.html');
      const finalStat = await stat(filePath).catch(() => null);
      if (!finalStat || !finalStat.isFile()) {
        res.writeHead(404).end('not found');
        return;
      }
      const mime = MIME[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': mime, 'cache-control': 'no-store' });
      createReadStream(filePath).pipe(res);
    } catch (err) {
      res.writeHead(500).end(`server error: ${err.message}`);
    }
  });

  server.listen(port, '127.0.0.1', () => {
    console.log(`[prototype:serve] feature: ${feature}`);
    console.log(`[prototype:serve] root:    ${rootDir}`);
    console.log(`[prototype:serve] url:     http://localhost:${port}/`);
    console.log(`[prototype:serve] press Ctrl+C to stop.`);
  });

  const shutdown = () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error(`[prototype:serve] ${err.message}`);
  process.exit(1);
});
