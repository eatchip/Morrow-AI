// @vitest-environment node
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 契约：runtime-session.startSession 把 args.cwd 透传给 child_process.spawn。
 * `cwd` 必填（无项目场景由 caller 注入隔离目录），不允许子进程继承主进程 cwd。
 * 通过 vi.mock('node:child_process') 劫持 spawn，断言 options.cwd。
 * 必须在 node 环境运行（happy-dom 会拦截 node:child_process 导致 mock 异常）。
 */

function makeFakeChild() {
  const emitter = new EventEmitter() as EventEmitter & {
    stdin: { write: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> };
    stdout: Readable;
    stderr: Readable;
    kill: ReturnType<typeof vi.fn>;
  };
  emitter.stdin = { write: vi.fn(), end: vi.fn() };
  emitter.stdout = Readable.from([]);
  emitter.stderr = Readable.from([]);
  emitter.kill = vi.fn();
  return emitter;
}

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: spawnMock };
});

describe('startSession cwd contract', () => {
  beforeEach(() => {
    spawnMock.mockReset();
    spawnMock.mockImplementation(() => makeFakeChild());
  });

  it('传入项目 cwd 时透传到 spawn options', async () => {
    const { startSession } = await import('../../src/app/main/runtime-session');
    startSession(
      {
        runtime: 'codex',
        prompt: 'hi',
        sessionId: 's1',
        cwd: '/tmp/some-project',
      },
      () => {},
    );
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [, , options] = spawnMock.mock.calls[0]!;
    expect((options as { cwd?: string }).cwd).toBe('/tmp/some-project');
  });

  it('传入"无项目隔离 cwd"时同样透传（不回退到继承主进程 cwd）', async () => {
    const { startSession } = await import('../../src/app/main/runtime-session');
    startSession(
      {
        runtime: 'codex',
        prompt: 'hi',
        sessionId: 's2',
        cwd: '/var/folders/morrow-test/no-project-cwd',
      },
      () => {},
    );
    const [, , options] = spawnMock.mock.calls[0]!;
    expect((options as { cwd?: string }).cwd).toBe('/var/folders/morrow-test/no-project-cwd');
  });
});
