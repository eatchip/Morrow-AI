import { describe, expect, it } from 'vitest';
import {
  mergedRuntimeEnv,
  sanitizedRuntimeEnv,
  shouldStripRuntimeEnv,
} from '../../src/app/main/runtime-env';

describe('runtime env isolation', () => {
  it('strips parent-agent auth and control variables', () => {
    const env = sanitizedRuntimeEnv({
      PATH: '/usr/bin',
      HOME: '/Users/example',
      ELECTRON_RUN_AS_NODE: '1',
      ANTHROPIC_AUTH_TOKEN: 'parent-token',
      ANTHROPIC_BASE_URL: 'https://parent.example',
      ANTHROPIC_MODEL: 'parent-model',
      CODEX_CI: '1',
      CODEX_SANDBOX_NETWORK_DISABLED: '1',
      CODEX_SHELL: '/bin/zsh',
      CODEX_THREAD_ID: 'thread-parent',
      CODEX_INTERNAL_ORIGINATOR_OVERRIDE: 'parent',
      CODEX_REMOTE_AUTH: 'parent',
    });

    expect(env).toMatchObject({ PATH: '/usr/bin', HOME: '/Users/example' });
    expect(env).not.toHaveProperty('ELECTRON_RUN_AS_NODE');
    expect(env).not.toHaveProperty('ANTHROPIC_AUTH_TOKEN');
    expect(env).not.toHaveProperty('ANTHROPIC_BASE_URL');
    expect(env).not.toHaveProperty('ANTHROPIC_MODEL');
    expect(env).not.toHaveProperty('CODEX_CI');
    expect(env).not.toHaveProperty('CODEX_SANDBOX_NETWORK_DISABLED');
    expect(env).not.toHaveProperty('CODEX_SHELL');
    expect(env).not.toHaveProperty('CODEX_THREAD_ID');
    expect(env).not.toHaveProperty('CODEX_INTERNAL_ORIGINATOR_OVERRIDE');
    expect(env).not.toHaveProperty('CODEX_REMOTE_AUTH');
  });

  it('preserves normal user shell and explicit API-key variables', () => {
    const env = sanitizedRuntimeEnv({
      PATH: '/opt/homebrew/bin:/usr/bin',
      HOME: '/Users/example',
      SHELL: '/bin/zsh',
      TERM_PROGRAM: 'iTerm.app',
      ANTHROPIC_API_KEY: 'user-anthropic-key',
      OPENAI_API_KEY: 'user-openai-key',
      CODEX_HOME: '/Users/example/.codex',
    });

    expect(env).toEqual({
      PATH: '/opt/homebrew/bin:/usr/bin',
      HOME: '/Users/example',
      SHELL: '/bin/zsh',
      TERM_PROGRAM: 'iTerm.app',
      ANTHROPIC_API_KEY: 'user-anthropic-key',
      OPENAI_API_KEY: 'user-openai-key',
      CODEX_HOME: '/Users/example/.codex',
    });
  });

  it('strips unsafe extra env overrides after merging', () => {
    const env = mergedRuntimeEnv({
      SAFE_RUNTIME_FLAG: '1',
      CODEX_THREAD_ID: 'from-extra',
      ANTHROPIC_AUTH_TOKEN: 'from-extra',
    });

    expect(env.SAFE_RUNTIME_FLAG).toBe('1');
    expect(env).not.toHaveProperty('CODEX_THREAD_ID');
    expect(env).not.toHaveProperty('ANTHROPIC_AUTH_TOKEN');
  });

  it('keeps the denylist explicit', () => {
    expect(shouldStripRuntimeEnv('CODEX_INTERNAL_ORIGINATOR_OVERRIDE')).toBe(true);
    expect(shouldStripRuntimeEnv('CODEX_HOME')).toBe(false);
    expect(shouldStripRuntimeEnv('OPENAI_API_KEY')).toBe(false);
  });
});
