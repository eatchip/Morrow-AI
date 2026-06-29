import { describe, expect, it } from 'vitest';
import { findMentionedRoles } from '../../src/contexts/channels/domain/role-mentions';
import type { RoleProfile } from '../../src/shared/channel-ipc';

const roles: RoleProfile[] = [
  {
    id: 'role-design',
    name: '设计师',
    intro: '设计',
    instruction: '做设计建议',
    defaultRuntime: 'claude',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'role-engineer',
    name: '工程师',
    intro: '工程',
    instruction: '做工程建议',
    defaultRuntime: 'codex',
    createdAt: 1,
    updatedAt: 1,
  },
];

describe('findMentionedRoles', () => {
  it('matches channel roles by exact @name token', () => {
    expect(findMentionedRoles('@设计师 @工程师 看看', roles).map((role) => role.id)).toEqual([
      'role-design',
      'role-engineer',
    ]);
  });

  it('ignores unknown mentions and plain text', () => {
    expect(findMentionedRoles('@产品经理 普通消息', roles).map((role) => role.id)).toEqual([]);
  });
});
