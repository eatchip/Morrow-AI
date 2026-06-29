import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { PassThrough as PassThroughType } from 'node:stream';

// 我们要 mock node:child_process.spawn 以注入受控的 stdio。
// 注意：codex-mcp.ts 在模块加载时即 import spawn；在 import 它之前必须先 vi.mock。
// 使用 vi.hoisted 让 spawned 数组与 mock 工厂一起提升，避免 TDZ。
const hoisted = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { EventEmitter } = require('node:events') as typeof import('node:events');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { PassThrough } = require('node:stream') as typeof import('node:stream');
  class FakeChildImpl extends EventEmitter {
    stdin = new PassThrough();
    stdout = new PassThrough();
    stderr = new PassThrough();
    killed = false;
    kill(_sig?: string): boolean {
      this.killed = true;
      return true;
    }
  }
  const spawned: Array<{
    stdin: PassThroughType;
    stdout: PassThroughType;
    stderr: PassThroughType;
    child: FakeChildImpl;
  }> = [];
  return { spawned, FakeChild: FakeChildImpl };
});
const spawned = hoisted.spawned;

vi.mock('node:child_process', () => {
  const spawn = vi.fn(() => {
    const c = new hoisted.FakeChild();
    spawned.push({ stdin: c.stdin, stdout: c.stdout, stderr: c.stderr, child: c });
    return c;
  });
  return { spawn, default: { spawn } };
});

// 在 mock 生效后再 import 被测对象。
// 通过 dynamic import 保证顺序。
let mod: typeof import('../../src/app/main/codex-mcp');

beforeEach(async () => {
  spawned.length = 0;
  vi.resetModules();
  mod = await import('../../src/app/main/codex-mcp');
});

afterEach(() => {
  mod.closeAllCodex();
});

/** 收集 stdin 写入的 JSON-RPC 帧（每行一条）。 */
function collectFrames(stream: PassThroughType): unknown[] {
  const out: unknown[] = [];
  let buf = '';
  stream.on('data', (chunk: Buffer) => {
    buf += chunk.toString('utf8');
    let idx = buf.indexOf('\n');
    while (idx !== -1) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      if (line) out.push(JSON.parse(line));
      idx = buf.indexOf('\n');
    }
  });
  return out;
}

function pushLine(stream: PassThroughType, obj: unknown): void {
  stream.write(JSON.stringify(obj) + '\n');
}

async function tick(): Promise<void> {
  // 让 readline + Promise 回调跑一轮
  await new Promise((r) => setImmediate(r));
}

