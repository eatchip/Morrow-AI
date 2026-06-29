import type { AgentApprovalPrompt } from '../lib/agent-transcript';

interface Props {
  prompt: AgentApprovalPrompt;
  onApprove: () => void;
  onReject: () => void;
}

export function ApprovalPromptBar({ prompt, onApprove, onReject }: Props) {
  return (
    <div
      className="approval-prompt"
      data-testid="approval-prompt"
      role="group"
      aria-label="Codex 请求确认"
    >
      <div className="approval-copy">
        <div className="approval-title">{prompt.title}</div>
        <div className="approval-detail">{prompt.command ?? '需要你的确认后继续'}</div>
      </div>
      <div className="approval-actions">
        <button
          type="button"
          className="approval-allow"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onApprove}
        >
          允许本次
        </button>
        <button
          type="button"
          className="approval-reject"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onReject}
        >
          拒绝
        </button>
      </div>
    </div>
  );
}
