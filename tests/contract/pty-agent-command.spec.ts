import { describe, expect, it } from 'vitest';
import { buildCodexPtyCommand } from '../../src/app/main/pty-agent-command';

describe('buildCodexPtyCommand', () => {
  it('builds interactive codex argv with cwd, model, effort and prompt', () => {
    expect(
      buildCodexPtyCommand({
        cwd: '/tmp/project',
        prompt: 'hello',
        model: 'gpt-5.5',
        effort: 'xhigh',
      }),
    ).toEqual({
      command: 'codex',
      args: [
        '-C',
        '/tmp/project',
        '--model',
        'gpt-5.5',
        '-c',
        'model_reasoning_effort=xhigh',
        'hello',
      ],
    });
  });

  it('inserts argv terminator when prompt starts with a dash', () => {
    expect(
      buildCodexPtyCommand({
        cwd: '/tmp/project',
        prompt: '--explain-this',
      }).args,
    ).toEqual(['-C', '/tmp/project', '--', '--explain-this']);
  });
});
