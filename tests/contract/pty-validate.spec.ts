import { describe, expect, it } from 'vitest';
import {
  validatePtyAgentStartArgs,
  validatePtyResizeArgs,
  validatePtyWriteArgs,
} from '../../src/app/main/ipc-validate';

describe('PTY IPC validation', () => {
  const startBase = {
    runtime: 'codex' as const,
    prompt: 'hi',
    cols: 120,
    rows: 30,
  };

  it('accepts a valid codex PTY start request', () => {
    expect(
      validatePtyAgentStartArgs({
        ...startBase,
        projectId: 'p1',
        model: 'gpt-5.5',
        effort: 'high',
      }),
    ).toBe(true);
  });

  it('rejects non-codex runtime and unsafe model values', () => {
    expect(validatePtyAgentStartArgs({ ...startBase, runtime: 'claude' })).toBe(false);
    expect(validatePtyAgentStartArgs({ ...startBase, model: 'gpt 5' })).toBe(false);
  });

  it('rejects out-of-range terminal sizes', () => {
    expect(validatePtyAgentStartArgs({ ...startBase, cols: 10 })).toBe(false);
    expect(validatePtyResizeArgs({ sessionId: 's1', cols: 120, rows: 500 })).toBe(false);
  });

  it('validates write payloads', () => {
    expect(validatePtyWriteArgs({ sessionId: 's1', data: 'abc' })).toBe(true);
    expect(validatePtyWriteArgs({ sessionId: 's1', data: 'abc', encoding: 'binary' })).toBe(true);
    expect(validatePtyWriteArgs({ sessionId: '', data: 'abc' })).toBe(false);
    expect(validatePtyWriteArgs({ sessionId: 's1', data: 123 })).toBe(false);
  });

  it('validates resize payloads', () => {
    expect(validatePtyResizeArgs({ sessionId: 's1', cols: 120, rows: 30 })).toBe(true);
    expect(validatePtyResizeArgs({ sessionId: 's1', cols: 0, rows: 30 })).toBe(false);
  });
});
