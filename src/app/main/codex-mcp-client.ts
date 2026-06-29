import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from 'node:child_process';
import { createInterface, type Interface as RlInterface } from 'node:readline';
import type { StreamEvent } from '../../shared/ipc';
import { sanitizedRuntimeEnv } from './runtime-env';

const MAX_LINE_BYTES = 1_000_000;
const INITIALIZE_TIMEOUT_MS = 5_000;
const TOOL_CALL_TIMEOUT_MS = 180_000;

type Emit = (e: StreamEvent) => void;

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (err: Error) => void;
}

export interface SessionBinding {
  sessionId: string;
  threadKey: string | null;
  emit: Emit;
  emittedDone: boolean;
  emittedText: boolean;
}

export class McpUnsupportedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'McpUnsupportedError';
  }
}

export class McpClient {
  private child: ChildProcessWithoutNullStreams | null = null;
  private rl: RlInterface | null = null;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  /** request_id -> sessionBinding：codex/event 通知按 `_meta.requestId` 找回 session。 */
  private readonly bindings = new Map<number, SessionBinding>();
  private stderrTail = '';
  private dying = false;
  lastUsedAt = Date.now();

  constructor(public readonly cwd: string | null) {}

  isAlive(): boolean {
    return !!this.child && !this.dying;
  }

  async start(): Promise<void> {
    if (this.child) return;
    const opts: SpawnOptionsWithoutStdio = { env: sanitizedRuntimeEnv(), shell: false };
    if (this.cwd) opts.cwd = this.cwd;
    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn('codex', ['mcp-server'], opts);
    } catch (err) {
      throw new Error(`spawn codex mcp-server failed: ${(err as Error).message}`, { cause: err });
    }
    this.child = child;
    this.rl = createInterface({ input: child.stdout });
    this.rl.on('line', (line) => this.onLine(line));
    child.stderr.on('data', (buf: Buffer) => {
      this.stderrTail = (this.stderrTail + buf.toString('utf8')).slice(-10_000);
    });
    child.on('error', () => this.die());
    child.on('exit', () => this.die());

