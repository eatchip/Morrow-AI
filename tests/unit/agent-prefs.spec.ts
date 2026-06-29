import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  AGENT_PREFS_STORAGE_KEY,
  DEFAULT_AGENT_PREFS,
  loadPrefs,
  prefsForRuntime,
  sanitizePrefs,
  savePrefs,
} from '../../src/app/renderer/src/lib/agent-prefs';

describe('agent-prefs · sanitizePrefs', () => {
  it('non-object input → default', () => {
    expect(sanitizePrefs(null)).toEqual(DEFAULT_AGENT_PREFS);
    expect(sanitizePrefs(undefined)).toEqual(DEFAULT_AGENT_PREFS);
    expect(sanitizePrefs('x')).toEqual(DEFAULT_AGENT_PREFS);
    expect(sanitizePrefs(42)).toEqual(DEFAULT_AGENT_PREFS);
    expect(sanitizePrefs([])).toEqual(DEFAULT_AGENT_PREFS);
  });

  it('missing sub-keys → default for that sub-key', () => {
    expect(sanitizePrefs({})).toEqual(DEFAULT_AGENT_PREFS);
    expect(sanitizePrefs({ codex: {} })).toEqual(DEFAULT_AGENT_PREFS);
    expect(sanitizePrefs({ claude: {} })).toEqual(DEFAULT_AGENT_PREFS);
  });

  it('illegal codex.model falls back to default, other valid fields preserved', () => {
    const got = sanitizePrefs({ codex: { model: '; rm -rf /', effort: 'high' } });
    expect(got.codex.model).toBe(DEFAULT_AGENT_PREFS.codex.model);
    expect(got.codex.effort).toBe('high');
  });

  it('illegal effort falls back; valid model preserved', () => {
    const got = sanitizePrefs({ codex: { model: 'gpt-5.5', effort: 'turbo' } });
    expect(got.codex.model).toBe('gpt-5.5');
    expect(got.codex.effort).toBe(DEFAULT_AGENT_PREFS.codex.effort);
  });

  it('illegal claude.model falls back', () => {
    const got = sanitizePrefs({ claude: { model: 'banana' } });
    expect(got.claude.model).toBe(DEFAULT_AGENT_PREFS.claude.model);
  });

  it('all-valid payload is preserved', () => {
    const input = {
      codex: { model: 'gpt-5.3-codex', effort: 'minimal' },
      claude: { model: 'opus' },
    };
    expect(sanitizePrefs(input)).toEqual(input);
  });
});

describe('agent-prefs · load/save roundtrip', () => {
  beforeEach(() => {
    globalThis.localStorage?.clear();
  });
  afterEach(() => {
    globalThis.localStorage?.clear();
  });

  it('no stored value → default', () => {
    expect(loadPrefs()).toEqual(DEFAULT_AGENT_PREFS);
  });

  it('malformed JSON → default', () => {
    globalThis.localStorage.setItem(AGENT_PREFS_STORAGE_KEY, '{not-json');
    expect(loadPrefs()).toEqual(DEFAULT_AGENT_PREFS);
  });

  it('save → load roundtrip', () => {
    const input = {
      codex: { model: 'gpt-5.5' as const, effort: 'xhigh' as const },
      claude: { model: 'opus' as const },
    };
    savePrefs(input);
    expect(loadPrefs()).toEqual(input);
  });
});

describe('agent-prefs · prefsForRuntime', () => {
  it('codex includes effort', () => {
    expect(prefsForRuntime(DEFAULT_AGENT_PREFS, 'codex')).toEqual({
      model: DEFAULT_AGENT_PREFS.codex.model,
      effort: DEFAULT_AGENT_PREFS.codex.effort,
    });
  });

  it('claude omits effort', () => {
    const out = prefsForRuntime(DEFAULT_AGENT_PREFS, 'claude');
    expect(out).toEqual({ model: DEFAULT_AGENT_PREFS.claude.model });
    expect('effort' in out).toBe(false);
  });
});
