import { describe, expect, it } from 'vitest';
import { buildChannelViewModel } from '../../src/app/renderer/src/lib/channel-view-model';
import type {
  Channel,
  ChannelEvent,
  ChannelSnapshot,
  HandoffProposal,
  RoleProfile,
  RoleRun,
} from '../../src/shared/channel-ipc';

const role = (id: string, name: string): RoleProfile => ({
  id,
  name,
  intro: `${name} intro`,
  instruction: `${name} instruction`,
  defaultRuntime: id.endsWith('2') ? 'codex' : 'claude',
  createdAt: 1,
  updatedAt: 1,
});

const channel = (id: string, memberRoleIds: string[]): Channel => ({
  id,
  name: id,
  description: '',
  folderProjectId: null,
  memberRoleIds,
  createdAt: 1,
  updatedAt: 1,
});

const event = (
  args: Partial<ChannelEvent> & Pick<ChannelEvent, 'id' | 'channelId'>,
): ChannelEvent => ({
  type: 'message_posted',
  authorType: 'user',
  createdAt: 1,
  ...args,
});

const run = (id: string, roleId: string, status: RoleRun['status']): RoleRun => ({
  id,
  channelId: 'c1',
  roleId,
  trigger: 'mention',
  triggerEventId: 'e1',
  inputText: 'input',
  status,
  runtime: 'claude',
  createdAt: 1,
  updatedAt: 1,
});

const handoff = (id: string, fromRoleId: string, toRoleId: string): HandoffProposal => ({
  id,
  channelId: 'c1',
  fromRoleId,
  toRoleId,
  sourceRunId: 'run-1',
  reason: 'handoff reason',
  instruction: 'handoff instruction',
  status: 'proposed',
  createdAt: 1,
  updatedAt: 1,
});

describe('buildChannelViewModel', () => {
  it('returns null when the active channel is missing', () => {
    const snapshot: ChannelSnapshot = {
      channels: [channel('c1', ['r1'])],
      roles: [role('r1', '设计师')],
      events: [],
      runs: [],
      handoffs: [],
      teamProposals: [],
    };

    expect(buildChannelViewModel(snapshot, null)).toBeNull();
    expect(buildChannelViewModel(snapshot, 'missing')).toBeNull();
  });

  it('projects the active channel without changing existing semantics', () => {
    const snapshot: ChannelSnapshot = {
      channels: [channel('c1', ['r2', 'r1', 'missing-role']), channel('c2', ['r3'])],
      roles: [role('r1', '设计师'), role('r2', '工程师'), role('r3', '测试员')],
      events: [
        event({ id: 'other', channelId: 'c2', text: 'ignored', createdAt: 1 }),
        event({ id: 'late', channelId: 'c1', text: 'late', createdAt: 5 }),
        event({
          id: 'same-a',
          channelId: 'c1',
          type: 'role_run_started',
          authorType: 'system',
          roleId: 'r2',
          runId: 'run-1',
          createdAt: 3,
        }),
        event({
          id: 'same-b',
          channelId: 'c1',
          type: 'handoff_proposed',
          authorType: 'system',
          handoffId: 'handoff-1',
          createdAt: 3,
        }),
        event({
          id: 'missing-refs',
          channelId: 'c1',
          type: 'role_run_failed',
          authorType: 'role',
          roleId: 'missing-role',
          runId: 'missing-run',
          handoffId: 'missing-handoff',
          text: 'failed',
          createdAt: 4,
        }),
      ],
      runs: [run('run-1', 'r2', 'running'), run('unused-run', 'r3', 'done')],
      handoffs: [handoff('handoff-1', 'r1', 'r2'), handoff('unused-handoff', 'r2', 'r3')],
      teamProposals: [],
    };
    const original = JSON.parse(JSON.stringify(snapshot)) as ChannelSnapshot;

    const view = buildChannelViewModel(snapshot, 'c1');

    expect(view?.channel.id).toBe('c1');
    expect(view?.channelRoles.map((item) => item.id)).toEqual(['r2', 'r1']);
    expect(view?.availableRoles.map((item) => item.id)).toEqual(['r3']);
    expect(view?.events.map((item) => item.event.id)).toEqual([
      'same-a',
      'same-b',
      'missing-refs',
      'late',
    ]);
    expect(view?.events[0]?.role?.name).toBe('工程师');
    expect(view?.events[0]?.run?.status).toBe('running');
    expect(view?.events[1]?.handoff?.toRoleId).toBe('r2');
    expect(view?.events[2]?.role).toBeNull();
    expect(view?.events[2]?.run).toBeNull();
    expect(view?.events[2]?.handoff).toBeNull();
    expect(view?.rolesById.get('r1')?.name).toBe('设计师');
    expect(snapshot).toEqual(original);
  });
});