    await this.requestWithTimeout(
      'initialize',
      {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'morrow', version: '0.1' },
      },
      INITIALIZE_TIMEOUT_MS,
    );
    this.notify('notifications/initialized');

    const tools = (await this.requestWithTimeout('tools/list', {}, INITIALIZE_TIMEOUT_MS)) as {
      tools?: Array<{ name?: string }>;
    };
    const names = new Set((tools.tools ?? []).map((t) => t.name));
    if (!names.has('codex') || !names.has('codex-reply')) {
      this.die();
      throw new McpUnsupportedError('codex mcp-server missing required tools');
    }
  }

  callCodex(
    args: { tool: 'codex' | 'codex-reply'; toolArgs: Record<string, unknown> },
    sessionBinding: SessionBinding,
  ): { requestId: number; promise: Promise<{ threadId?: string }> } {
    const id = this.nextId++;
    this.bindings.set(id, sessionBinding);
    const promise = new Promise<unknown>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        const binding = this.bindings.get(id);
        if (binding && !binding.emittedDone) {
          binding.emittedDone = true;
          binding.emit({
            sessionId: binding.sessionId,
            kind: 'error',
            message: 'codex 长时间没有返回结果，已停止等待。',
          });
        }
        this.bindings.delete(id);
        reject(new Error('codex mcp tools/call timed out'));
      }, TOOL_CALL_TIMEOUT_MS);
      timeout.unref?.();
      this.pending.set(id, { resolve, reject });
      const pending = this.pending.get(id)!;
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timeout);
          pending.resolve(value);
        },
        reject: (error) => {
          clearTimeout(timeout);
          pending.reject(error);
        },
      });
      this.send({
        jsonrpc: '2.0',
        id,
        method: 'tools/call',
        params: { name: args.tool, arguments: args.toolArgs },
      });
    }).then((result) => {
      const r = result as {
        structuredContent?: { threadId?: string; content?: string };
        content?: Array<{ type?: string; text?: string }>;
        isError?: boolean;
      };
      return {
        threadId: r.structuredContent?.threadId,
        content: extractToolResponseText(r),
        isError: r.isError === true,
      };
    });
    return { requestId: id, promise };
  }

  cancelRequest(requestId: number): void {
    if (!this.bindings.has(requestId)) return;
    this.notify('notifications/cancelled', { requestId, reason: 'user_cancel' });
  }

  close(): void {
    this.die();
  }

  private die(): void {
    if (this.dying) return;
    this.dying = true;
    for (const [, b] of this.bindings) {
      if (!b.emittedDone) {
        b.emittedDone = true;
        b.emit({
          sessionId: b.sessionId,
          kind: 'error',
          message: `codex mcp-server died: ${this.stderrTail.trim().slice(-300)}`,
        });
      }
    }
    this.bindings.clear();
    for (const [, p] of this.pending) p.reject(new Error('mcp client closed'));
    this.pending.clear();
    try {
      this.child?.kill('SIGTERM');
    } catch {
      // already gone
    }
    this.child = null;
    this.rl?.close();
    this.rl = null;
  }

  private send(payload: unknown): void {
    if (!this.child || this.dying) return;
    try {
      this.child.stdin.write(JSON.stringify(payload) + '\n');
    } catch {
      this.die();
    }
  }

  private notify(method: string, params?: unknown): void {
    this.send({ jsonrpc: '2.0', method, ...(params !== undefined ? { params } : {}) });
  }

  private requestWithTimeout(method: string, params: unknown, timeoutMs: number): Promise<unknown> {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`mcp ${method} timed out`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(t);
          resolve(v);
        },
        reject: (e) => {
          clearTimeout(t);
          reject(e);
        },
      });
      this.send({ jsonrpc: '2.0', id, method, params });
    });
  }

  private onLine(line: string): void {
    if (line.length === 0 || line.length > MAX_LINE_BYTES) return;
    let msg: unknown;
    try {
      msg = JSON.parse(line);
    } catch {
      return;
    }
    if (typeof msg !== 'object' || msg === null) return;
    const m = msg as Record<string, unknown>;
    if (typeof m['id'] === 'number' && (m['result'] !== undefined || m['error'] !== undefined)) {
      this.handleResponse(m);
      return;
    }
    if (m['method'] === 'codex/event') {
      this.handleCodexEvent(m['params']);
    }
  }

  private handleResponse(message: Record<string, unknown>): void {
    const id = message['id'] as number;
    const p = this.pending.get(id);
    if (!p) return;
    this.pending.delete(id);
    const binding = this.bindings.get(id);
    if (message['error']) {
      const err = message['error'] as { message?: string };
      if (binding && !binding.emittedDone) {
        binding.emittedDone = true;
        binding.emit({
          sessionId: binding.sessionId,
          kind: 'error',
          message: err.message ?? 'codex mcp error',
        });
      }
      this.bindings.delete(id);
      p.reject(new Error(err.message ?? 'codex mcp error'));
      return;
    }

    const result = message['result'] as
      | {
          structuredContent?: { content?: string };
          content?: Array<{ type?: string; text?: string }>;
          isError?: boolean;
        }
      | undefined;
    const finalText = result ? extractToolResponseText(result) : '';
    if (binding && result?.isError === true) {
      binding.emittedDone = true;
      binding.emit({
        sessionId: binding.sessionId,
        kind: 'error',
        message: finalText || 'codex mcp error',
      });
      this.bindings.delete(id);
      p.reject(new Error(finalText || 'codex mcp error'));
      return;
    }
    if (binding && !binding.emittedDone) {
      if (!binding.emittedText && finalText.length > 0) {
        binding.emittedText = true;
        binding.emit({ sessionId: binding.sessionId, kind: 'chunk', text: finalText });
      }
      binding.emittedDone = true;
      binding.emit({ sessionId: binding.sessionId, kind: 'done', exitCode: 0 });
    }
    this.bindings.delete(id);
    p.resolve(message['result']);
  }

  private handleCodexEvent(params: unknown): void {
    if (typeof params !== 'object' || params === null) return;
    const p = params as Record<string, unknown>;
    const meta = p['_meta'] as { requestId?: number } | undefined;
    const reqId = meta?.requestId;
    if (typeof reqId !== 'number') return;
    const binding = this.bindings.get(reqId);
    if (!binding || binding.emittedDone) return;
    const msg = p['msg'] as
      | {
          type?: string;
          delta?: unknown;
          message?: unknown;
          item?: unknown;
        }
      | undefined;
    if (!msg) return;
    if (
      (msg.type === 'agent_message_delta' || msg.type === 'agent_message_content_delta') &&
      typeof msg.delta === 'string'
    ) {
      binding.emittedText = true;
      binding.emit({ sessionId: binding.sessionId, kind: 'chunk', text: msg.delta });
      return;
    }
    if (msg.type === 'agent_message' && typeof msg.message === 'string') {
      if (!binding.emittedText) {
        binding.emittedText = true;
        binding.emit({ sessionId: binding.sessionId, kind: 'chunk', text: msg.message });
      }
      return;
    }
    if (msg.type === 'item_completed') {
      const text = extractAgentMessageItemText(msg.item);
      if (!binding.emittedText && text.length > 0) {
        binding.emittedText = true;
        binding.emit({ sessionId: binding.sessionId, kind: 'chunk', text });
      }
      return;
    }
    if (msg.type === 'error') {
      binding.emittedDone = true;
      binding.emit({
        sessionId: binding.sessionId,
        kind: 'error',
        message: String(msg.message ?? 'codex error').slice(0, 500),
      });
      this.bindings.delete(reqId);
    }
  }
}

function extractToolResponseText(result: {
  structuredContent?: { content?: string };
  content?: Array<{ type?: string; text?: string }>;
}): string {
  const structured = result.structuredContent?.content;
  if (typeof structured === 'string' && structured.length > 0) return structured;
  return (result.content ?? [])
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text ?? '')
    .join('');
}

function extractAgentMessageItemText(item: unknown): string {
  if (typeof item !== 'object' || item === null) return '';
  const obj = item as Record<string, unknown>;
  if (obj['type'] !== 'AgentMessage') return '';
  if (typeof obj['text'] === 'string') return obj['text'];
  const content = obj['content'];
  if (!Array.isArray(content)) return '';
  return content
    .map((entry) => {
      if (typeof entry !== 'object' || entry === null) return '';
      const e = entry as Record<string, unknown>;
      return typeof e['text'] === 'string' ? e['text'] : '';
    })
    .join('');
}
