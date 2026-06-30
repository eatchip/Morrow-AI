import { describe, expect, it } from 'vitest';
import { detectHandoffTargets } from '../../src/contexts/channels/domain/handoff-detection';
import type { RoleProfile } from '../../src/shared/channel-ipc';

function role(id: string, name: string): RoleProfile {
  return {
    id,
    name,
    intro: name,
    instruction: `你是${name}`,
    defaultRuntime: 'claude',
    createdAt: 1,
    updatedAt: 1,
  };
}

describe('detectHandoffTargets', () => {
  it('finds other mentioned roles but not the speaking role', () => {
    const roles = [role('design', '设计师'), role('engineer', '工程师')];
    expect(
      detectHandoffTargets({
        text: '@设计师 我补充一下。建议 @工程师 接着看实现。',
        roles,
        fromRoleId: 'design',
      }).map((item) => item.id),
    ).toEqual(['engineer']);
  });
});
