import { useState } from 'react';
import { TerminalPane } from './TerminalPane';

interface Props {
  sessionId: string | null;
  starting: boolean;
}

export function AgentTerminalLog({ sessionId, starting }: Props) {
  const [rawOpen, setRawOpen] = useState(false);
  if (!sessionId && !starting) return null;

  return (
    <div className="terminal-log" data-testid="terminal-log">
      {starting ? (
        <div className="agent-status-card">
          正在启动终端日志
          <span className="typing" />
        </div>
      ) : null}
      {sessionId ? (
        <>
          <button
            type="button"
            className="terminal-log-toggle"
            data-testid="terminal-log-toggle"
            onClick={() => setRawOpen((v) => !v)}
          >
            {rawOpen ? '隐藏终端日志' : '查看终端日志'}
          </button>
          {rawOpen ? (
            <div className="terminal-log-pane">
              <TerminalPane sessionId={sessionId} readOnly />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
