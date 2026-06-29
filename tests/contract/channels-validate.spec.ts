import { describe, expect, it } from 'vitest';
import {
  validateAcceptHandoffArgs,
  validateAddRoleToChannelArgs,
  validateCreateChannelArgs,
  validateCreateRoleArgs,
  validateDeleteChannelArgs,
  validateDeleteRoleArgs,
  validatePostChannelMessageArgs,
  validateUpdateRoleArgs,
} from '../../src/app/main/ipc-validate';

describe('channels IPC validation', () => {
  it('validates create channel args', () => {
    expect(validateCreateChannelArgs({ name: 'general', memberRoleIds: ['r1'] })).toBe(true);
    expect(validateCreateChannelArgs({ name: '' })).toBe(false);
    expect(validateCreateChannelArgs({ name: 'x', memberRoleIds: [1] })).toBe(false);
  });

  it('validates create role args with required instruction and runtime', () => {
    const base = {
      name: '设计师',
      intro: '负责界面',
      instruction: '给出建议',
      defaultRuntime: 'claude',
    };
    expect(validateCreateRoleArgs(base)).toBe(true);
    expect(validateCreateRoleArgs({ ...base, instruction: '' })).toBe(false);
    expect(validateCreateRoleArgs({ ...base, defaultRuntime: 'gpt' })).toBe(false);
  });

  it('validates update role args', () => {
    expect(validateUpdateRoleArgs({ roleId: 'r1', instruction: 'new' })).toBe(true);
    expect(validateUpdateRoleArgs({ roleId: 'r1', instruction: '' })).toBe(false);
    expect(validateUpdateRoleArgs({ roleId: '', instruction: 'new' })).toBe(false);
  });

  it('validates channel commands', () => {
    expect(validateAddRoleToChannelArgs({ channelId: 'c1', roleId: 'r1' })).toBe(true);
    expect(validateDeleteChannelArgs({ channelId: 'c1' })).toBe(true);
    expect(validateDeleteChannelArgs({ channelId: '' })).toBe(false);
    expect(validateDeleteRoleArgs({ roleId: 'r1' })).toBe(true);
    expect(validateDeleteRoleArgs({ roleId: '' })).toBe(false);
    expect(validatePostChannelMessageArgs({ channelId: 'c1', text: '@设计师 看看' })).toBe(true);
    expect(validateAcceptHandoffArgs({ channelId: 'c1', handoffId: 'h1' })).toBe(true);
    expect(validatePostChannelMessageArgs({ channelId: 'c1', text: '' })).toBe(false);
  });
});
