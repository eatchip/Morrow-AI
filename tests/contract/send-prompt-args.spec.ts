import { describe, expect, it } from 'vitest';
import { validateRunId, validateSendPromptArgs } from '../../src/app/main/ipc-validate';

/**
 * SendPromptArgs 边界校验契约测试（spec agent-model-picker Task 4）。
 *
 * 这是 renderer → main 的信任边界，防御命令注入的唯一事实来源。
 */
describe('validateSendPromptArgs · 合法', () => {
  const base = { runtime: 'codex' as const, prompt: 'hi', sessionId: 's1' };

  it('最小合法请求（不带 model/effort）', () => {
    expect(validateSendPromptArgs(base)).toBe(true);
  });

  it('合法 model + effort', () => {
    expect(validateSendPromptArgs({ ...base, model: 'gpt-5.5', effort: 'high' })).toBe(true);
  });

  it('projectId 为 null / 字符串都合法', () => {
    expect(validateSendPromptArgs({ ...base, projectId: null })).toBe(true);
    expect(validateSendPromptArgs({ ...base, projectId: 'p1' })).toBe(true);
  });

  it('claude runtime 合法', () => {
    expect(validateSendPromptArgs({ ...base, runtime: 'claude', model: 'opus' })).toBe(true);
  });
});

describe('validateSendPromptArgs · 非法', () => {
  const base = { runtime: 'codex' as const, prompt: 'hi', sessionId: 's1' };

  it('runtime 缺失', () => {
    expect(validateSendPromptArgs({ prompt: 'hi', sessionId: 's1' })).toBe(false);
  });

  it('runtime 非枚举', () => {
    expect(validateSendPromptArgs({ ...base, runtime: 'gpt' })).toBe(false);
  });

  it('prompt 空字符串', () => {
    expect(validateSendPromptArgs({ ...base, prompt: '' })).toBe(false);
  });

  it('sessionId 空字符串', () => {
    expect(validateSendPromptArgs({ ...base, sessionId: '' })).toBe(false);
  });

  it('projectId 非字符串类型', () => {
    expect(validateSendPromptArgs({ ...base, projectId: 123 })).toBe(false);
  });

  // 命令注入防线：所有这些 model 值都必须被拒绝
  it.each([
    ['空格', 'gpt 5'],
    ['反引号', 'gpt`whoami`'],
    ['$()', 'gpt$(whoami)'],
    ['分号', 'gpt;rm'],
    ['管道', 'gpt|cat'],
    ['换行', 'gpt\nmodel'],
    ['> 64 字符', 'a'.repeat(65)],
    ['空字符串', ''],
  ])('model 非法: %s', (_label, bad) => {
    expect(validateSendPromptArgs({ ...base, model: bad })).toBe(false);
  });

  it('model 非字符串', () => {
    expect(validateSendPromptArgs({ ...base, model: 42 })).toBe(false);
  });

  it('effort 非枚举', () => {
    expect(validateSendPromptArgs({ ...base, effort: 'ultra' })).toBe(false);
  });

  it('null / 非对象', () => {
    expect(validateSendPromptArgs(null)).toBe(false);
    expect(validateSendPromptArgs('nope')).toBe(false);
    expect(validateSendPromptArgs(undefined)).toBe(false);
  });
});

describe('validateRunId', () => {
  it('accepts non-empty run ids', () => {
    expect(validateRunId('run-1')).toBe(true);
  });

  it('rejects empty and non-string run ids', () => {
    expect(validateRunId('')).toBe(false);
    expect(validateRunId(1)).toBe(false);
    expect(validateRunId(null)).toBe(false);
  });
});
