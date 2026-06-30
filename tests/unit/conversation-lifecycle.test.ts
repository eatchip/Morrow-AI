import { describe, it, expect } from 'vitest';
import {
  evictEmptyOnLeave,
  deleteConversation,
} from '../../src/app/renderer/src/lib/conversations';
import type { Conversation } from '../../src/app/renderer/src/components/Sidebar';

function makeConv(id: string, msgCount = 0, draft = ''): Conversation {
  return {
    id,
    title: id,
    runtime: null,
    messages: Array.from({ length: msgCount }, (_, i) => ({
      id: `${id}-m${i}`,
      role: 'user',
      text: 'hi',
    })),
    createdAt: 0,
    updatedAt: 0,
    projectId: null,
    draft,
  };
}

describe('evictEmptyOnLeave', () => {
  it('removes the previous active conversation when it has no messages', () => {
    const convs = [makeConv('a'), makeConv('b', 1)];
    const next = evictEmptyOnLeave(convs, 'a', 'b');
    expect(next.map((c) => c.id)).toEqual(['b']);
  });

  it('keeps the previous active conversation when it has messages', () => {
    const convs = [makeConv('a', 2), makeConv('b')];
    const next = evictEmptyOnLeave(convs, 'a', 'b');
    expect(next).toBe(convs);
  });

  it('keeps the previous active conversation when it has an unsent draft', () => {
    const convs = [makeConv('a', 0, '为什么这个会报错'), makeConv('b', 1)];
    const next = evictEmptyOnLeave(convs, 'a', 'b');
    expect(next).toBe(convs);
  });

  it('removes the previous active conversation when its draft is blank', () => {
    const convs = [makeConv('a', 0, '   '), makeConv('b', 1)];
    const next = evictEmptyOnLeave(convs, 'a', 'b');
    expect(next.map((c) => c.id)).toEqual(['b']);
  });

  it('is a no-op when prevId equals nextId', () => {
    const convs = [makeConv('a')];
    expect(evictEmptyOnLeave(convs, 'a', 'a')).toBe(convs);
  });

  it('is a no-op when prevId is null', () => {
    const convs = [makeConv('a')];
    expect(evictEmptyOnLeave(convs, null, 'a')).toBe(convs);
  });

  it('is a no-op when prevId is not in conversations', () => {
    const convs = [makeConv('a')];
    expect(evictEmptyOnLeave(convs, 'ghost', 'a')).toBe(convs);
  });
});

describe('deleteConversation', () => {
  it('removes the conversation by id', () => {
    const convs = [makeConv('a'), makeConv('b')];
    const next = deleteConversation(convs, 'a');
    expect(next.map((c) => c.id)).toEqual(['b']);
  });

  it('returns the same reference when id is unknown', () => {
    const convs = [makeConv('a')];
    expect(deleteConversation(convs, 'ghost')).toBe(convs);
  });
});
