import { randomUUID } from 'node:crypto';
import type {
  RuntimeId,
  RuntimeLaneId,
  RuntimeRunDeadline,
  RuntimeRunEvent,
  RuntimeRunSnapshot,
  RuntimeRunStatus,
  RuntimeRunTerminalStatus,
} from '../../shared/ipc';

export type {
  RuntimeLaneId,
  RuntimeRunDeadline,
  RuntimeRunEvent,
  RuntimeRunSnapshot,
  RuntimeRunStatus,
  RuntimeRunTerminalStatus,
} from '../../shared/ipc';

export interface RuntimeLaneHandle {
  cancel(reason: string): void;
  kill(reason: string): void;
  dispose(): void;
}

export type RuntimeLaneEvent =
  | { runId: string; lane: RuntimeLaneId; kind: 'activity' }
  | { runId: string; lane: RuntimeLaneId; kind: 'chunk'; text: string }
  | { runId: string; lane: RuntimeLaneId; kind: 'done'; exitCode: number }
  | { runId: string; lane: RuntimeLaneId; kind: 'error'; message: string }
  | { runId: string; lane: RuntimeLaneId; kind: 'crash'; message: string };

export interface RuntimeRunDeadlines {
  firstOutputMs: number;
  idleMs: number;
  hardMs: number;
}

interface RuntimeRunSupervisorDeps {
  emit: (event: RuntimeRunEvent) => void;
  deadlines: RuntimeRunDeadlines;
  now?: () => number;
}

interface StartRunArgs {
  runId?: string;
  conversationId: string;
  runtime: RuntimeId;
  lanes?: Partial<Record<RuntimeLaneId, RuntimeLaneHandle>>;
}

interface RuntimeRunState {
  snapshot: RuntimeRunSnapshot;
  lanes: Partial<Record<RuntimeLaneId, RuntimeLaneHandle>>;
  timers: Partial<Record<RuntimeRunDeadline, NodeJS.Timeout>>;
}

export class RuntimeRunSupervisor {
  private readonly runs = new Map<string, RuntimeRunState>();
  private readonly now: () => number;

  constructor(private readonly deps: RuntimeRunSupervisorDeps) {
    this.now = deps.now ?? (() => Date.now());
  }

  startRun(args: StartRunArgs): RuntimeRunSnapshot {
    const runId = args.runId ?? randomUUID();
    if (this.runs.has(runId)) throw new Error(`duplicate runtime run: ${runId}`);
    const at = this.now();
    const state: RuntimeRunState = {
      snapshot: {
        runId,
        conversationId: args.conversationId,
        runtime: args.runtime,
        status: 'running',
        createdAt: at,
        updatedAt: at,
        firstOutputAt: null,
        settledAt: null,
        reason: null,
      },
      lanes: args.lanes ?? {},
      timers: {},
    };
    this.runs.set(runId, state);
    this.armFirstOutputDeadline(state);
    this.armHardDeadline(state);
    this.emit({ kind: 'run-started', run: this.copySnapshot(state) });
    return this.copySnapshot(state);
  }

  receiveLaneEvent(event: RuntimeLaneEvent): void {
    const state = this.runs.get(event.runId);
    if (!state) return;
    if (this.isTerminal(state.snapshot.status)) {
      this.emitLateEvent(event);
      return;
    }

    if (event.kind === 'activity' || event.kind === 'chunk') {
      this.markOutput(state, event.lane);
      this.armIdleDeadline(state);
    }

    if (event.kind === 'chunk' && event.lane === 'friendly') {
      state.snapshot.status = 'streaming';
      state.snapshot.updatedAt = this.now();
      this.emit({ kind: 'friendly-chunk', runId: event.runId, text: event.text, at: this.now() });
      return;
    }

    if (event.kind === 'done') {
      if (event.lane === 'friendly' || !state.lanes.friendly) {
        this.settle(state, 'done', null, 'dispose');
      }
      return;
    }

    if (event.kind === 'error' || event.kind === 'crash') {
      if (event.lane === 'friendly' || !state.lanes.friendly) {
        this.settle(state, 'error', event.message, 'dispose');
      }
    }
  }

  cancelRun(runId: string, reason = 'user_cancel'): void {
    const state = this.runs.get(runId);
    if (!state || this.isTerminal(state.snapshot.status)) return;
    for (const handle of Object.values(state.lanes)) {
      try {
        handle?.cancel(reason);
      } catch {
        // Best effort: terminal state ownership stays in the supervisor.
      }
    }
    this.settle(state, 'canceled', reason, 'dispose');
  }

