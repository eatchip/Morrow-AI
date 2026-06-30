import { describe, expect, it } from 'vitest';
import { buildRoleContextEnvelope } from '../../src/contexts/channels/application/role-context-envelope';
import type { ChannelSnapshot } from '../../src/shared/channel-ipc';

describe('buildRoleContextEnvelope', () => {
  it('includes instruction, folder cwd, members, recent events and trigger input', () => {
    const snapshot: ChannelSnapshot = {
      channels: [
        {
          id: 'channel-1',
          name: 'general',
          description: '',
          folderProjectId: 'p1',
          memberRoleIds: ['role-1'],
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      roles: [
        {
          id: 'role-1',
          name: '设计师',
          intro: '负责界面',
          instruction: '只输出可执行的设计建议。',
          defaultRuntime: 'claude',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      events: [
        {
          id: 'event-1',
          channelId: 'channel-1',
          type: 'message_posted',
          authorType: 'user',
          text: '@设计师 看看',
          createdAt: 1,
        },
      ],
      runs: [],
      handoffs: [],
      teamProposals: [],
    };

    const prompt = buildRoleContextEnvelope({
      snapshot,
      cwd: '/Users/songhuiyu/Morrow',
      run: {
        id: 'run-1',
        channelId: 'channel-1',
        roleId: 'role-1',
        trigger: 'mention',
        triggerEventId: 'event-1',
        inputText: '@设计师 看看',
        status: 'running',
        runtime: 'claude',
        createdAt: 1,
        updatedAt: 1,
      },
    });

    expect(prompt).toContain('只输出可执行的设计建议。');
    expect(prompt).toContain('/Users/songhuiyu/Morrow');
    expect(prompt).toContain('设计师：负责界面');
    expect(prompt).toContain('用户: @设计师 看看');
  });
});
