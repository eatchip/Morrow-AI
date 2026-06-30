import { describe, expect, it } from 'vitest';
import { parseClaudeLine, parseCodexLine } from '../../src/app/main/runtime-session';

describe('parseClaudeLine', () => {
  it('extracts text from assistant event with content[].text', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world' },
        ],
      },
    });
    expect(parseClaudeLine(line)).toBe('Hello world');
  });

  it('returns null for system init event', () => {
    const line = JSON.stringify({ type: 'system', subtype: 'init' });
    expect(parseClaudeLine(line)).toBeNull();
  });

  it('returns null for assistant event with non-text content', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 'x' }] },
    });
    expect(parseClaudeLine(line)).toBe('');
  });

  it('surfaces [error] prefix for result with is_error:true', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: true,
      result: 'Not logged in · Please run /login',
    });
    expect(parseClaudeLine(line)).toMatch(/^\n\[error\] Not logged in/);
  });

  it('returns raw line for non-JSON input (fallback passthrough)', () => {
    expect(parseClaudeLine('garbage not json')).toBe('garbage not json');
  });

  it('ignores result with is_error:false', () => {
    const line = JSON.stringify({ type: 'result', is_error: false, result: 'done' });
    expect(parseClaudeLine(line)).toBeNull();
  });
});

describe('parseCodexLine', () => {
  it('extracts delta from agent_message_delta', () => {
    const line = JSON.stringify({ msg: { type: 'agent_message_delta', delta: 'Hi' } });
    expect(parseCodexLine(line)).toBe('Hi');
  });

  it('returns empty string for agent_message (dedup with delta)', () => {
    const line = JSON.stringify({ msg: { type: 'agent_message', message: 'done' } });
    expect(parseCodexLine(line)).toBe('');
  });

  it('surfaces error message', () => {
    const line = JSON.stringify({ msg: { type: 'error', message: 'auth failed' } });
    expect(parseCodexLine(line)).toMatch(/^\n\[error\] auth failed/);
  });

  it('returns null for unknown event', () => {
    const line = JSON.stringify({ msg: { type: 'task_started' } });
    expect(parseCodexLine(line)).toBeNull();
  });

  it('ignores non-JSON input from codex exec fallback', () => {
    expect(parseCodexLine('hello bare text')).toBeNull();
  });

  it('handles flat { type, delta } shape (fallback)', () => {
    const line = JSON.stringify({ type: 'agent_message_delta', delta: 'x' });
    expect(parseCodexLine(line)).toBe('x');
  });

  // codex-cli 0.128+ schema: 顶层 type, item.completed 承载 agent_message
  it('extracts text from new-schema item.completed + agent_message', () => {
    const line = JSON.stringify({
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'pong' },
    });
    expect(parseCodexLine(line)).toBe('pong');
  });

  it('surfaces [error] prefix for new-schema item.completed + error', () => {
    const line = JSON.stringify({
      type: 'item.completed',
      item: { type: 'error', message: 'rate limited' },
    });
    expect(parseCodexLine(line)).toMatch(/^\n\[error\] rate limited/);
  });

  it('returns null for new-schema lifecycle events (thread/turn)', () => {
    expect(parseCodexLine(JSON.stringify({ type: 'thread.started', thread_id: 'x' }))).toBeNull();
    expect(parseCodexLine(JSON.stringify({ type: 'turn.started' }))).toBeNull();
    expect(parseCodexLine(JSON.stringify({ type: 'turn.completed', usage: {} }))).toBeNull();
  });

  it('surfaces [error] prefix for top-level type:"error" (defensive)', () => {
    const line = JSON.stringify({ type: 'error', message: 'boom' });
    expect(parseCodexLine(line)).toMatch(/^\n\[error\] boom/);
  });
});
