import {
  spawn,
  type ChildProcessWithoutNullStreams,
  type SpawnOptionsWithoutStdio,
} from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline';
import type { EffortLevel, RuntimeId, SendPromptArgs, StreamEvent } from '../../shared/ipc';
import {
  abortCodexSession as abortCodexMcpSession,
  closeAllCodex,
  McpUnsupportedError,
  startCodexSession,
} from './codex-mcp';
import { sanitizedRuntimeEnv } from './runtime-env';

/**
 * 主进程内部启动会话参数。与 IPC 边界类型 `SendPromptArgs` 区别：
 *  - IPC 仅接受 `projectId`（防 renderer 传任意 cwd 逃逸）；
 *  - 主进程在 ipc handler 里把 `projectId` 解析为 `cwd` 后调用本函数。
 *
 * `cwd` 必填：未选择项目的会话也必须由 caller 显式传入一个隔离的"无项目"目录，
 * 杜绝子进程继承 Electron 主进程 cwd（开发态 = 仓库根，打包态 = `/`）导致的
 * 隐式项目泄漏（如 Codex 自动加载该目录的 AGENTS.md）。
 */
export type StartSessionArgs = Omit<SendPromptArgs, 'projectId'> & {
  cwd: string;
};

const MAX_LINE_BYTES = 1_000_000; // 1MB 单行上限，防恶意输出把渲染层卡死

interface Session {
  child: ChildProcessWithoutNullStreams;
  stderrBuf: string;
  done: boolean;
}

const sessions = new Map<string, Session>();

type Emit = (e: StreamEvent) => void;

/**
 * 根据 runtime 和可选 model/effort 构造 CLI 调用参数。
 *
 * 命令注入防线：`model` / `effort` 均作为**独立 argv 元素**传入（spawn 默认 `shell: false`），
 * 从不拼入字符串。IPC 边界已用 `MODEL_ID_REGEX` 白名单 + `EFFORT_LEVELS` 枚举校验过。
 *
 * Effort 仅对 codex runtime 生效：codex 通过 `-c model_reasoning_effort=<level>` 配置 override；
 * claude 目前没有对齐的单一开关，故忽略。
 */
export function buildCmd(
  runtime: RuntimeId,
  prompt: string,
  opts: { model?: string; effort?: EffortLevel } = {},
): {
  bin: string;
  args: string[];
  stdin: string | null;
} {
  if (runtime === 'claude') {
    const args: string[] = [];
    if (opts.model) args.push('--model', opts.model);
    args.push(
      '-p',
      prompt,
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
    );
    return { bin: 'claude', args, stdin: null };
  }
  // codex
  const args: string[] = ['exec'];
  if (opts.model) args.push('--model', opts.model);
  if (opts.effort) args.push('-c', `model_reasoning_effort=${opts.effort}`);
  args.push('--json', '--skip-git-repo-check', '-');
  return { bin: 'codex', args, stdin: prompt };
}

export function parseClaudeLine(line: string): string | null {
  try {
    const e = JSON.parse(line);
    if (e.type === 'assistant' && Array.isArray(e.message?.content)) {
      return e.message.content
        .filter((c: { type?: string }) => c?.type === 'text')
        .map((c: { text?: string }) => c.text ?? '')
        .join('');
    }
    if (e.type === 'result' && e.is_error) {
      return `\n[error] ${String(e.result ?? '').slice(0, 500)}`;
    }
    return null;
  } catch {
    // 裸文本（非 JSON 行）直接透出
    return line;
  }
}