  timeoutRun(runId: string, reason = 'hard_timeout'): void {
    const state = this.runs.get(runId);
    if (!state || this.isTerminal(state.snapshot.status)) return;
    for (const handle of Object.values(state.lanes)) {
      try {
        handle?.kill(reason);
      } catch {
        // Best effort cleanup continues below.
      }
    }
    this.settle(state, 'timeout', reason, 'dispose');
  }

  snapshot(runId: string): RuntimeRunSnapshot | null {
    const state = this.runs.get(runId);
    return state ? this.copySnapshot(state) : null;
  }

  dispose(): void {
    for (const state of this.runs.values()) {
      this.clearDeadlines(state);
      for (const handle of Object.values(state.lanes)) {
        try {
          handle?.dispose();
        } catch {
          // Ignore disposal failures during app shutdown.
        }
      }
    }
    this.runs.clear();
  }

  private markOutput(state: RuntimeRunState, lane: RuntimeLaneId): void {
    if (state.snapshot.firstOutputAt !== null) return;
    const at = this.now();
    state.snapshot.firstOutputAt = at;
    state.snapshot.updatedAt = at;
    this.clearDeadline(state, 'first-output');
    this.emit({ kind: 'run-first-output', runId: state.snapshot.runId, lane, at });
  }

  private settle(
    state: RuntimeRunState,
    status: RuntimeRunTerminalStatus,
    reason: string | null,
    cleanup: 'dispose',
  ): void {
    if (this.isTerminal(state.snapshot.status)) return;
    const at = this.now();
    state.snapshot.status = status;
    state.snapshot.updatedAt = at;
    state.snapshot.settledAt = at;
    state.snapshot.reason = reason;
    this.clearDeadlines(state);
    if (cleanup === 'dispose') this.disposeLanes(state);
    this.emit({ kind: 'run-settled', runId: state.snapshot.runId, status, reason, at });
  }

  private disposeLanes(state: RuntimeRunState): void {
    for (const handle of Object.values(state.lanes)) {
      try {
        handle?.dispose();
      } catch {
        // Disposal failures should not prevent terminal state publication.
      }
    }
  }

  private armFirstOutputDeadline(state: RuntimeRunState): void {
    const timeout = setTimeout(() => {
      if (this.isTerminal(state.snapshot.status) || state.snapshot.firstOutputAt !== null) return;
      state.snapshot.updatedAt = this.now();
      this.emit({
        kind: 'deadline',
        runId: state.snapshot.runId,
        deadline: 'first-output',
        at: this.now(),
      });
    }, this.deps.deadlines.firstOutputMs);
    timeout.unref?.();
    state.timers['first-output'] = timeout;
  }

  private armIdleDeadline(state: RuntimeRunState): void {
    this.clearDeadline(state, 'idle');
    const timeout = setTimeout(() => {
      if (this.isTerminal(state.snapshot.status)) return;
      state.snapshot.updatedAt = this.now();
      this.emit({
        kind: 'deadline',
        runId: state.snapshot.runId,
        deadline: 'idle',
        at: this.now(),
      });
    }, this.deps.deadlines.idleMs);
    timeout.unref?.();
    state.timers.idle = timeout;
  }

  private armHardDeadline(state: RuntimeRunState): void {
    const timeout = setTimeout(() => {
      if (this.isTerminal(state.snapshot.status)) return;
      this.emit({
        kind: 'deadline',
        runId: state.snapshot.runId,
        deadline: 'hard',
        at: this.now(),
      });
      this.timeoutRun(state.snapshot.runId);
    }, this.deps.deadlines.hardMs);
    timeout.unref?.();
    state.timers.hard = timeout;
  }

  private clearDeadline(state: RuntimeRunState, deadline: RuntimeRunDeadline): void {
    const timer = state.timers[deadline];
    if (!timer) return;
    clearTimeout(timer);
    delete state.timers[deadline];
  }

  private clearDeadlines(state: RuntimeRunState): void {
    this.clearDeadline(state, 'first-output');
    this.clearDeadline(state, 'idle');
    this.clearDeadline(state, 'hard');
  }

  private emitLateEvent(event: RuntimeLaneEvent): void {
    this.emit({
      kind: 'late-lane-event',
      runId: event.runId,
      lane: event.lane,
      laneEventKind: event.kind,
    });
  }

  private emit(event: RuntimeRunEvent): void {
    this.deps.emit(event);
  }

  private copySnapshot(state: RuntimeRunState): RuntimeRunSnapshot {
    return { ...state.snapshot };
  }

  private isTerminal(status: RuntimeRunStatus): status is RuntimeRunTerminalStatus {
    return status === 'done' || status === 'error' || status === 'canceled' || status === 'timeout';
  }
}
