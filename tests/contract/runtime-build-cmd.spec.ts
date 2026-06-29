import { describe, expect, it } from 'vitest';
import { buildCmd } from '../../src/app/main/runtime-session';

/**
 * buildCmd 契约测试（spec agent-model-picker Task 3）。
 *
 * 不变量：
 *  1. model / effort 永远作为**独立 argv 元素**传入（命令注入零容忍）
 *  2. 未传对应字段时不注入 flag，保证老会话零回退
 *  3. effort 仅对 codex 生效，claude 忽略
 */
describe('buildCmd · codex', () => {
  it('no model/effort → 现状 argv', () => {
    const { bin, args, stdin } = buildCmd('codex', 'hello');
    expect(bin).toBe('codex');
    expect(args).toEqual(['exec', '--json', '--skip-git-repo-check', '-']);
    expect(stdin).toBe('hello');
  });

  it('with model only → 注入 --model，但不注入 effort', () => {
    const { args } = buildCmd('codex', 'hi', { model: 'gpt-5.5' });
    expect(args).toEqual(['exec', '--model', 'gpt-5.5', '--json', '--skip-git-repo-check', '-']);
  });

  it('with effort only → 注入 -c model_reasoning_effort=<level>', () => {
    const { args } = buildCmd('codex', 'hi', { effort: 'high' });
    expect(args).toEqual([
      'exec',
      '-c',
      'model_reasoning_effort=high',
      '--json',
      '--skip-git-repo-check',
      '-',
    ]);
  });

  it('with model + effort → 精确位置顺序 & 独立 argv 元素', () => {
    const { args } = buildCmd('codex', 'hi', { model: 'gpt-5.3-codex', effort: 'minimal' });
    expect(args).toEqual([
      'exec',
      '--model',
      'gpt-5.3-codex',
      '-c',
      'model_reasoning_effort=minimal',
      '--json',
      '--skip-git-repo-check',
      '-',
    ]);
    // 命令注入防线：每个 arg 不含 shell 特殊字符拼接
    for (const a of args) expect(a).not.toMatch(/[\s`$;&|]/);
  });
});

describe('buildCmd · claude', () => {
  it('no model → 现状 argv（prompt 通过 -p）', () => {
    const { bin, args, stdin } = buildCmd('claude', 'hello');
    expect(bin).toBe('claude');
    expect(args).toEqual([
      '-p',
      'hello',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
    ]);
    expect(stdin).toBeNull();
  });

  it('with model → --model 放在 argv 前部，独立元素', () => {
    const { args } = buildCmd('claude', 'hi', { model: 'opus' });
    expect(args).toEqual([
      '--model',
      'opus',
      '-p',
      'hi',
      '--output-format',
      'stream-json',
      '--include-partial-messages',
      '--verbose',
    ]);
  });

  it('effort 对 claude 无效（不出现在 argv 任何位置）', () => {
    const { args } = buildCmd('claude', 'hi', { model: 'sonnet', effort: 'high' });
    expect(args.join(' ')).not.toContain('model_reasoning_effort');
    expect(args.join(' ')).not.toContain('high');
  });
});