/**
 * 解析 codex-cli `exec --json` 一行 JSONL 事件，提取要透传给渲染层的文本。
 *
 * ⚠️ Fallback-only：SDD `streaming-and-latency` 之后 codex 路径默认走 `codex-mcp.ts`
 * 的 MCP 协议（token-level 流式、会话复用、进程池）。本函数仅在 MCP 不可用
 * （`McpUnsupportedError`，如用户 CLI < `mcp-server` 子命令、或 `tools/list`
 * 缺少 `codex` / `codex-reply` 工具）时由 `startExecSession` 兜底调用。
 * 之后每次 codex-cli schema 变更**优先**修 MCP 适配，再视情况更新本函数。
 *
 * 同时兼容两种 schema：
 *  - 新版 (codex-cli ≥ 0.128)：顶层 `type`，如
 *      {"type":"item.completed","item":{"type":"agent_message","text":"..."}}
 *      {"type":"thread.started" | "turn.started" | "turn.completed", ...}
 *    新版不再输出 `agent_message_delta`，整条消息一次性到达。
 *  - 旧版：{"msg":{"type":"agent_message_delta","delta":"..."}} 等。
 *
 * 未识别事件与非 JSON 行均返回 null。Codex fallback 的 stdout 只允许结构化 JSONL
 * 进入聊天正文，update banner / TUI 提示 / 诊断文本必须留在日志层。
 */
export function parseCodexLine(line: string): string | null {
  let e: unknown;
  try {
    e = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof e !== 'object' || e === null) return null;
  const obj = e as Record<string, unknown>;
  const topType = typeof obj['type'] === 'string' ? (obj['type'] as string) : undefined;

  // 新版 schema: item.completed 封装实际输出
  if (topType === 'item.completed') {
    const item = obj['item'];
    if (typeof item !== 'object' || item === null) return null;
    const it = item as Record<string, unknown>;
    const itemType = typeof it['type'] === 'string' ? (it['type'] as string) : undefined;
    if (itemType === 'agent_message') {
      return typeof it['text'] === 'string' ? (it['text'] as string) : '';
    }
    if (itemType === 'error') {
      const m = (it['message'] ?? it['text'] ?? '') as unknown;
      return `\n[error] ${String(m).slice(0, 500)}`;
    }
    return null;
  }

  // 新版 schema: 生命周期事件静默
  if (topType === 'thread.started' || topType === 'turn.started' || topType === 'turn.completed') {
    return null;
  }

  // 顶层 error（新旧版共用的兜底形态）
  if (topType === 'error') {
    return `\n[error] ${String(obj['message'] ?? '').slice(0, 500)}`;
  }

  // 旧版 schema: msg.type
  const msg = obj['msg'];
  const msgObj = typeof msg === 'object' && msg !== null ? (msg as Record<string, unknown>) : null;
  const mType = (msgObj && typeof msgObj['type'] === 'string' ? msgObj['type'] : topType) as
    | string
    | undefined;
  if (mType === 'agent_message_delta') {
    return String(msgObj?.['delta'] ?? obj['delta'] ?? '');
  }
  if (mType === 'agent_message') return ''; // 旧版被 delta 覆盖
  if (mType === 'error') {
    return `\n[error] ${String(msgObj?.['message'] ?? obj['message'] ?? '').slice(0, 500)}`;
  }
  return null;
}

export function startSession(args: StartSessionArgs, emit: Emit): void {
  // 边界校验
  if (args.runtime !== 'claude' && args.runtime !== 'codex') {
    emit({ sessionId: args.sessionId, kind: 'error', message: `invalid runtime: ${args.runtime}` });
    return;
  }
  if (!args.prompt || typeof args.prompt !== 'string') {
    emit({ sessionId: args.sessionId, kind: 'error', message: 'prompt is required' });
    return;
  }
  if (!args.sessionId || typeof args.sessionId !== 'string') {
    emit({ sessionId: args.sessionId, kind: 'error', message: 'sessionId is required' });
    return;
  }

  // codex 优先走 MCP（流式 + thread 复用）；MCP 工具缺失则 fallback 到 exec。
  if (args.runtime === 'codex') {
    mcpSessions.add(args.sessionId);
    void startCodexSession(
      {
        cwd: args.cwd ?? null,
        sessionId: args.sessionId,
        prompt: args.prompt,
        conversationId: args.conversationId ?? null,
        model: args.model,
        effort: args.effort,
      },
      emit,
    )
      .catch((err) => {
        if (err instanceof McpUnsupportedError) {
          // 退路：用旧 exec 路径
          mcpSessions.delete(args.sessionId);
          startExecSession(args, emit);
          return;
        }
        // 其他错误已由 codex-mcp 内部 emit；这里不重复
      })
      .finally(() => {
        // 自然结束（done/error 已 emit）后回收
        mcpSessions.delete(args.sessionId);
      });
    return;
  }

  startExecSession(args, emit);
}

