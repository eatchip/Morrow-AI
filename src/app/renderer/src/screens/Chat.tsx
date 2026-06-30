import { memo, useEffect, useRef } from 'react';
import type { Project, RuntimeId } from '../../../../shared/ipc';
import { AgentTerminalLog } from '../components/AgentTerminalLog';
import { ApprovalPromptBar } from '../components/ApprovalPromptBar';
import { Composer } from '../components/Composer';
import { ProjectPicker } from '../components/ProjectPicker';
import { RunStatusPanel, type RunStatusView } from '../components/RunStatusPanel';
import { useAgentTerminalSession } from '../lib/agent-transcript';
import { useLiveText } from '../lib/live-text-store';
import type { AgentPrefs } from '../lib/agent-prefs';

export interface Msg {
  id: string;
  role: 'user' | 'ai';
  runtime?: RuntimeId;
  text: string;
  status?: 'streaming' | 'done' | 'error';
  /** 仅 streaming 中的 AI 气泡会带；用于订阅 liveTextStore。完成后清空。 */
  sessionId?: string;
}

interface Props {
  messages: Msg[];
  currentRuntime: RuntimeId;
  streaming: boolean;
  ptySessionId?: string | null;
  ptyStarting?: boolean;
  onSend: (text: string) => void;
  onBack: () => void;
  projects: Project[];
  activeProjectId: string | null;
  pickerLocked: boolean;
  onPickProject: (id: string | null) => void;
  onAddProject: () => void | Promise<void>;
  prefs: AgentPrefs;
  onChangePrefs: (next: AgentPrefs) => void;
  draft: string;
  onDraftChange: (next: string) => void;
  runStatus: RunStatusView | null;
  onCancelRun: (runId: string) => void;
  onRetryRun: (runId: string) => void;
  onRestartRuntime: (runId: string) => void;
}

const MK_LABEL: Record<RuntimeId, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
};

/** 已结算的消息气泡；text 变化才重渲染。 */
const StaticMessage = memo(function StaticMessage({ m }: { m: Msg }) {
  if (m.role === 'user') {
    return <div className="msg-user">{m.text}</div>;
  }
  return (
    <div className="msg-ai">
      <div className="ai-head">
        <span className={`mk ${m.runtime ?? ''}`}>C</span>
        <span>{m.runtime ? MK_LABEL[m.runtime] : ''}</span>
      </div>
      <div className={`ai-body${m.status === 'error' ? ' error' : ''}`}>
        {m.text || (m.status === 'streaming' ? '' : '(no output)')}
        {m.status === 'streaming' ? <span className="typing" /> : null}
      </div>
    </div>
  );
});

/** 正在流式的 AI 气泡；只有它会在 chunk 抵达时重渲染。 */
function StreamingMessage({ m, onTick }: { m: Msg; onTick: () => void }) {
  // 订阅 liveTextStore：chunk 走 rAF 批量合并，React 只收到合批后的增量。
  const live = useLiveText(m.sessionId);
  const combined = (m.text ?? '') + live;
  useEffect(() => {
    onTick();
  }, [combined, onTick]);
  return (
    <div className="msg-ai">
      <div className="ai-head">
        <span className={`mk ${m.runtime ?? ''}`}>C</span>
        <span>{m.runtime ? MK_LABEL[m.runtime] : ''}</span>
      </div>
      <div className={`ai-body${m.status === 'error' ? ' error' : ''}`}>
        {combined}
        <span className="typing" />
      </div>
    </div>
  );
}

export function Chat({
  messages,
  currentRuntime,
  streaming,
  ptySessionId = null,
  ptyStarting = false,
  onSend,
  onBack,
  projects,
  activeProjectId,
  pickerLocked,
  onPickProject,
  onAddProject,
  prefs,
  onChangePrefs,
  draft,
  onDraftChange,
  runStatus,
  onCancelRun,
  onRetryRun,
  onRestartRuntime,
}: Props) {
  const streamRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const terminalSession = useAgentTerminalSession(ptySessionId);
  const lastMessage = messages.at(-1);
  const lastMessageScrollKey = `${lastMessage?.id ?? ''}:${lastMessage?.status ?? ''}:${
    lastMessage?.text.length ?? 0
  }`;

  // rAF 合并滚动：同一帧内多次 tick 只滚一次，避免反复写 scrollTop。
  const scheduleScroll = (): void => {
    if (rafRef.current != null) return;
    const raf =
      typeof requestAnimationFrame === 'function'
        ? requestAnimationFrame
        : (cb: FrameRequestCallback): number =>
            setTimeout(() => cb(performance.now()), 16) as unknown as number;
    rafRef.current = raf(() => {
      rafRef.current = null;
      const el = streamRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  // 消息列表结构变化（新增/结算）时也滚动一次。
  useEffect(() => {
    scheduleScroll();
  }, [
    messages.length,
    lastMessageScrollKey,
    ptySessionId,
    terminalSession.transcript.approval?.id,
  ]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onBack]);

  return (
    <>
      <div className="stream" ref={streamRef}>
        <div className="stream-inner">
          {messages.map((m) =>
            m.role === 'ai' && m.status === 'streaming' && m.sessionId ? (
              <StreamingMessage key={m.id} m={m} onTick={scheduleScroll} />
            ) : (
              <StaticMessage key={m.id} m={m} />
            ),
          )}
          <AgentTerminalLog sessionId={ptySessionId} starting={ptyStarting} />
        </div>
      </div>
      <div className="composer-wrap">
        <div className="composer-stack">
          {terminalSession.transcript.approval ? (
            <ApprovalPromptBar
              prompt={terminalSession.transcript.approval}
              onApprove={terminalSession.approve}
              onReject={terminalSession.reject}
            />
          ) : null}
          <RunStatusPanel
            run={runStatus}
            onCancel={onCancelRun}
            onRetry={onRetryRun}
            onRestart={onRestartRuntime}
          />
          <ProjectPicker
            projects={projects}
            activeProjectId={activeProjectId}
            locked={pickerLocked}
            onSelect={onPickProject}
            onAdd={onAddProject}
          />
          <Composer
            placeholder="继续追问…"
            hint={streaming ? '正在回复 · 完成后可继续发送' : '⏎ 发送 · Shift⏎ 换行 · Esc 返回'}
            runtime={currentRuntime}
            prefs={prefs}
            onChangePrefs={onChangePrefs}
            value={draft}
            onChange={onDraftChange}
            sendDisabled={streaming}
            autoFocus
            onSubmit={onSend}
          />
        </div>
      </div>
    </>
  );
}
