import { mkdtempSync, readdirSync, writeFileSync } from 'node:fs';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ChannelsStore } from '../../src/contexts/channels/infrastructure/channels-store';

function tmp(): string {
  return mkdtempSync(path.join(tmpdir(), 'morrow-channels-'));
}

async function setupStore() {
  const dir = tmp();
  const store = new ChannelsStore({ userDataDir: dir });
  await store.load();
  return { dir, store };
}

describe('ChannelsStore', () => {
  let cleanupDirs: string[];

  beforeEach(() => {
    cleanupDirs = [];
  });

  it('loads missing file with default roles', async () => {
    const { dir, store } = await setupStore();
    cleanupDirs.push(dir);
    expect(store.getSnapshot().roles.map((role) => role.name)).toContain('设计师');
  });

  it('backs up corrupt file and falls back to seed state', async () => {
    const dir = tmp();
    cleanupDirs.push(dir);
    writeFileSync(path.join(dir, 'channels.json'), '{ not json');
    const store = new ChannelsStore({ userDataDir: dir });
    await store.load();
    expect(store.getSnapshot().channels).toEqual([]);
    expect(readdirSync(dir).some((name) => name.startsWith('channels.json.bak-'))).toBe(true);
  });

  it('repairs old role data and does not resurrect stale running runs', async () => {
    const dir = tmp();
    cleanupDirs.push(dir);
    writeFileSync(
      path.join(dir, 'channels.json'),
      JSON.stringify({
        version: 1,
        channels: [
          {
            id: 'c1',
            name: 'old',
            memberRoleIds: ['r1', 'missing'],
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        roles: [{ id: 'r1', name: 'Lin', defaultRuntime: 'unknown' }],
        events: [],
        runs: [
          {
            id: 'run1',
            channelId: 'c1',
            roleId: 'r1',
            trigger: 'mention',
            triggerEventId: 'e1',
            inputText: '@Lin hi',
            status: 'running',
            runtime: 'unknown',
            createdAt: 1,
            updatedAt: 1,
          },
        ],
        handoffs: [],
      }),
    );
    const store = new ChannelsStore({ userDataDir: dir });
    await store.load();

    const snapshot = store.getSnapshot();
    const lin = snapshot.roles.find((r) => r.id === 'r1')!;
    expect(lin.instruction).toContain('Lin');
    expect(lin.defaultRuntime).toBe('codex');
    expect(snapshot.channels[0]!.memberRoleIds).toEqual(['r1']);
    expect(snapshot.runs[0]!.status).toBe('failed');
  });

  it('creates role only when instruction exists', async () => {
    const { dir, store } = await setupStore();
    cleanupDirs.push(dir);
    await expect(
      store.createRole({
        name: '研究员',
        intro: '整理资料',
        instruction: '',
        defaultRuntime: 'claude',
      }),
    ).rejects.toThrow(/instruction is required/);
  });

  it('deletes a role from teammate list and channel members without deleting history', async () => {
    const { dir, store } = await setupStore();
    cleanupDirs.push(dir);
    const design = store.getSnapshot().roles.find((role) => role.name === '设计师')!;
    const channel = (await store.createChannel({ name: 'general', memberRoleIds: [design.id] }))
      .channels[0]!;
    await store.postUserMessage({ channelId: channel.id, text: '@设计师 看看' });

    const snapshot = await store.deleteRole({ roleId: design.id });

    expect(snapshot.roles.some((role) => role.id === design.id)).toBe(false);
    expect(snapshot.channels[0]!.memberRoleIds).not.toContain(design.id);
    expect(snapshot.events.some((event) => event.text?.includes('@设计师'))).toBe(true);
  });

  it('dissolves a channel with its history and keeps roles', async () => {
    const { dir, store } = await setupStore();
    cleanupDirs.push(dir);
    const roles = store.getSnapshot().roles;
    const design = roles.find((role) => role.name === '设计师')!;
    const engineer = roles.find((role) => role.name === '工程师')!;
    const channel = (
      await store.createChannel({ name: 'general', memberRoleIds: [design.id, engineer.id] })
    ).channels[0]!;
    const patch = await store.postUserMessage({ channelId: channel.id, text: '@设计师 看看' });
    await store.completeRoleRun(patch.runsToStart[0]!.id, '@工程师 接着看。');

    const deleted = await store.deleteChannel({ channelId: channel.id });

    expect(deleted.runIdsToAbort).toEqual([]);
    expect(deleted.snapshot.channels.some((item) => item.id === channel.id)).toBe(false);
    expect(deleted.snapshot.events.some((event) => event.channelId === channel.id)).toBe(false);
    expect(deleted.snapshot.runs.some((run) => run.channelId === channel.id)).toBe(false);
    expect(deleted.snapshot.handoffs.some((handoff) => handoff.channelId === channel.id)).toBe(
      false,
    );
    expect(deleted.snapshot.roles.map((role) => role.id)).toEqual(roles.map((role) => role.id));
  });

  it('returns running role runs to abort and ignores late runtime completion', async () => {
    const { dir, store } = await setupStore();
    cleanupDirs.push(dir);
    const design = store.getSnapshot().roles.find((role) => role.name === '设计师')!;
    const channel = (await store.createChannel({ name: 'general', memberRoleIds: [design.id] }))
      .channels[0]!;
    const patch = await store.postUserMessage({ channelId: channel.id, text: '@设计师 看看' });

    const deleted = await store.deleteChannel({ channelId: channel.id });
    const late = await store.completeRoleRun(patch.runsToStart[0]!.id, '迟到输出');

    expect(deleted.runIdsToAbort).toEqual([patch.runsToStart[0]!.id]);
    expect(late.channels).toEqual([]);
    expect(late.events).toEqual([]);
  });

  it('posts user message and creates runs only for mentioned channel roles', async () => {
    const { dir, store } = await setupStore();
    cleanupDirs.push(dir);
    const design = store.getSnapshot().roles.find((role) => role.name === '设计师')!;
    const channel = (await store.createChannel({ name: 'general', memberRoleIds: [design.id] }))
      .channels[0]!;

    const patch = await store.postUserMessage({
      channelId: channel.id,
      text: '@设计师 帮我看一下',
    });

    expect(patch.runsToStart).toHaveLength(1);
    expect(patch.runsToStart[0]!.roleId).toBe(design.id);
    expect(patch.snapshot.events.map((event) => event.type)).toEqual([
      'message_posted',
      'role_run_started',
    ]);
  });

  it('turns role mention in output into handoff proposal without auto-running target', async () => {
    const { dir, store } = await setupStore();
    cleanupDirs.push(dir);
    const roles = store.getSnapshot().roles;
    const design = roles.find((role) => role.name === '设计师')!;
    const engineer = roles.find((role) => role.name === '工程师')!;
    const channel = (
      await store.createChannel({ name: 'general', memberRoleIds: [design.id, engineer.id] })
    ).channels[0]!;
    const patch = await store.postUserMessage({
      channelId: channel.id,
      text: '@设计师 先看设计',
    });

    const snapshot = await store.completeRoleRun(
      patch.runsToStart[0]!.id,
      '设计建议完成，建议 @工程师 接着看实现。',
    );

    expect(snapshot.handoffs).toHaveLength(1);
    expect(snapshot.handoffs[0]!.toRoleId).toBe(engineer.id);
    expect(snapshot.runs).toHaveLength(1);
  });

  it('accepts handoff and creates target role run', async () => {
    const { dir, store } = await setupStore();
    cleanupDirs.push(dir);
    const roles = store.getSnapshot().roles;
    const design = roles.find((role) => role.name === '设计师')!;
    const engineer = roles.find((role) => role.name === '工程师')!;
    const channel = (
      await store.createChannel({ name: 'general', memberRoleIds: [design.id, engineer.id] })
    ).channels[0]!;
    const patch = await store.postUserMessage({ channelId: channel.id, text: '@设计师 看看' });
    const done = await store.completeRoleRun(patch.runsToStart[0]!.id, '@工程师 接着看实现。');

    const accepted = await store.acceptHandoff({
      channelId: channel.id,
      handoffId: done.handoffs[0]!.id,
    });

    expect(accepted.runsToStart).toHaveLength(1);
    expect(accepted.runsToStart[0]!.roleId).toBe(engineer.id);
  });

  afterEach(() => {
    for (const dir of cleanupDirs) rmSync(dir, { recursive: true, force: true });
  });
});
