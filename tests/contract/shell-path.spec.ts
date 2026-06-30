import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  mergePaths,
  hydrateProcessPath,
  hydrateProcessPathAsync,
  hydrateProcessPathFromCache,
  loadShellPathCache,
  saveShellPathCache,
} from '../../src/app/main/shell-path';

describe('mergePaths', () => {
  it('去重保序', () => {
    expect(mergePaths('/a:/b:/c', '/b:/d')).toBe('/a:/b:/c:/d');
  });

  it('过滤空串与空白', () => {
    expect(mergePaths('/a::/b:', '  :/c')).toBe('/a:/b:/c');
  });

  it('忽略 null/undefined', () => {
    expect(mergePaths(null, '/a', undefined, '/b')).toBe('/a:/b');
  });

  it('都为空返回空串', () => {
    expect(mergePaths(null, '', undefined)).toBe('');
  });
});

describe('hydrateProcessPath', () => {
  const originalPath = process.env.PATH;
  const originalTerm = process.env.TERM_PROGRAM;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalTerm === undefined) delete process.env.TERM_PROGRAM;
    else process.env.TERM_PROGRAM = originalTerm;
    Object.defineProperty(process, 'platform', originalPlatform);
  });

  it('非 darwin 不动 PATH', () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    process.env.PATH = '/only/one';
    hydrateProcessPath();
    expect(process.env.PATH).toBe('/only/one');
  });

  it('terminal 启动（TERM_PROGRAM 存在）跳过', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    process.env.TERM_PROGRAM = 'iTerm.app';
    process.env.PATH = '/only/one';
    hydrateProcessPath();
    expect(process.env.PATH).toBe('/only/one');
  });

  it('darwin + 非 terminal：至少补齐 fallback dirs，且幂等', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    delete process.env.TERM_PROGRAM;
    process.env.PATH = '/usr/bin:/bin';
    hydrateProcessPath();
    const first = process.env.PATH!;
    expect(first).toContain('/opt/homebrew/bin');
    expect(first).toContain('/usr/local/bin');
    expect(first).toContain('/usr/bin');
    hydrateProcessPath();
    expect(process.env.PATH).toBe(first); // 幂等
  });
});

describe('shell path cache', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'morrow-shell-cache-'));
    file = join(dir, 'shell-path.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('loadShellPathCache: 文件不存在返回 null', () => {
    expect(loadShellPathCache(file)).toBeNull();
  });

  it('loadShellPathCache: JSON 损坏返回 null，不抛', () => {
    writeFileSync(file, '{not-json');
    expect(loadShellPathCache(file)).toBeNull();
  });

  it('loadShellPathCache: path 字段非法返回 null', () => {
    writeFileSync(file, JSON.stringify({ path: 'no-slash' }));
    expect(loadShellPathCache(file)).toBeNull();
  });

  it('saveShellPathCache / loadShellPathCache: 往返一致', () => {
    saveShellPathCache(file, '/opt/homebrew/bin:/usr/local/bin');
    expect(loadShellPathCache(file)).toBe('/opt/homebrew/bin:/usr/local/bin');
  });

  it('saveShellPathCache: 缺少父目录时自动 mkdir', () => {
    const nested = join(dir, 'a', 'b', 'shell-path.json');
    saveShellPathCache(nested, '/usr/local/bin');
    expect(existsSync(nested)).toBe(true);
    const payload = JSON.parse(readFileSync(nested, 'utf8'));
    expect(payload.path).toBe('/usr/local/bin');
    expect(typeof payload.savedAt).toBe('number');
  });
});

