import { execFile, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname } from 'node:path';

const QUERY_TIMEOUT_MS = 3000;

const FALLBACK_DIRS: readonly string[] = [
  '/opt/homebrew/bin',
  '/opt/homebrew/sbin',
  '/usr/local/bin',
  '/usr/local/sbin',
  '/usr/bin',
  '/bin',
  '/usr/sbin',
  '/sbin',
];

function userBinDirs(): string[] {
  const home = homedir();
  return [`${home}/.local/bin`, `${home}/bin`, `${home}/.cargo/bin`];
}

function shellProbeEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    PATH: [...userBinDirs(), ...FALLBACK_DIRS].join(':'),
    DISABLE_AUTO_TITLE: '1',
  };
}

/**
 * 合并多个 PATH 来源为一个冒号分隔字符串，保序去重、过滤空串。
 * 纯函数，供单测。
 */
export function mergePaths(...sources: Array<string | null | undefined>): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const src of sources) {
    if (!src) continue;
    for (const raw of src.split(':')) {
      const p = raw.trim();
      if (!p) continue;
      if (seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
  }
  return out.join(':');
}

/**
 * 从登录 shell 读取 PATH。任何异常（无 $SHELL / 超时 / 非 0 退出 / 解析失败）一律返回 null，
 * 由调用方 fallback。
 */
export function getShellPathFromLogin(): string | null {
  const shell = process.env.SHELL;
  if (!shell) return null;
  try {
    const res = spawnSync(shell, ['-ilc', 'echo $PATH'], {
      timeout: QUERY_TIMEOUT_MS,
      encoding: 'utf8',
      windowsHide: true,
      env: shellProbeEnv(),
    });
    if (res.status !== 0) return null;
    // rc 脚本里可能 echo 杂质，取最后一行非空
    const lines = String(res.stdout || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const last = lines[lines.length - 1];
    if (!last || !last.includes('/')) return null;
    return last;
  } catch {
    return null;
  }
}

/**
 * 修复 `process.env.PATH`：登录 shell PATH + 常见 bin fallback + 原 PATH，保序去重。
 *
 * 跳过条件（这些场景已经继承了合理的 PATH）：
 * - `TERM_PROGRAM` 存在：从 terminal 启动（vscode / iTerm / Apple Terminal / jetbrains 等）
 * - `MORROW_E2E=1`：E2E mock 模式
 * - 非 darwin：Windows / Linux 从 desktop env 拿到的 PATH 合理，不干预
 *
 * 幂等：多次调用不会重复拼接（去重保序保证）。
 */
export function hydrateProcessPath(): void {
  if (process.platform !== 'darwin') return;
  if (process.env.TERM_PROGRAM) return;
  if (process.env.MORROW_E2E === '1') return;

  const loginPath = getShellPathFromLogin();
  const merged = mergePaths(
    loginPath,
    [...userBinDirs(), ...FALLBACK_DIRS].join(':'),
    process.env.PATH,
  );
  if (merged) {
    process.env.PATH = merged;
  }
}

/**
 * 异步版 hydrate：把登录 shell 调用挪出启动关键路径。
 *
 * 与 `hydrateProcessPath` 语义一致（相同跳过条件、相同 merge 策略、相同幂等性），
 * 区别仅在于 shell 查询走 `execFile` 而非 `spawnSync`，可与 window/renderer 启动并行。
 *
 * 若提供 `cacheFile`，且成功拿到 login shell PATH，则写入缓存；下次启动先走
 * `hydrateProcessPathFromCache` 命中即可跳过 shell spawn。
 */
export async function hydrateProcessPathAsync(cacheFile?: string): Promise<void> {
  if (process.platform !== 'darwin') return;
  if (process.env.TERM_PROGRAM) return;
  if (process.env.MORROW_E2E === '1') return;

  const loginPath = await getShellPathFromLoginAsync();
  const merged = mergePaths(
    loginPath,
    [...userBinDirs(), ...FALLBACK_DIRS].join(':'),
    process.env.PATH,
  );
  if (merged) {
    process.env.PATH = merged;
  }
  if (loginPath && cacheFile) {
    saveShellPathCache(cacheFile, loginPath);
  }
}

/**
 * 从缓存读到 login shell PATH 时同步 hydrate。μs 级，适合放在 app.whenReady 之初。
 * 返回是否命中缓存；未命中时调用方应再 schedule `hydrateProcessPathAsync`。
 */
export function hydrateProcessPathFromCache(cacheFile: string): boolean {
  if (process.platform !== 'darwin') return false;
  if (process.env.TERM_PROGRAM) return false;
  if (process.env.MORROW_E2E === '1') return false;

  const cached = loadShellPathCache(cacheFile);
  if (!cached) return false;
  const merged = mergePaths(
    cached,
    [...userBinDirs(), ...FALLBACK_DIRS].join(':'),
    process.env.PATH,
  );
  if (merged) {
    process.env.PATH = merged;
  }
  return true;
}

/**
 * Promise 版 login shell PATH 读取。任何异常（无 $SHELL / 超时 / 非 0 退出 / 解析失败）
 * 一律 resolve(null)，由调用方 fallback。
 */
export function getShellPathFromLoginAsync(): Promise<string | null> {
  return new Promise((resolve) => {
    const shell = process.env.SHELL;
    if (!shell) {
      resolve(null);
      return;
    }
    try {
      execFile(
        shell,
        ['-ilc', 'echo $PATH'],
        {
          timeout: QUERY_TIMEOUT_MS,
          windowsHide: true,
          env: shellProbeEnv(),
        },
        (err, stdout) => {
          if (err) {
            resolve(null);
            return;
          }
          const lines = String(stdout || '')
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          const last = lines[lines.length - 1];
          if (!last || !last.includes('/')) {
            resolve(null);
            return;
          }
          resolve(last);
        },
      ).on('error', () => resolve(null));
    } catch {
      resolve(null);
    }
  });
}

interface ShellPathCachePayload {
  path: string;
  savedAt: number;
}

/**
 * 读缓存文件（JSON）。文件不存在 / JSON 损坏 / path 字段非法一律返回 null，不抛。
 */
export function loadShellPathCache(file: string): string | null {
  try {
    const raw = readFileSync(file, 'utf8');
    const json = JSON.parse(raw) as Partial<ShellPathCachePayload>;
    if (typeof json?.path === 'string' && json.path.includes('/')) {
      return json.path;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 写缓存文件。写失败（磁盘满 / 权限 / 目录不存在失败）不得抛出，启动链路永远优先。
 */
export function saveShellPathCache(file: string, path: string): void {
  try {
    mkdirSync(dirname(file), { recursive: true });
    const payload: ShellPathCachePayload = { path, savedAt: Date.now() };
    writeFileSync(file, JSON.stringify(payload), 'utf8');
  } catch {
    // intentionally swallow: cache failures must never break launch
  }
}
