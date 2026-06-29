import { describe, expect, it } from 'vitest';
import {
  assertRoleHasInstruction,
  normalizeChannelName,
  normalizeRoleName,
} from '../../src/contexts/channels/domain/channel-invariants';

describe('channel invariants', () => {
  it('requires role instruction', () => {
    expect(() => assertRoleHasInstruction({ instruction: '  ' })).toThrow(
      /instruction is required/,
    );
  });

  it('normalizes channel and role names', () => {
    expect(normalizeChannelName('##general')).toBe('general');
    expect(normalizeRoleName('  设计师  ')).toBe('设计师');
  });
});
