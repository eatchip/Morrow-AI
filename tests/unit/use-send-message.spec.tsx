/** @vitest-environment happy-dom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Conversation } from '../../src/app/renderer/src/components/Sidebar';
import { DEFAULT_AGENT_PREFS } from '../../src/app/renderer/src/lib/agent-prefs';
import {
  useSendMessage,
  type StreamingRegistry,
} from '../../src/app/renderer/src/lib/use-send-message';

vi.mock('../../src/app/renderer/src/lib/stream', async () => {
  const actual = await vi.importActual<typeof import('../../src/app/renderer/src/lib/stream')>(
    '../../src/app/renderer/src/lib/stream',
  );
  return {
    ...actual,
    newSessionId: vi.fn(() => 'sid-new'),
  };
});

function makeConv(id: string, messages: Conversation['messages'] = [], draft = ''): Conversation {
  return {
    id,
    title: id,
    runtime: 'codex',
    messages,
    draft,
    createdAt: 1,
    updatedAt: 1,
    projectId: null,
  };
}

function renderSendHook(args: {
  activeId: string | null;
  conversations: Conversation[];
  registry: StreamingRegistry;
}) {
  let state = args.conversations;
  const sendPrompt = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(window, 'morrowApi', {
    value: { sendPrompt },
    configurable: true,
  });
  const setConversations = vi.fn((action) => {
    state = typeof action === 'function' ? action(state) : action;
  });
  const createConversation = vi.fn(() => 'created');
  const setActiveIdWithEviction = vi.fn();
  const setChatScene = vi.fn();
  const streamingRef = { current: args.registry };

  const hook = renderHook(() =>
    useSendMessage({
      current: 'codex',
      activeId: args.activeId,
      activeProjectId: null,
      conversations: args.conversations,
      prefs: DEFAULT_AGENT_PREFS,
      createConversation,
      setActiveIdWithEviction,
      setConversations,
      setChatScene,
      streamingRef,
    }),
  );

  return {
    ...hook,
    getState: () => state,
    sendPrompt,
    createConversation,
    setActiveIdWithEviction,
    setChatScene,
    streamingRef,
  };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSendMessage · per-conversation streaming', () => {
  it('allows sending in another conversation while a background conversation is streaming', () => {
    const streamingMessage = {
      id: 'a-ai',
      role: 'ai' as const,
      runtime: 'codex' as const,
      text: '',
      status: 'streaming' as const,
      sessionId: 'sid-a',
    };
    const registry: StreamingRegistry = {
      'sid-a': { convId: 'a', aiId: 'a-ai', sid: 'sid-a' },
    };
    const view = renderSendHook({
      activeId: 'b',
      conversations: [makeConv('a', [streamingMessage]), makeConv('b', [], '待发送草稿')],
      registry,
    });

    act(() => view.result.current('现在就能发了'));

    expect(view.sendPrompt).toHaveBeenCalledTimes(1);
    expect(view.sendPrompt).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: '现在就能发了',
        conversationId: 'b',
        sessionId: 'sid-new',
      }),
    );
    expect(view.streamingRef.current['sid-a']).toEqual(registry['sid-a']);
    expect(view.streamingRef.current['sid-new']).toEqual({
      convId: 'b',
      aiId: expect.stringMatching(/^a-/),
      sid: 'sid-new',
    });
    expect(view.getState().find((c) => c.id === 'b')?.draft).toBe('');
    expect(
      view
        .getState()
        .find((c) => c.id === 'b')
        ?.messages.map((m) => m.role),
    ).toEqual(['user', 'ai']);
    expect(view.setActiveIdWithEviction).toHaveBeenCalledWith('b');
    expect(view.setChatScene).toHaveBeenCalledTimes(1);
  });

  it('blocks sending again in the same conversation while it is streaming', () => {
    const streamingMessage = {
      id: 'a-ai',
      role: 'ai' as const,
      runtime: 'codex' as const,
      text: '',
      status: 'streaming' as const,
      sessionId: 'sid-a',
    };
    const registry: StreamingRegistry = {
      'sid-a': { convId: 'a', aiId: 'a-ai', sid: 'sid-a' },
    };
    const view = renderSendHook({
      activeId: 'a',
      conversations: [makeConv('a', [streamingMessage], '追问草稿')],
      registry,
    });

    act(() => view.result.current('不要发出去'));

    expect(view.sendPrompt).not.toHaveBeenCalled();
    expect(view.streamingRef.current).toEqual(registry);
    expect(view.getState()).toEqual([makeConv('a', [streamingMessage], '追问草稿')]);
    expect(view.setActiveIdWithEviction).not.toHaveBeenCalled();
    expect(view.setChatScene).not.toHaveBeenCalled();
  });
});
