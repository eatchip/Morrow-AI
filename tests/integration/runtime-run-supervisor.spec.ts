// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RuntimeRunSupervisor,
  type RuntimeLaneEvent,
  type RuntimeLaneHandle,
  type RuntimeLaneId,
  type RuntimeRunEvent,
} from '../../src/app/main/runtime-run-supervisor';

type SyntheticLaneEvent = RuntimeLaneEvent extends infer Event
  ? Event extends RuntimeLaneEvent
    ? Omit<Event, 'runId' | 'lane'>
    : never
  : never;

class SyntheticLane implements RuntimeLaneHandle {
  readonly cancel = vi.fn();
  readonly kill = vi.fn();
  readonly dispose = vi.fn();

  constructor(
    private readonly supervisor: RuntimeRunSupervisor,
    private readonly runId: string,
    private readonly lane: RuntimeLaneId,
  ) {}

  emit(event: SyntheticLaneEvent): void {
    this.supervisor.receiveLaneEvent({ runId: this.runId, lane: this.lane, ...event });
  }
}

function createHarness(deadlines = { firstOutputMs: 100, idleMs: 200, hardMs: 1_000 }) {
  const events: RuntimeRunEvent[] = [];
  const supervisor = new RuntimeRunSupervisor({
    emit: (event) => events.push(event),
    deadlines,
  });
  const start = (runId: string) => {
    const fast = new SyntheticLane(supervisor, runId, 'fast');
    const friendly = new SyntheticLane(supervisor, runId, 'friendly');
    supervisor.startRun({
      runId,
      conversationId: `conv-${runId}`,
      runtime: 'codex',
      lanes: { fast, friendly },
    });
    return { fast, friendly };
  };
  return { events, supervisor, start };
}

beforeEach(() => {
  vi.useFakeTimers();
});

describe('RuntimeRunSupervisor synthetic runtime harness', () => {
  it('hard-times out a stuck run, kills both lanes, and ignores a late friendly done', () => {
    const { events, supervisor, start } = createHarness();
    const { fast, friendly } = start('stuck');

    fast.emit({ kind: 'activity' });
    vi.advanceTimersByTime(1_000);
    friendly.emit({ kind: 'done', exitCode: 0 });

    expect(supervisor.snapshot('stuck')?.status).toBe('timeout');
    expect(fast.kill).toHaveBeenCalledWith('hard_timeout');
    expect(friendly.kill).toHaveBeenCalledWith('hard_timeout');
    expect(events.filter((event) => event.kind === 'run-settled')).toHaveLength(1);
    expect(events.at(-1)).toMatchObject({
      kind: 'late-lane-event',
      runId: 'stuck',
      lane: 'friendly',
      laneEventKind: 'done',
    });
  });

  it('uses fast-lane activity as first evidence while waiting for friendly output', () => {
    const { events, supervisor, start } = createHarness();
    const { fast, friendly } = start('slow-friendly');

    fast.emit({ kind: 'activity' });
    vi.advanceTimersByTime(500);
    friendly.emit({ kind: 'chunk', text: 'clean answer' });
    friendly.emit({ kind: 'done', exitCode: 0 });

    expect(supervisor.snapshot('slow-friendly')?.status).toBe('done');
    expect(
      events.some((event) => event.kind === 'deadline' && event.deadline === 'first-output'),
    ).toBe(false);
    expect(events.find((event) => event.kind === 'run-first-output')).toMatchObject({
      kind: 'run-first-output',
      runId: 'slow-friendly',
      lane: 'fast',
    });
    expect(events.find((event) => event.kind === 'friendly-chunk')).toMatchObject({
      kind: 'friendly-chunk',
      runId: 'slow-friendly',
      text: 'clean answer',
    });
  });

  it('lets a second run complete while the first run is stuck', () => {
    const { events, supervisor, start } = createHarness();
    start('background-stuck');
    const foreground = start('foreground-ok');

    foreground.friendly.emit({ kind: 'chunk', text: 'ok' });
    foreground.friendly.emit({ kind: 'done', exitCode: 0 });
    vi.advanceTimersByTime(1_000);

    expect(supervisor.snapshot('foreground-ok')?.status).toBe('done');
    expect(supervisor.snapshot('background-stuck')?.status).toBe('timeout');
    expect(
      events
        .filter((event) => event.kind === 'run-settled')
        .map((event) => ({ runId: event.runId, status: event.status })),
    ).toEqual([
      { runId: 'foreground-ok', status: 'done' },
      { runId: 'background-stuck', status: 'timeout' },
    ]);
  });

  it('keeps cancellation local even when the synthetic lane ignores cancel', () => {
    const { events, supervisor, start } = createHarness();
    const { friendly } = start('cancel-ignored');

    supervisor.cancelRun('cancel-ignored', 'user_cancel');
    friendly.emit({ kind: 'chunk', text: 'late text' });
    friendly.emit({ kind: 'done', exitCode: 0 });

    expect(supervisor.snapshot('cancel-ignored')?.status).toBe('canceled');
    expect(events.filter((event) => event.kind === 'run-settled')).toHaveLength(1);
    expect(events.filter((event) => event.kind === 'late-lane-event')).toHaveLength(2);
    expect(events.some((event) => event.kind === 'friendly-chunk')).toBe(false);
  });
});