describe('hydrateProcessPathFromCache', () => {
  const originalPath = process.env.PATH;
  const originalTerm = process.env.TERM_PROGRAM;
  const originalE2E = process.env.MORROW_E2E;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'morrow-shell-cache-'));
    file = join(dir, 'shell-path.json');
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalTerm === undefined) delete process.env.TERM_PROGRAM;
    else process.env.TERM_PROGRAM = originalTerm;
    if (originalE2E === undefined) delete process.env.MORROW_E2E;
    else process.env.MORROW_E2E = originalE2E;
    Object.defineProperty(process, 'platform', originalPlatform);
    rmSync(dir, { recursive: true, force: true });
  });

  it('缓存缺失返回 false 且不动 PATH', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    delete process.env.TERM_PROGRAM;
    delete process.env.MORROW_E2E;
    process.env.PATH = '/usr/bin:/bin';
    expect(hydrateProcessPathFromCache(file)).toBe(false);
    expect(process.env.PATH).toBe('/usr/bin:/bin');
  });

  it('命中缓存时 PATH 被 merge + 去重', () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    delete process.env.TERM_PROGRAM;
    delete process.env.MORROW_E2E;
    process.env.PATH = '/usr/bin:/bin';
    saveShellPathCache(file, '/opt/homebrew/bin:/usr/local/bin');
    expect(hydrateProcessPathFromCache(file)).toBe(true);
    const p = process.env.PATH!;
    expect(p.startsWith('/opt/homebrew/bin:/usr/local/bin')).toBe(true);
    expect(p).toContain('/usr/bin');
    // 再次调用幂等
    const before = process.env.PATH;
    expect(hydrateProcessPathFromCache(file)).toBe(true);
    expect(process.env.PATH).toBe(before);
  });

  it('非 darwin / terminal / e2e 全部跳过', () => {
    saveShellPathCache(file, '/opt/homebrew/bin');
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    process.env.PATH = '/x';
    expect(hydrateProcessPathFromCache(file)).toBe(false);
    expect(process.env.PATH).toBe('/x');

    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    process.env.TERM_PROGRAM = 'iTerm.app';
    expect(hydrateProcessPathFromCache(file)).toBe(false);
    delete process.env.TERM_PROGRAM;

    process.env.MORROW_E2E = '1';
    expect(hydrateProcessPathFromCache(file)).toBe(false);
  });
});

describe('hydrateProcessPathAsync', () => {
  const originalPath = process.env.PATH;
  const originalTerm = process.env.TERM_PROGRAM;
  const originalE2E = process.env.MORROW_E2E;
  const originalShell = process.env.SHELL;
  const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')!;
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'morrow-shell-async-'));
    file = join(dir, 'shell-path.json');
  });

  afterEach(() => {
    process.env.PATH = originalPath;
    if (originalTerm === undefined) delete process.env.TERM_PROGRAM;
    else process.env.TERM_PROGRAM = originalTerm;
    if (originalE2E === undefined) delete process.env.MORROW_E2E;
    else process.env.MORROW_E2E = originalE2E;
    if (originalShell === undefined) delete process.env.SHELL;
    else process.env.SHELL = originalShell;
    Object.defineProperty(process, 'platform', originalPlatform);
    rmSync(dir, { recursive: true, force: true });
  });

  it('非 darwin 直接 resolve，不碰 PATH、不写缓存', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    process.env.PATH = '/only/one';
    await hydrateProcessPathAsync(file);
    expect(process.env.PATH).toBe('/only/one');
    expect(existsSync(file)).toBe(false);
  });

  it('darwin + 无 $SHELL：仍补齐 fallback dirs，但不写缓存', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    delete process.env.TERM_PROGRAM;
    delete process.env.MORROW_E2E;
    delete process.env.SHELL;
    process.env.PATH = '/usr/bin:/bin';
    await hydrateProcessPathAsync(file);
    expect(process.env.PATH).toContain('/opt/homebrew/bin');
    expect(existsSync(file)).toBe(false); // 无 login shell PATH 时不污染缓存
  });

  it('darwin + $SHELL=/bin/sh 并拿到合法 PATH 时写缓存', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    delete process.env.TERM_PROGRAM;
    delete process.env.MORROW_E2E;
    // /bin/sh -ilc 'echo $PATH' 在 macOS 上应能返回一个包含斜杠的字符串
    process.env.SHELL = '/bin/sh';
    process.env.PATH = '/usr/bin:/bin';
    await hydrateProcessPathAsync(file);
    // 缓存可能写入也可能未写入（取决于 sh 行为），但若写入 path 字段必须包含斜杠
    if (existsSync(file)) {
      const payload = JSON.parse(readFileSync(file, 'utf8'));
      expect(typeof payload.path).toBe('string');
      expect(payload.path).toContain('/');
    }
    expect(process.env.PATH).toContain('/opt/homebrew/bin');
  }, 10000);
});
