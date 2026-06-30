import { describe, expect, it } from 'vitest';
import type { PtyDataEvent, PtyExitEvent, PtyWriteEncoding } from '../../src/shared/ipc';
import { PtySessionManager } from '../../src/app/main/pty-session';

class FakeSupervisor {
  dataListener: ((event: { sessionId: string; data: string }) => void) | null = null;
  exitListener: ((event: { sessionId: string; exitCode: number }) => void) | null = null;
  spawnOptions: unknown[] = [];
  writes: unknown[] = [];
  resizes: unknown[] = [];
  killed: string[] = [];
  disposed = false;

  onData(listener: (event: { sessionId: string; data: string }) => void): () => void {
    this.dataListener = listener;
    return () => {
      this.dataListener = null;
    };
  }

  onExit(listener: (event: { sessionId: string; exitCode: number }) => void): () => void {
    this.exitListener = listener;
    return () => {
      this.exitListener = null;
    };
  }

  spawn(options: {
    sessionId: string;
    command: string;
    args: string[];
    cwd: string;
    cols: number;
    rows: number;
  }): Promise<{ sessionId: string }> {
    this.spawnOptions.push(options);
    return Promise.resolve({ sessionId: options.sessionId });
  }

  write(sessionId: string, data: string, encoding?: PtyWriteEncoding): void {
    this.writes.push({ sessionId, data, encoding });
  }

  resize(sessionId: string, cols: number, rows: number): void {
    this.resizes.push({ sessionId, cols, rows });
  }

  kill(sessionId: string): void {
    this.killed.push(sessionId);
  }

  dispose(): void {
    this.disposed = true;
  }
}

describe('PtySessionManager', () => {
  it('tracks seq, replay buffer, writes and exit state', async () => {
    const supervisor = new FakeSupervisor();
    const dataEvents: PtyDataEvent[] = [];
    const exitEvents: PtyExitEvent[] = [];
    const manager = new PtySessionManager(
      (event) => dataEvents.push(event),
      (event) => exitEvents.push(event),
      6,
      supervisor,
    );

    const started = await manager.startCodexAgentSession({
      cwd: '/tmp/project',
      prompt: 'hello',
      model: 'gpt-5.5',
      effort: 'high',
      cols: 120,
      rows: 30,
    });

    expect(supervisor.spawnOptions).toHaveLength(1);
    supervisor.dataListener?.({ sessionId: started.sessionId, data: 'abc' });
    supervisor.dataListener?.({ sessionId: started.sessionId, data: 'defgh' });
    expect(dataEvents.map((event) => event.seq)).toEqual([1, 2]);
    expect(manager.snapshot(started.sessionId)).toMatchObject({
      seq: 2,
      data: 'cdefgh',
      exited: false,
      exitCode: null,
    });

    manager.write(started.sessionId, 'x');
    manager.resize(started.sessionId, 100, 40);
    expect(supervisor.writes).toEqual([
      { sessionId: started.sessionId, data: 'x', encoding: 'utf8' },
    ]);
    expect(supervisor.resizes).toEqual([{ sessionId: started.sessionId, cols: 100, rows: 40 }]);

    supervisor.exitListener?.({ sessionId: started.sessionId, exitCode: 7 });
    expect(exitEvents).toEqual([{ sessionId: started.sessionId, exitCode: 7 }]);
    expect(manager.snapshot(started.sessionId)).toMatchObject({
      exited: true,
      exitCode: 7,
    });
    expect(() => manager.write(started.sessionId, 'after-exit')).toThrow(/exited/);

    manager.kill(started.sessionId);
    expect(supervisor.killed).toEqual([started.sessionId]);
  });
});
