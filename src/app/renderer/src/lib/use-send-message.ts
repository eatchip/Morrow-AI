import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from 'react';
import type { RuntimeId } from '../../../../shared/ipc';
import type { Conversation } from '../components/Sidebar';
import type { Msg } from '../screens/Chat';
import { prefsForRuntime, type AgentPrefs } from './agent-prefs';
import { deriveConversationTitle } from './conversations';
import { liveTextStore } from './live-text-store';
import { newSessionId } from './stream';

export interface StreamingTarget {
  convId: string;
  aiId: string;
  sid: string;
}

export type StreamingRegistry = Record<string, StreamingTarget>;
export type StreamingRef = MutableRefObject<StreamingRegistry>;

interface UseSendMessageArgs {
  current: RuntimeId | null;
  activeId: string | null;
  activeProjectId: string | null;
  conversations: Conversation[];
  prefs: AgentPrefs;
  createConversation: (draft?: string) => string;
  setActiveIdWithEviction: (nextId: string | null) => void;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  setChatScene: () => void;
  streamingRef: StreamingRef;
}

export function hasStreamingConversation(
  conversations: Conversation[],
  convId: string,
  registry: StreamingRegistry,
): boolean {
  if (Object.values(registry).some((entry) => entry.convId === convId)) return true;
  const conv = conversations.find((c) => c.id === convId);
  return conv?.messages.some((m) => m.role === 'ai' && m.status === 'streaming') ?? false;
}

export function removeStreamingForConversation(registry: StreamingRegistry, convId: string): void {
  for (const [sid, target] of Object.entries(registry)) {
    if (target.convId !== convId) continue;
    delete registry[sid];
    liveTextStore.drop(sid);
  }
}

export function useSendMessage({
  current,
  activeId,
  activeProjectId,
  conversations,
  prefs,
  createConversation,
  setActiveIdWithEviction,
  setConversations,
  setChatScene,
  streamingRef,
}: UseSendMessageArgs): (text: string) => void {
  return useCallback(
    (text: string) => {
      if (!current) return;
      const targetId = activeId ?? createConversation();
      if (hasStreamingConversation(conversations, targetId, streamingRef.current)) return;
      const userId = `u-${Date.now().toString(36)}`;
      const aiId = `a-${Date.now().toString(36)}`;
      const sid = newSessionId();
      const now = Date.now();
      const existingConv = conversations.find((c) => c.id === targetId) ?? null;
      const targetRuntime = existingConv?.runtime ?? current;
      const isFirstUserMsg = !(existingConv?.messages.some((m) => m.role === 'user') ?? false);
      const stampedProjectId = isFirstUserMsg ? activeProjectId : (existingConv?.projectId ?? null);

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== targetId) return c;
          const nextMessages: Msg[] = [
            ...c.messages,
            { id: userId, role: 'user', text },
            {
              id: aiId,
              role: 'ai',
              runtime: targetRuntime,
              text: '',
              status: 'streaming',
              sessionId: sid,
            },
          ];
          return {
            ...c,
            title: isFirstUserMsg ? deriveConversationTitle(text) : c.title,
            runtime: c.runtime ?? targetRuntime,
            projectId: stampedProjectId,
            ptyStarting: false,
            draft: '',
            messages: nextMessages,
            updatedAt: now,
          };
        }),
      );
      setActiveIdWithEviction(targetId);
      setChatScene();
      const runtimePrefs = prefsForRuntime(prefs, targetRuntime);

      const failStatic = (message: string): void => {
        delete streamingRef.current[sid];
        const buffered = liveTextStore.consume(sid);
        setConversations((prev) =>
          prev.map((c) =>
            c.id === targetId
              ? {
                  ...c,
                  ptyStarting: false,
                  messages: c.messages.map((m) =>
                    m.id === aiId
                      ? {
                          ...m,
                          text: [m.text ?? '', buffered, message].filter(Boolean).join('\n'),
                          status: 'error',
                          sessionId: undefined,
                        }
                      : m,
                  ),
                  updatedAt: Date.now(),
                }
              : c,
          ),
        );
      };

      streamingRef.current[sid] = { convId: targetId, aiId, sid };
      void window.morrowApi
        .sendPrompt({
          runtime: targetRuntime,
          prompt: text,
          sessionId: sid,
          projectId: stampedProjectId,
          conversationId: targetId,
          model: runtimePrefs.model,
          effort: runtimePrefs.effort,
        })
        .catch((error) => failStatic(`${targetRuntime} failed: ${String(error)}`));
    },
    [
      current,
      activeId,
      activeProjectId,
      conversations,
      createConversation,
      prefs,
      setActiveIdWithEviction,
      setChatScene,
      setConversations,
      streamingRef,
    ],
  );
}
