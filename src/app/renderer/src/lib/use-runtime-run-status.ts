import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import type { RuntimeRunEvent } from '../../../../shared/ipc';
import type { RunStatusView } from '../components/RunStatusPanel';
import type { Conversation } from '../components/Sidebar';
import type { Msg } from '../screens/Chat';
import { liveTextStore } from './live-text-store';
import { useStream } from './stream';
import type { StreamingRef } from './use-send-message';

type RunViews = Record<string, RunStatusView>;

type StreamSettlement = { status: 'done' } | { status: 'error'; message: string };

interface UseRuntimeRunStatusArgs {
  activeConversationId: string | null;
  conversations: Conversation[];
  restartRuntime: () => void;
  send: (text: string) => void;
  setConversations: Dispatch<SetStateAction<Conversation[]>>;
  streamingRef: StreamingRef;
}

export interface RuntimeRunStatusHandlers {
  activeRunStatus: RunStatusView | null;
  onCancelRun: (runId: string) => void;
  onRetryRun: (runId: string) => void;
  onRestartRuntime: (runId: string) => void;
}

function reduceRunViews(prev: RunViews, event: RuntimeRunEvent): RunViews {
  if (event.kind === 'run-started') {
    return {
      ...prev,
      [event.run.runId]: {
        runId: event.run.runId,
        conversationId: event.run.conversationId,
        status: event.run.status,
        tone: 'active',
        title: 'Codex 正在运行',
        detail: '已发送请求，正在等待运行反馈。',
        diagnostics: [`created run=${event.run.runId}`],
        canCancel: true,
        canRetry: false,
        canRestart: false,
        updatedAt: event.run.updatedAt,
      },
    };
  }

  const current = prev[event.runId];
  if (!current) return prev;

  if (event.kind === 'run-first-output') {
    return {
      ...prev,
      [event.runId]: {
        ...current,
        tone: 'active',
        title: 'Codex 正在运行',
        detail: event.lane === 'fast' ? '已收到运行活动，正在等待可读回复。' : '正在生成回复。',
        diagnostics: [...current.diagnostics, `first_output lane=${event.lane}`],
        updatedAt: event.at,
      },
    };
  }

  if (event.kind === 'deadline') {
    const isHard = event.deadline === 'hard';
    return {
      ...prev,
      [event.runId]: {
        ...current,
        tone: isHard ? 'error' : 'warn',
        title: isHard ? '运行超时' : 'Codex 仍在运行',
        detail:
          event.deadline === 'first-output'
            ? '还没有收到可见输出，可以继续等待或取消。'
            : event.deadline === 'idle'
              ? '已有运行活动，但暂时没有新输出。'
              : '已达到最长等待时间，正在清理本次运行。',
        diagnostics: [...current.diagnostics, `deadline ${event.deadline}`],
        canCancel: !isHard,
        canRetry: isHard,
        canRestart: isHard,
        updatedAt: event.at,
      },
    };
  }

  if (event.kind === 'late-lane-event') {
    return {
      ...prev,
      [event.runId]: {
        ...current,
        diagnostics: [
          ...current.diagnostics,
          `late event ignored: ${event.lane}.${event.laneEventKind}`,
        ],
        updatedAt: Date.now(),
      },
    };
  }

  if (event.kind === 'friendly-chunk') {
    return {
      ...prev,
      [event.runId]: {
        ...current,
        status: 'streaming',
        tone: 'active',
        title: 'Codex 正在回复',
        detail: '正在接收结构化回复。',
        updatedAt: event.at,
      },
    };
  }

  if (event.kind === 'run-settled') {
    if (event.status === 'done') {
      const next = { ...prev };
      delete next[event.runId];
      return next;
    }
    return {
      ...prev,
      [event.runId]: {
        ...current,
        status: event.status,
        tone: event.status === 'canceled' ? 'warn' : 'error',
        title: event.status === 'canceled' ? '本次运行已取消' : '本次运行已停止',
        detail:
          event.status === 'timeout'
            ? '没有收到最终结果。已清理本次运行，可以继续发送。'
            : (event.reason ?? '运行未完成。'),
        diagnostics: [...current.diagnostics, `settled status=${event.status}`],
        canCancel: false,
        canRetry: true,
        canRestart: event.status !== 'canceled',
        updatedAt: event.at,
      },
    };
  }

  return prev;
}

