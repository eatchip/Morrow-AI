import { utilityProcess, type UtilityProcess } from 'electron';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import {
  isPtyHostMessage,
  PTY_HOST_PROTOCOL_VERSION,
  type PtyHostMessage,
  type PtyHostRequest,
  type PtyWriteEncoding,
} from './pty-host-protocol';
import { mergedRuntimeEnv } from './runtime-env';

interface PendingResponse {
  resolve: (value: Extract<PtyHostMessage, { type: 'response' }>) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

type Unsubscribe = () => void;

const READY_TIMEOUT_MS = 5_000;
const SPAWN_TIMEOUT_MS = 10_000;

export interface PtySpawnOptions {
  sessionId: string;
  command: string;
  args: string[];
  cwd: string;
  env?: NodeJS.ProcessEnv;
  cols: number;
  rows: number;
}

function sanitizedEnv(env?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const next = mergedRuntimeEnv(env);
  delete next['NO_COLOR'];
  delete next['NODE_DISABLE_COLORS'];
  return next;
}

export class PtySupervisor {
  private child: UtilityProcess | null = null;
  private ready: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private readyTimer: NodeJS.Timeout | null = null;
  private readonly pending = new Map<string, PendingResponse>();
  private readonly activeSessions = new Set<string>();
  private readonly dataListeners = new Set<(event: { sessionId: string; data: string }) => void>();
  private readonly exitListeners = new Set<
    (event: { sessionId: string; exitCode: number }) => void
  >();
  private disposed = false;

  onData(listener: (event: { sessionId: string; data: string }) => void): Unsubscribe {
    this.dataListeners.add(listener);
    return () => this.dataListeners.delete(listener);
  }

  onExit(listener: (event: { sessionId: string; exitCode: number }) => void): Unsubscribe {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  private hostPath(): string {
    return join(__dirname, 'ptyHost.js');
  }

  private start(): void {
    const child = utilityProcess.fork(this.hostPath(), [], {
      stdio: 'pipe',
      serviceName: 'Morrow PTY Host',
    });
    this.child = child;
    this.ready = new Promise((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });
    this.readyTimer = setTimeout(() => {
      this.rejectReady?.(new Error('[pty-host] ready timeout'));
      child.kill();
      this.child = null;
      this.ready = null;
    }, READY_TIMEOUT_MS);

    child.on('message', (raw) => {
      if (!isPtyHostMessage(raw)) return;
      this.handleMessage(raw);
    });
    child.on('exit', (code) => {
      if (this.disposed || this.child !== child) return;
      this.handleExit(code);
    });
  }

  private handleMessage(message: PtyHostMessage): void {
    if (message.type === 'ready') {
      if (message.protocolVersion !== PTY_HOST_PROTOCOL_VERSION) {
        this.rejectReady?.(new Error('[pty-host] protocol mismatch'));
        this.child?.kill();
        return;
      }
      if (this.readyTimer) clearTimeout(this.readyTimer);
      this.readyTimer = null;
      this.resolveReady?.();
      this.resolveReady = null;
      this.rejectReady = null;
      return;
    }

    if (message.type === 'response') {
      const pending = this.pending.get(message.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      pending.resolve(message);
      return;
    }

    if (message.type === 'data') {
      for (const listener of this.dataListeners) listener(message);
      return;
    }

    if (message.type === 'exit') {
      this.activeSessions.delete(message.sessionId);
      for (const listener of this.exitListeners) listener(message);
    }
  }

  private handleExit(code: number): void {
    const err = new Error(`[pty-host] exited with code ${code}`);
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(err);
    }
    this.pending.clear();
    for (const sessionId of this.activeSessions) {
      for (const listener of this.exitListeners) listener({ sessionId, exitCode: code });
    }
    this.activeSessions.clear();
    this.child = null;
    this.ready = null;
    this.rejectReady?.(err);
    this.resolveReady = null;
    this.rejectReady = null;
  }

  private async ensureReady(): Promise<void> {
    if (this.disposed) throw new Error('[pty-host] supervisor disposed');
    if (!this.child || !this.ready) this.start();
    if (!this.ready) throw new Error('[pty-host] missing ready promise');
    await this.ready;
  }

  async spawn(options: PtySpawnOptions): Promise<{ sessionId: string }> {
    await this.ensureReady();
    const child = this.child;
    if (!child) throw new Error('[pty-host] missing process');
    const requestId = randomUUID();
    const responsePromise = new Promise<Extract<PtyHostMessage, { type: 'response' }>>(
      (resolve, reject) => {
        const timer = setTimeout(() => {
          this.pending.delete(requestId);
          reject(new Error('[pty-host] spawn timeout'));
        }, SPAWN_TIMEOUT_MS);
        this.pending.set(requestId, { resolve, reject, timer });
      },
    );
    /* oxlint-disable unicorn/require-post-message-target-origin -- Electron utilityProcess port, not Window.postMessage. */
    child.postMessage({
      type: 'spawn',
      requestId,
      sessionId: options.sessionId,
      command: options.command,
      args: options.args,
      cwd: options.cwd,
      env: sanitizedEnv(options.env),
      cols: options.cols,
      rows: options.rows,
    } satisfies PtyHostRequest);
    /* oxlint-enable unicorn/require-post-message-target-origin */
    const response = await responsePromise;
    if (!response.ok) {
      throw new Error(`[pty-host] spawn failed: ${response.error.message}`);
    }
    this.activeSessions.add(options.sessionId);
    return { sessionId: options.sessionId };
  }

  write(sessionId: string, data: string, encoding: PtyWriteEncoding = 'utf8'): void {
    this.child?.postMessage({ type: 'write', sessionId, data, encoding } satisfies PtyHostRequest);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.child?.postMessage({ type: 'resize', sessionId, cols, rows } satisfies PtyHostRequest);
  }

  kill(sessionId: string): void {
    this.activeSessions.delete(sessionId);
    this.child?.postMessage({ type: 'kill', sessionId } satisfies PtyHostRequest);
  }

  dispose(): void {
    this.disposed = true;
    if (this.readyTimer) clearTimeout(this.readyTimer);
    for (const [, pending] of this.pending) {
      clearTimeout(pending.timer);
      pending.reject(new Error('[pty-host] supervisor disposed'));
    }
    this.pending.clear();
    this.activeSessions.clear();
    try {
      this.child?.postMessage({ type: 'shutdown' } satisfies PtyHostRequest);
      this.child?.kill();
    } catch {
      // ignore
    }
    this.child = null;
    this.ready = null;
  }
}
