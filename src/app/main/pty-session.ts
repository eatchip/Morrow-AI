import { randomUUID } from 'node:crypto';
import type {
  EffortLevel,
  PtyDataEvent,
  PtyExitEvent,
  PtySnapshotResult,
  PtyWriteEncoding,
} from '../../shared/ipc';
import { buildCodexPtyCommand } from './pty-agent-command';
import { PtySupervisor } from './pty-supervisor';

const DEFAULT_REPLAY_LIMIT = 1_000_000;

export interface StartCodexPtySessionArgs {
  cwd: string;
  prompt: string;
  model?: string;
  effort?: EffortLevel;
  cols: number;
  rows: number;
}

interface PtySessionState {
  seq: number;
  buffer: string;
  exited: boolean;
  exitCode: number | null;
}

interface PtySupervisorPort {
  onData(listener: (event: { sessionId: string; data: string }) => void): () => void;
  onExit(listener: (event: { sessionId: string; exitCode: number }) => void): () => void;
  spawn(options: {
    sessionId: string;
    command: string;
    args: string[];
    cwd: string;
    cols: number;
    rows: number;
  }): Promise<{ sessionId: string }>;
  write(sessionId: string, data: string, encoding?: PtyWriteEncoding): void;
  resize(sessionId: string, cols: number, rows: number): void;
  kill(sessionId: string): void;
  dispose(): void;
}

export class PtySessionManager {
  private readonly sessions = new Map<string, PtySessionState>();

  constructor(
    private readonly emitData: (event: PtyDataEvent) => void,
    private readonly emitExit: (event: PtyExitEvent) => void,
    private readonly replayLimit = DEFAULT_REPLAY_LIMIT,
    private readonly supervisor: PtySupervisorPort = new PtySupervisor(),
  ) {
    this.supervisor.onData((event) => this.handleData(event.sessionId, event.data));
    this.supervisor.onExit((event) => this.handleExit(event.sessionId, event.exitCode));
  }

  async startCodexAgentSession(args: StartCodexPtySessionArgs): Promise<{ sessionId: string }> {
    const sessionId = randomUUID();
    const command = buildCodexPtyCommand(args);
    this.sessions.set(sessionId, {
      seq: 0,
      buffer: '',
      exited: false,
      exitCode: null,
    });
    try {
      await this.supervisor.spawn({
        sessionId,
        command: command.command,
        args: command.args,
        cwd: args.cwd,
        cols: args.cols,
        rows: args.rows,
      });
      return { sessionId };
    } catch (error) {
      this.sessions.delete(sessionId);
      throw error;
    }
  }

  write(sessionId: string, data: string, encoding: PtyWriteEncoding = 'utf8'): void {
    const state = this.requireSession(sessionId);
    if (state.exited) throw new Error(`pty session exited: ${sessionId}`);
    this.supervisor.write(sessionId, data, encoding);
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const state = this.requireSession(sessionId);
    if (state.exited) return;
    this.supervisor.resize(sessionId, cols, rows);
  }

  kill(sessionId: string): void {
    if (!this.sessions.has(sessionId)) return;
    this.supervisor.kill(sessionId);
    this.sessions.delete(sessionId);
  }

  snapshot(sessionId: string): PtySnapshotResult {
    const state = this.requireSession(sessionId);
    return {
      sessionId,
      seq: state.seq,
      data: state.buffer,
      exited: state.exited,
      exitCode: state.exitCode,
    };
  }

  dispose(): void {
    this.supervisor.dispose();
    this.sessions.clear();
  }

  private handleData(sessionId: string, data: string): void {
    const state = this.sessions.get(sessionId);
    if (!state || state.exited) return;
    state.seq += 1;
    state.buffer += data;
    if (state.buffer.length > this.replayLimit) {
      state.buffer = state.buffer.slice(-this.replayLimit);
    }
    this.emitData({ sessionId, seq: state.seq, data });
  }

  private handleExit(sessionId: string, exitCode: number): void {
    const state = this.sessions.get(sessionId);
    if (!state) return;
    this.handleData(sessionId, `\r\n[process exited ${exitCode}]\r\n`);
    state.exited = true;
    state.exitCode = exitCode;
    this.emitExit({ sessionId, exitCode });
  }

  private requireSession(sessionId: string): PtySessionState {
    const state = this.sessions.get(sessionId);
    if (!state) throw new Error(`unknown pty session: ${sessionId}`);
    return state;
  }
}