function selectActiveRunStatus(runViews: RunViews, activeConversationId: string | null) {
  if (!activeConversationId) return null;
  return (
    Object.values(runViews)
      .filter((run) => run.conversationId === activeConversationId)
      // oxlint-disable-next-line unicorn/no-array-sort -- TS target does not include ES2023 toSorted.
      .sort((a, b) => a.updatedAt - b.updatedAt)
      .at(-1) ?? null
  );
}

function messageForTerminalEvent(event: Extract<RuntimeRunEvent, { kind: 'run-settled' }>) {
  if (event.status === 'timeout') {
    return '等待运行结果超时，已停止等待。请稍后重试，或切换另一个模型。';
  }
  if (event.status === 'canceled') return '本次运行已取消。';
  return event.reason ?? '运行失败。';
}

export function useRuntimeRunStatus({
  activeConversationId,
  conversations,
  restartRuntime,
  send,
  setConversations,
  streamingRef,
}: UseRuntimeRunStatusArgs): RuntimeRunStatusHandlers {
  const [runViews, setRunViews] = useState<RunViews>({});

  const settleStreamingMessage = useCallback(
    (sessionId: string, settle: StreamSettlement) => {
      const ref = streamingRef.current[sessionId];
      if (!ref) return;
      const buffered = liveTextStore.consume(ref.sid);
      delete streamingRef.current[sessionId];
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== ref.convId) return c;
          const nextMsgs = c.messages.map((m) => {
            if (m.id !== ref.aiId) return m;
            const msg = { ...m } as Msg;
            msg.text = (msg.text ?? '') + buffered;
            if (settle.status === 'done') {
              msg.status = 'done';
            } else {
              msg.status = 'error';
              msg.text = (msg.text ? msg.text + '\n' : '') + settle.message;
            }
            msg.sessionId = undefined;
            return msg;
          });
          return { ...c, messages: nextMsgs, updatedAt: Date.now() };
        }),
      );
    },
    [setConversations, streamingRef],
  );

  useStream((e) => {
    const ref = streamingRef.current[e.sessionId];
    if (!ref) return;
    if (e.kind === 'chunk') {
      liveTextStore.append(ref.sid, e.text);
      return;
    }
    settleStreamingMessage(
      e.sessionId,
      e.kind === 'done' ? { status: 'done' } : { status: 'error', message: e.message },
    );
  });

  const updateRunView = useCallback((event: RuntimeRunEvent) => {
    setRunViews((prev) => reduceRunViews(prev, event));
  }, []);

  useEffect(() => {
    const off = window.morrowApi.onRunEvent((event: RuntimeRunEvent) => {
      updateRunView(event);
      if (event.kind !== 'run-settled' || event.status === 'done') return;
      settleStreamingMessage(event.runId, {
        status: 'error',
        message: messageForTerminalEvent(event),
      });
    });
    return () => off();
  }, [settleStreamingMessage, updateRunView]);

  const onCancelRun = useCallback((runId: string) => {
    void window.morrowApi.cancelRun(runId);
  }, []);

  const onRetryRun = useCallback(
    (runId: string) => {
      const run = runViews[runId];
      if (!run || activeConversationId !== run.conversationId) return;
      const conv = conversations.find((item) => item.id === run.conversationId);
      // oxlint-disable-next-line unicorn/no-array-reverse -- TS target does not include ES2023 toReversed.
      const lastUser = [...(conv?.messages ?? [])].reverse().find((m) => m.role === 'user');
      if (!lastUser) return;
      setRunViews((prev) => {
        const next = { ...prev };
        delete next[runId];
        return next;
      });
      send(lastUser.text);
    },
    [activeConversationId, conversations, runViews, send],
  );

  const onRestartRuntime = useCallback(
    (runId: string) => {
      void window.morrowApi.cancelRun(runId);
      restartRuntime();
    },
    [restartRuntime],
  );

  const activeRunStatus = useMemo(
    () => selectActiveRunStatus(runViews, activeConversationId),
    [activeConversationId, runViews],
  );

  return { activeRunStatus, onCancelRun, onRetryRun, onRestartRuntime };
}
