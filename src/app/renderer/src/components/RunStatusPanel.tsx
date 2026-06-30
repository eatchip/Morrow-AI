import { useState } from 'react';
import type { RuntimeRunStatus } from '../../../../shared/ipc';

export interface RunStatusView {
  runId: string;
  conversationId: string;
  status: RuntimeRunStatus;
  tone: 'active' | 'warn' | 'error';
  title: string;
  detail: string;
  diagnostics: string[];
  canCancel: boolean;
  canRetry: boolean;
  canRestart: boolean;
  updatedAt: number;
}

interface Props {
  run: RunStatusView | null;
  onCancel: (runId: string) => void;
  onRetry: (runId: string) => void;
  onRestart: (runId: string) => void;
}

export function RunStatusPanel({ run, onCancel, onRetry, onRestart }: Props) {
  const [open, setOpen] = useState(false);
  if (!run || run.status === 'done') return null;
  const dotClass = `run-status-dot ${run.tone}`;
  return (
    <div className={`run-status ${run.tone}`} data-testid="run-status">
      <div className="run-status-main">
        <div className="run-status-copy">
          <div className="run-status-title">
            <span className={dotClass} />
            <span>{run.title}</span>
          </div>
          <div className="run-status-detail">{run.detail}</div>
        </div>
        <div className="run-status-actions">
          {run.canRetry ? (
            <button type="button" className="run-status-primary" onClick={() => onRetry(run.runId)}>
              重试
            </button>
          ) : null}
          {run.canRestart ? (
            <button type="button" onClick={() => onRestart(run.runId)}>
              重启 runtime
            </button>
          ) : null}
          {run.canCancel ? (
            <button type="button" className="run-status-danger" onClick={() => onCancel(run.runId)}>
              取消
            </button>
          ) : null}
          {run.diagnostics.length > 0 ? (
            <button type="button" onClick={() => setOpen((value) => !value)}>
              {open ? '隐藏诊断' : '诊断'}
            </button>
          ) : null}
        </div>
      </div>
      {open ? <pre className="run-status-log">{run.diagnostics.join('\n')}</pre> : null}
    </div>
  );
}
