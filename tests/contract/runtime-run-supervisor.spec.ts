// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RuntimeRunSupervisor,
  type RuntimeLaneHandle,
  type RuntimeRunEvent,
} from '../../src/app/main/runtime-run-supervisor';

function handle() {
  return {
    cancel: vi.fn(),
    kill: vi.fn(),
    dispose: vi.fn(),
  } satisfies RuntimeLaneHandle;
}

function createSupervisor(deadlines?: {
  firstOutputMs?: number;
  idleMs?: number;
  hardMs?: number;
}) {
  const events: RuntimeRunEvent[] = [];
  const supervisor = new RuntimeRunSupervisor({
    emit: (event) => events.push(event),
    deadlines: {
      firstOutputMs: deadlines?.firstOutputMs ?? 1_000,
      idleMs: deadlines?.idleMs ?? 2_000,
      hardMs: deadlines?.hardMs ?? 5_000,
    },
  });
  return { supervisor, events };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('RuntimeRunSupervisor state machine', () => {
  it('settles a run exactly once and ignores late lane events', () => {
    const { supervisor, events } = createSupervisor();
    const fast = handle();
    const friendly = handle();

    supervisor.startRun({
      runId: 'run-1',
      conversationId: 'conv-1',
      runtime: 'codex',
      lanes: { fast, friendly },
    });
    supervisor.receiveLaneEvent({
      runId: 'run-1',
      lane: 'friendly',
      kind: 'chunk',
      text: 'hello',
    });
    supervisor.receiveLaneEvent({
      runId: 'run-1',
      lane: 'friendly',
      kind: 'done',
      exitCode: 0,
    });
    supervisor.receiveLaneEvent({
      runId: 'run-1',
      lane: 'friendly',
      kind: 'error',
      message: 'late boom',
    });

    expect(supervisor.snapshot('run-1')?.status).toBe('done');
    expect(events.filter((event) => event.kind === 'run-settled')).toHaveLength(1);
    expect(events.some((event) => event.kind === 'late-lane-event')).toBe(true);
    expect(fast.dispose).toHaveBeenCalledTimes(1);
    expect(friendly.dispose).toHaveBeenCalledTimes(1);
  });

  it('cancels active lanes and ignores completion that arrives after cancel', () => {
    const { supervisor, events } = createSupervisor();
    const fast = handle();
    const friendly = handle();

    supervisor.startRun({
      runId: 'run-2',
      conversationId: 'conv-1',
      runtime: 'codex',
      lanes: { fast, friendly },
    });
    supervisor.cancelRun('run-2', 'user_cancel');
    supervisor.receiveLaneEvent({
      runId: 'run-2',
      lane: 'friendly',
      kind: 'done',
      exitCode: 0,
    });

    expect(supervisor.snapshot('run-2')?.status).toBe('canceled');
    expect(fast.cancel).toHaveBeenCalledWith('user_cancel');
    expect(friendly.cancel).toHaveBeenCalledWith('user_cancel');
    expect(events.filter((event) => event.kind === 'run-settled')).toHaveLength(1);
    expect(events.at(-1)?.kind).toBe('late-lane-event');
  });

  it('emits first-output and idle deadline events without settling before hard timeout', () => {
    const { supervisor, events } = createSupervisor({
      firstOutputMs: 100,
      idleMs: 200,
      hardMs: 1_000,
    });

    supervisor.startRun({
      runId: 'run-3',
      conversationId: 'conv-1',
      runtime: 'codex',
      lanes: { friendly: handle() },
    });

    vi.advanceTimersByTime(100);
    expect(supervisor.snapshot('run-3')?.status).toBe('running');
    expect(
      events.some((event) => event.kind === 'deadline' && event.deadline === 'first-output'),
    ).toBe(true);

    supervisor.receiveLaneEvent({
      runId: 'run-3',
      lane: 'friendly',
      kind: 'chunk',
      text: 'partial',
    });
    vi.advanceTimersByTime(200);
    expect(supervisor.snapshot('run-3')?.status).toBe('streaming');
    expect(events.some((event) => event.kind === 'deadline' && event.deadline === 'idle')).toBe(
      true,
    );

    vi.advanceTimersByTime(700);
    // oxlint-disable-next-line unicorn/no-array-reverse -- TS target does not include ES2023 toReversed.
    const lastSettlement = [...events].reverse().find((event) => event.kind === 'run-settled');
    expect(supervisor.snapshot('run-3')?.status).toBe('timeout');
    expect(lastSettlement).toMatchObject({
      kind: 'run-settled',
      runId: 'run-3',
      status: 'timeout',
    });
  });

  it('clears deadlines once a run reaches a terminal state', () => {
    const { supervisor, events } = createSupervisor({
      firstOutputMs: 100,
      idleMs: 200,
      hardMs: 1_000,
    });

    supervisor.startRun({
      runId: 'run-4',
      conversationId: 'conv-1',
      runtime: 'codex',
      lanes: { friendly: handle() },
    });
    supervisor.receiveLaneEvent({
      runId: 'run-4',
      lane: 'friendly',
      kind: 'done',
      exitCode: 0,
    });
    vi.advanceTimersByTime(2_000);

    expect(supervisor.snapshot('run-4')?.status).toBe('done');
    expect(events.filter((event) => event.kind === 'deadline')).toHaveLength(0);
    expect(events.filter((event) => event.kind === 'run-settled')).toHaveLength(1);
  });
});
