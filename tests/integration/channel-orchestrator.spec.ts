import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ChannelOrchestrator } from '../../src/contexts/channels/application/channel-orchestrator';
import { ChannelsStore } from '../../src/contexts/channels/infrastructure/channels-store';
import type { ChannelUiEvent } from '../../src/shared/channel-ipc';
import type { StreamEvent } from '../../src/shared/ipc';

function tmp(): string {
  return mkdtempSync(path.join(tmpdir(), 'morrow-orchestrator-'));
}

async function waitUntil(assertion: () => void): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    try {
      assertion();
      return;
    } catch (error) {
      if (i === 19) throw error;
      // oxlint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('ChannelOrchestrator', () => {
  const cleanup: string[] = [];

  afterEach(() => {
    for (const dir of cleanup.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it('starts mentioned role with folder cwd and persists final output', async () => {
    const dir = tmp();
    cleanup.push(dir);
    const store = new ChannelsStore({ userDataDir: dir });
    await store.load();
    const role = store.getSnapshot().roles.find((item) => item.name === '设计师')!;
    const channel = (
      await store.createChannel({
        name: 'general',
        folderProjectId: 'p1',
        memberRoleIds: [role.id],
      })
    ).channels[0]!;
    let startedCwd = '';
    let emitRuntime: ((event: StreamEvent) => void) | null = null;
    const events: ChannelUiEvent[] = [];
    const orchestrator = new ChannelOrchestrator({
      store,
      folders: { resolve: async () => '/tmp/project-root' },
      runtime: {
        start: (args, emit) => {
          startedCwd = args.cwd;
          emitRuntime = emit;
        },
        abort: () => {},
      },
      emit: (event) => events.push(event),
    });

    // oxlint-disable-next-line require-post-message-target-origin
    await orchestrator.postMessage({ channelId: channel.id, text: '@设计师 看看' });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(startedCwd).toBe('/tmp/project-root');

    const snapshotsBeforeDone = events.filter((event) => event.kind === 'snapshot').length;
    emitRuntime!({ sessionId: 'ignored', kind: 'chunk', text: '建议一' });
    emitRuntime!({ sessionId: 'ignored', kind: 'done', exitCode: 0 });
    await waitUntil(() => {
      expect(events.filter((event) => event.kind === 'snapshot').length).toBeGreaterThan(
        snapshotsBeforeDone,
      );
    });

    const snapshot = store.getSnapshot();
    expect(snapshot.events.some((event) => event.type === 'role_message_posted')).toBe(true);
    expect(events.some((event) => event.kind === 'run-chunk')).toBe(true);
  });

  it('fails role run when channel folder cannot be resolved', async () => {
    const dir = tmp();
    cleanup.push(dir);
    const store = new ChannelsStore({ userDataDir: dir });
    await store.load();
    const role = store.getSnapshot().roles.find((item) => item.name === '设计师')!;
    const channel = (
      await store.createChannel({
        name: 'general',
        folderProjectId: 'gone',
        memberRoleIds: [role.id],
      })
    ).channels[0]!;
    const events: ChannelUiEvent[] = [];
    const orchestrator = new ChannelOrchestrator({
      store,
      folders: { resolve: async () => null },
      runtime: {
        start: () => {
          throw new Error('runtime should not start');
        },
        abort: () => {},
      },
      emit: (event) => events.push(event),
    });

    // oxlint-disable-next-line require-post-message-target-origin
    await orchestrator.postMessage({ channelId: channel.id, text: '@设计师 看看' });
    const snapshotsBeforeFail = events.filter((event) => event.kind === 'snapshot').length;
    await waitUntil(() => {
      expect(events.filter((event) => event.kind === 'snapshot').length).toBeGreaterThan(
        snapshotsBeforeFail,
      );
    });

    expect(store.getSnapshot().runs[0]!.status).toBe('failed');
  });

  it('fails role run instead of staying pending when runtime throws', async () => {
    const dir = tmp();
    cleanup.push(dir);
    const store = new ChannelsStore({ userDataDir: dir });
    await store.load();
    const role = store.getSnapshot().roles.find((item) => item.name === '设计师')!;
    const channel = (await store.createChannel({ name: 'general', memberRoleIds: [role.id] }))
      .channels[0]!;
    const events: ChannelUiEvent[] = [];
    const orchestrator = new ChannelOrchestrator({
      store,
      folders: { resolve: async () => '/tmp/project-root' },
      runtime: {
        start: () => {
          throw new Error('boom');
        },
        abort: () => {},
      },
      emit: (event) => events.push(event),
    });

    // oxlint-disable-next-line require-post-message-target-origin
    await orchestrator.postMessage({ channelId: channel.id, text: '@设计师 看看' });
    const snapshotsBeforeFail = events.filter((event) => event.kind === 'snapshot').length;
    await waitUntil(() => {
      expect(store.getSnapshot().runs[0]!.status).toBe('failed');
      expect(events.filter((event) => event.kind === 'snapshot').length).toBeGreaterThan(
        snapshotsBeforeFail,
      );
    });

    expect(events.at(-1)?.kind).toBe('snapshot');
  });

  it('dissolves a channel and aborts its running role runs', async () => {
    const dir = tmp();
    cleanup.push(dir);
    const store = new ChannelsStore({ userDataDir: dir });
    await store.load();
    const role = store.getSnapshot().roles.find((item) => item.name === '设计师')!;
    const channel = (await store.createChannel({ name: 'general', memberRoleIds: [role.id] }))
      .channels[0]!;
    const aborted: string[] = [];
    const events: ChannelUiEvent[] = [];
    const orchestrator = new ChannelOrchestrator({
      store,
      folders: { resolve: async () => '/tmp/project-root' },
      runtime: {
        start: () => {},
        abort: (sessionId) => aborted.push(sessionId),
      },
      emit: (event) => events.push(event),
    });
    // oxlint-disable-next-line require-post-message-target-origin
    await orchestrator.postMessage({ channelId: channel.id, text: '@设计师 看看' });
    const runId = store.getSnapshot().runs[0]!.id;

    const snapshot = await orchestrator.deleteChannel({ channelId: channel.id });

    expect(aborted).toEqual([runId]);
    expect(snapshot.channels).toEqual([]);
    expect(events.at(-1)).toEqual({ kind: 'snapshot', snapshot });
  });

  it('does not start a role run after its channel was dissolved during folder resolution', async () => {
    const dir = tmp();
    cleanup.push(dir);
    const store = new ChannelsStore({ userDataDir: dir });
    await store.load();
    const role = store.getSnapshot().roles.find((item) => item.name === '设计师')!;
    const channel = (await store.createChannel({ name: 'general', memberRoleIds: [role.id] }))
      .channels[0]!;
    const resolver = deferred<string>();
    const aborted: string[] = [];
    let starts = 0;
    const orchestrator = new ChannelOrchestrator({
      store,
      folders: { resolve: () => resolver.promise },
      runtime: {
        start: () => {
          starts += 1;
        },
        abort: (sessionId) => aborted.push(sessionId),
      },
      emit: () => {},
    });
    // oxlint-disable-next-line require-post-message-target-origin
    await orchestrator.postMessage({ channelId: channel.id, text: '@设计师 看看' });
    const runId = store.getSnapshot().runs[0]!.id;

    await orchestrator.deleteChannel({ channelId: channel.id });
    resolver.resolve('/tmp/project-root');
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(aborted).toEqual([runId]);
    expect(starts).toBe(0);
  });
});