describe('codex-mcp client', () => {
  it('handshake: initialize + tools/list with codex tools → ready', async () => {
    const events: import('../../src/shared/ipc').StreamEvent[] = [];
    const promise = mod.startCodexSession(
      { cwd: null, sessionId: 's1', prompt: 'hi', conversationId: 'c1' },
      (e) => events.push(e),
    );
    await tick();
    expect(spawned).toHaveLength(1);
    const frames = collectFrames(spawned[0]!.stdin);
    await tick();
    // 第 1 帧：initialize
    expect((frames[0] as { method?: string })?.method).toBe('initialize');
    pushLine(spawned[0]!.stdout, { jsonrpc: '2.0', id: 1, result: { capabilities: {} } });
    await tick();
    // 第 2 帧：notifications/initialized
    expect((frames[1] as { method?: string })?.method).toBe('notifications/initialized');
    // 第 3 帧：tools/list
    expect((frames[2] as { method?: string })?.method).toBe('tools/list');
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: 2,
      result: { tools: [{ name: 'codex' }, { name: 'codex-reply' }] },
    });
    await tick();
    await tick();
    // 第 4 帧：tools/call codex
    const callFrame = frames[3] as {
      id?: number;
      method?: string;
      params?: { name?: string; arguments?: Record<string, unknown> };
    };
    expect(callFrame.method).toBe('tools/call');
    expect(callFrame.params?.name).toBe('codex');
    expect(callFrame.params?.arguments?.['prompt']).toBe('hi');
    // 模拟 token-level delta
    const reqId = callFrame.id!;
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      method: 'codex/event',
      params: {
        _meta: { requestId: reqId },
        msg: { type: 'agent_message_content_delta', delta: 'Hel' },
      },
    });
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      method: 'codex/event',
      params: {
        _meta: { requestId: reqId },
        msg: { type: 'agent_message_delta', delta: 'lo' },
      },
    });
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: reqId,
      result: { structuredContent: { threadId: 't_x', content: 'Hello' } },
    });
    await tick();
    await promise;
    expect(events).toEqual([
      { sessionId: 's1', kind: 'chunk', text: 'Hel' },
      { sessionId: 's1', kind: 'chunk', text: 'lo' },
      { sessionId: 's1', kind: 'done', exitCode: 0 },
    ]);
  });

  it('tools/list missing required tools → throws McpUnsupportedError', async () => {
    let caught: unknown = null;
    const start = mod
      .startCodexSession({ cwd: null, sessionId: 's2', prompt: 'hi' }, () => {})
      .catch((e) => {
        caught = e;
      });
    await tick();
    pushLine(spawned[0]!.stdout, { jsonrpc: '2.0', id: 1, result: {} });
    await tick();
    pushLine(spawned[0]!.stdout, { jsonrpc: '2.0', id: 2, result: { tools: [] } });
    await tick();
    await start;
    expect(caught).toBeInstanceOf(mod.McpUnsupportedError);
  });

  it('passes codex model and effort into first MCP call', async () => {
    const promise = mod.startCodexSession(
      {
        cwd: '/tmp/project',
        sessionId: 's-model',
        prompt: 'hi',
        conversationId: 'c-model',
        model: 'gpt-5.5',
        effort: 'xhigh',
      },
      () => {},
    );
    await tick();
    const frames = collectFrames(spawned[0]!.stdin);
    pushLine(spawned[0]!.stdout, { jsonrpc: '2.0', id: 1, result: { capabilities: {} } });
    await tick();
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: 2,
      result: { tools: [{ name: 'codex' }, { name: 'codex-reply' }] },
    });
    await tick();
    await tick();

    const callFrame = frames[3] as {
      id?: number;
      params?: { arguments?: Record<string, unknown> };
    };
    expect(callFrame.params?.arguments).toMatchObject({
      prompt: 'hi',
      cwd: '/tmp/project',
      sandbox: 'read-only',
      model: 'gpt-5.5',
      config: { model_reasoning_effort: 'xhigh' },
    });
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: callFrame.id!,
      result: { structuredContent: { threadId: 't_model', content: 'ok' } },
    });
    await promise;
  });

  it('falls back to structuredContent.content when no delta event arrives', async () => {
    const events: import('../../src/shared/ipc').StreamEvent[] = [];
    const promise = mod.startCodexSession({ cwd: null, sessionId: 's-final', prompt: 'hi' }, (e) =>
      events.push(e),
    );
    await tick();
    const frames = collectFrames(spawned[0]!.stdin);
    pushLine(spawned[0]!.stdout, { jsonrpc: '2.0', id: 1, result: { capabilities: {} } });
    await tick();
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: 2,
      result: { tools: [{ name: 'codex' }, { name: 'codex-reply' }] },
    });
    await tick();
    await tick();
    const callFrame = frames[3] as { id?: number };
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: callFrame.id!,
      result: { structuredContent: { threadId: 't_final', content: 'final answer' } },
    });
    await tick();
    await promise;
    expect(events).toEqual([
      { sessionId: 's-final', kind: 'chunk', text: 'final answer' },
      { sessionId: 's-final', kind: 'done', exitCode: 0 },
    ]);
  });

  it('surfaces tools/call isError result as error instead of done', async () => {
    const events: import('../../src/shared/ipc').StreamEvent[] = [];
    const promise = mod.startCodexSession(
      { cwd: null, sessionId: 's-error-result', prompt: 'hi' },
      (e) => events.push(e),
    );
    await tick();
    const frames = collectFrames(spawned[0]!.stdin);
    pushLine(spawned[0]!.stdout, { jsonrpc: '2.0', id: 1, result: { capabilities: {} } });
    await tick();
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: 2,
      result: { tools: [{ name: 'codex' }, { name: 'codex-reply' }] },
    });
    await tick();
    await tick();
    const callFrame = frames[3] as { id?: number };
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: callFrame.id!,
      result: {
        isError: true,
        structuredContent: { threadId: 't_err', content: 'rate limited' },
      },
    });
    await tick();
    await promise;
    expect(events).toEqual([
      { sessionId: 's-error-result', kind: 'error', message: 'rate limited' },
    ]);
  });

  it('child crash → emits error to in-flight session', async () => {
    const events: import('../../src/shared/ipc').StreamEvent[] = [];
    const p = mod.startCodexSession({ cwd: null, sessionId: 's3', prompt: 'hi' }, (e) =>
      events.push(e),
    );
    await tick();
    pushLine(spawned[0]!.stdout, { jsonrpc: '2.0', id: 1, result: {} });
    await tick();
    pushLine(spawned[0]!.stdout, {
      jsonrpc: '2.0',
      id: 2,
      result: { tools: [{ name: 'codex' }, { name: 'codex-reply' }] },
    });
    await tick();
    await tick();
    // 现在 tools/call 在飞 → 模拟子进程崩溃
    spawned[0]!.stderr.write('panic: boom');
    spawned[0]!.child.emit('exit');
    await tick();
    await p;
    const errEvent = events.find((e) => e.kind === 'error');
    expect(errEvent).toBeTruthy();
    expect((errEvent as { message: string }).message).toMatch(/codex mcp-server died/);
  });
});