const mcpSessions = new Set<string>();

function startExecSession(args: StartSessionArgs, emit: Emit): void {
  const {
    bin,
    args: cmdArgs,
    stdin,
  } = buildCmd(args.runtime, args.prompt, {
    model: args.model,
    effort: args.effort,
  });

  let child: ChildProcessWithoutNullStreams;
  try {
    const spawnOptions: SpawnOptionsWithoutStdio = {
      env: sanitizedRuntimeEnv(),
      shell: false,
      cwd: args.cwd,
    };
    child = spawn(bin, cmdArgs, spawnOptions);
  } catch (err) {
    emit({
      sessionId: args.sessionId,
      kind: 'error',
      message: `spawn failed: ${String((err as Error).message ?? err)}`,
    });
    return;
  }

  const session: Session = { child, stderrBuf: '', done: false };
  sessions.set(args.sessionId, session);

  child.on('error', (err) => {
    if (session.done) return;
    session.done = true;
    emit({
      sessionId: args.sessionId,
      kind: 'error',
      message: `${bin} not runnable: ${err.message}`,
    });
    sessions.delete(args.sessionId);
  });

  if (stdin !== null) {
    child.stdin.write(stdin);
  }
  child.stdin.end();

  const rl = createInterface({ input: child.stdout });
  rl.on('line', (line) => {
    if (line.length > MAX_LINE_BYTES) return; // 过长直接丢
    const text = args.runtime === 'claude' ? parseClaudeLine(line) : parseCodexLine(line);
    if (text && text.length > 0) {
      emit({ sessionId: args.sessionId, kind: 'chunk', text });
    }
  });

  child.stderr.on('data', (buf: Buffer) => {
    session.stderrBuf += buf.toString('utf8');
    if (session.stderrBuf.length > 10_000) {
      session.stderrBuf = session.stderrBuf.slice(-10_000);
    }
  });

  child.on('close', (code) => {
    if (session.done) return;
    session.done = true;
    sessions.delete(args.sessionId);
    if (code === 0 || code === null) {
      emit({ sessionId: args.sessionId, kind: 'done', exitCode: code ?? 0 });
    } else {
      emit({
        sessionId: args.sessionId,
        kind: 'error',
        message: `${bin} exited ${code}: ${session.stderrBuf.trim().slice(0, 500)}`,
      });
    }
  });
}

export function abortSession(sessionId: string): void {
  if (mcpSessions.has(sessionId)) {
    mcpSessions.delete(sessionId);
    abortCodexMcpSession(sessionId);
    // MCP 路径下 done/error 由 codex-mcp 自行 emit；不再重发。
    return;
  }
  const s = sessions.get(sessionId);
  if (!s || s.done) return;
  s.done = true;
  sessions.delete(sessionId);
  try {
    s.child.kill('SIGTERM');
  } catch {
    /* already dead */
  }
  setTimeout(() => {
    try {
      s.child.kill('SIGKILL');
    } catch {
      /* ok */
    }
  }, 2000);
}

export function killAll(): void {
  for (const id of mcpSessions) abortCodexMcpSession(id);
  mcpSessions.clear();
  for (const [id] of sessions) abortSession(id);
  closeAllCodex();
}

/** 渲染层未传 sessionId 时的兜底生成器（目前渲染层负责生成；此函数仅作工具导出） */
export function newSessionId(): string {
  return randomUUID();
}
