import { beforeEach, describe, expect, it, vi } from 'vitest';

type ExecFileCb = (err: Error | null, stdout: string, stderr: string) => void;

const { execFileMock } = vi.hoisted(() => ({ execFileMock: vi.fn() }));
vi.mock('node:child_process', () => {
  const execFile = (
    cmd: string,
    _args: string[],
    _opts: unknown,
    cb: ExecFileCb,
  ): { on: (ev: string, h: () => void) => void } => {
    execFileMock(cmd, cb);
    return { on: () => {} };
  };
  return { execFile, default: { execFile } };
});

// import after mock
const { detectRuntimes } = await import('../../src/app/main/runtime-detect');

function scenario(responses: Record<string, [Error | null, string, string]>): void {
  execFileMock.mockImplementation((cmd: string, cb: ExecFileCb) => {
    const r = responses[cmd] ?? [new Error('ENOENT'), '', ''];
    queueMicrotask(() => cb(r[0], r[1], r[2]));
  });
}

describe('detectRuntimes', () => {
  beforeEach(() => {
    execFileMock.mockReset();
  });

  it('returns installed:true with version when both CLIs respond', async () => {
    scenario({
      claude: [null, '2.1.133 (Claude Code)\n', ''],
      codex: [null, 'codex-cli 0.128.0\n', ''],
    });
    const r = await detectRuntimes();
    expect(r.claude.installed).toBe(true);
    expect(r.claude.version).toBe('2.1.133');
    expect(r.codex.installed).toBe(true);
    expect(r.codex.version).toBe('0.128.0');
  });

  it('returns installed:false on ENOENT', async () => {
    scenario({
      claude: [Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }), '', ''],
      codex: [null, '0.128.0\n', ''],
    });
    const r = await detectRuntimes();
    expect(r.claude.installed).toBe(false);
    expect(r.claude.version).toBeNull();
    expect(r.claude.error).toMatch(/ENOENT/);
    expect(r.codex.installed).toBe(true);
  });

  it('handles both missing', async () => {
    scenario({
      claude: [new Error('ENOENT'), '', ''],
      codex: [new Error('ENOENT'), '', ''],
    });
    const r = await detectRuntimes();
    expect(r.claude.installed).toBe(false);
    expect(r.codex.installed).toBe(false);
  });

  it('marks as not installed if output has no semver', async () => {
    scenario({
      claude: [null, 'garbage without version', ''],
      codex: [null, '', 'err'],
    });
    const r = await detectRuntimes();
    expect(r.claude.installed).toBe(false);
    expect(r.claude.error).toMatch(/unexpected/);
    expect(r.codex.installed).toBe(false);
  });
});
