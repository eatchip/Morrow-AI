/**
 * Codex MCP 进程池 + Session 桥接。
 *
 * MCP 是 Codex 的主会话通道：主时间线只消费这里发出的结构化 StreamEvent。
 * PTY/TUI 输出不得作为聊天正文来源，只能作为诊断或显式终端视图。
 */
import type { EffortLevel, StreamEvent } from '../../shared/ipc';
import { McpClient, McpUnsupportedError, type SessionBinding } from './codex-mcp-client';

const IDLE_REAP_MS = 5 * 60 * 1000;
const REAP_INTERVAL_MS = 60 * 1000;

export interface StartCodexArgs {
  cwd?: string | null;
  sessionId: string;
  prompt: string;
  /** 上层会话 id；用于 thread 复用。缺省视为新 thread。 */
  conversationId?: string | null;
  model?: string;
  effort?: EffortLevel;
}

type Emit = (e: StreamEvent) => void;

class McpPool {
  private readonly clients = new Map<string, McpClient>();
  /** threadKey (`cwd|conversationId`) -> threadId */
  private readonly threads = new Map<string, string>();
  /** sessionId -> 取消句柄 */
  private readonly cancels = new Map<string, () => void>();
  private reaper: NodeJS.Timeout | null = null;
  /** 工具是否被发现缺失：缺失时 ensure() 永久抛，让上层 fallback。 */
  private unsupported = false;

  async ensure(cwd: string | null): Promise<McpClient> {
    if (this.unsupported) throw new McpUnsupportedError('codex mcp tools missing');
    const key = cwd ?? '__nocwd__';
    let client = this.clients.get(key);
    if (client && !client.isAlive()) {
      this.clients.delete(key);
      client = undefined;
    }
    if (!client) {
      client = new McpClient(cwd);
      this.clients.set(key, client);
      try {
        await client.start();
      } catch (err) {
        this.clients.delete(key);
        if (err instanceof McpUnsupportedError) this.unsupported = true;
        throw err;
      }
      this.startReaper();
    }
    client.lastUsedAt = Date.now();
    return client;
  }

  threadKey(cwd: string | null, conversationId: string | null | undefined): string {
    return `${cwd ?? '__nocwd__'}|${conversationId ?? '__noconv__'}`;
  }

  getThread(key: string): string | undefined {
    return this.threads.get(key);
  }

  setThread(key: string, threadId: string): void {
    this.threads.set(key, threadId);
  }

  registerCancel(sessionId: string, cancel: () => void): void {
    this.cancels.set(sessionId, cancel);
  }

  fireCancel(sessionId: string): void {
    const c = this.cancels.get(sessionId);
    if (c) {
      c();
      this.cancels.delete(sessionId);
    }
  }

  releaseSession(sessionId: string): void {
    this.cancels.delete(sessionId);
  }

  closeAll(): void {
    if (this.reaper) {
      clearInterval(this.reaper);
      this.reaper = null;
    }
    for (const [, c] of this.clients) c.close();
    this.clients.clear();
    this.threads.clear();
    this.cancels.clear();
  }

  private startReaper(): void {
    if (this.reaper) return;
    this.reaper = setInterval(() => {
      const now = Date.now();
      for (const [k, c] of this.clients) {
        if (now - c.lastUsedAt > IDLE_REAP_MS) {
          c.close();
          this.clients.delete(k);
        }
      }
      if (this.clients.size === 0 && this.reaper) {
        clearInterval(this.reaper);
        this.reaper = null;
      }
    }, REAP_INTERVAL_MS);
    this.reaper.unref?.();
  }
}

const pool = new McpPool();

/**
 * 发起一次 codex MCP 会话。失败（含 McpUnsupportedError）会通过 emit 报 error 事件，
 * 并以 throw 形式让调用方决定是否 fallback 到旧 exec 路径。
 */
export async function startCodexSession(args: StartCodexArgs, emit: Emit): Promise<void> {
  if (!args.prompt || typeof args.prompt !== 'string') {
    emit({ sessionId: args.sessionId, kind: 'error', message: 'prompt is required' });
    return;
  }
  if (!args.sessionId || typeof args.sessionId !== 'string') {
    emit({ sessionId: args.sessionId, kind: 'error', message: 'sessionId is required' });
    return;
  }

  let client: McpClient;
  try {
    client = await pool.ensure(args.cwd ?? null);
  } catch (err) {
    if (err instanceof McpUnsupportedError) throw err;
    emit({
      sessionId: args.sessionId,
      kind: 'error',
      message: `codex mcp-server failed to start: ${(err as Error).message}`,
    });
    return;
  }

  const threadKey = pool.threadKey(args.cwd ?? null, args.conversationId);
  const cachedThreadId = pool.getThread(threadKey);
  const tool = cachedThreadId ? 'codex-reply' : 'codex';
  const toolArgs: Record<string, unknown> = { prompt: args.prompt };
  if (tool === 'codex') {
    if (args.cwd) toolArgs['cwd'] = args.cwd;
    toolArgs['sandbox'] = 'read-only';
    if (args.model) toolArgs['model'] = args.model;
    if (args.effort) toolArgs['config'] = { model_reasoning_effort: args.effort };
  } else {
    toolArgs['threadId'] = cachedThreadId;
  }

  const binding: SessionBinding = {
    sessionId: args.sessionId,
    threadKey,
    emit,
    emittedDone: false,
    emittedText: false,
  };
  const { requestId, promise } = client.callCodex({ tool, toolArgs }, binding);
  pool.registerCancel(args.sessionId, () => client.cancelRequest(requestId));
  try {
    const r = await promise;
    if (r.threadId) pool.setThread(threadKey, r.threadId);
  } catch {
    // 错误已在 client 路径 emit，这里只清理。
  } finally {
    pool.releaseSession(args.sessionId);
  }
}

export function abortCodexSession(sessionId: string): void {
  pool.fireCancel(sessionId);
}

export function closeAllCodex(): void {
  pool.closeAll();
}

export { McpUnsupportedError };
