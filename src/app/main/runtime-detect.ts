import { execFile } from 'node:child_process';
import type { DetectResult, RuntimeId, RuntimeInfo } from '../../shared/ipc';
import { sanitizedRuntimeEnv } from './runtime-env';

const DETECT_TIMEOUT_MS = 3000;
const VERSION_RE = /\b(\d+\.\d+\.\d+)\b/;

interface ProbeOutcome {
  version: string | null;
  binaryPath: string | null;
  error: string | null;
}

function probe(cmd: RuntimeId): Promise<ProbeOutcome> {
  return new Promise((resolve) => {
    // shell:false + execFile，通过 PATH 查找；失败（ENOENT / 非 0）走 error 分支。
    const child = execFile(
      cmd,
      ['--version'],
      { timeout: DETECT_TIMEOUT_MS, windowsHide: true, env: sanitizedRuntimeEnv() },
      (err, stdout, stderr) => {
        if (err) {
          resolve({
            version: null,
            binaryPath: null,
            error: (err.message || String(err)).slice(0, 200),
          });
          return;
        }
        const out = String(stdout || stderr || '');
        const match = out.match(VERSION_RE);
        resolve({
          version: match ? match[1]! : null,
          binaryPath: null, // execFile 不直接返回绝对路径；已知"能跑"已足够
          error: match ? null : `unexpected --version output: ${out.slice(0, 120)}`,
        });
      },
    );
    // execFile 已带 timeout；这里仅防御性 noop 以避免 unhandled
    child.on('error', () => {});
  });
}

async function detectOne(id: RuntimeId): Promise<RuntimeInfo> {
  const outcome = await probe(id);
  const installed = outcome.version !== null;
  return {
    id,
    installed,
    version: outcome.version,
    binaryPath: outcome.binaryPath,
    error: installed ? null : outcome.error,
  };
}

export async function detectRuntimes(): Promise<DetectResult> {
  const [claude, codex] = await Promise.all([detectOne('claude'), detectOne('codex')]);
  return { claude, codex };
}
