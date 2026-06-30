interface Props {
  onRecheck: () => void;
}

export function Install({ onRecheck }: Props) {
  return (
    <div className="install">
      <h2>Morrow 需要至少一个 AI CLI</h2>
      <div className="sub">
        Morrow 只是前端驾驶舱——背后真正干活的是你本机已装的 Claude Code 或 Codex CLI。
        装好其中任意一个后重新检测即可继续。
      </div>
      <div className="install-cards">
        <div className="install-card claude">
          <div className="logo">C</div>
          <div className="name">Claude Code</div>
          <div className="by">by Anthropic</div>
          <div className="desc">
            擅长长上下文、多文件重构、仓库级理解。
            <br />
            <code>npm i -g @anthropic-ai/claude-code</code>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() =>
              window.open('https://docs.anthropic.com/claude/docs/claude-code', '_blank')
            }
          >
            查看安装指南
          </button>
        </div>
        <div className="install-card codex">
          <div className="logo">C</div>
          <div className="name">Codex CLI</div>
          <div className="by">by OpenAI</div>
          <div className="desc">
            快速、最小，适合 shell 自动化与工具调用。
            <br />
            <code>npm i -g @openai/codex</code>
          </div>
          <button
            type="button"
            className="btn primary"
            onClick={() => window.open('https://github.com/openai/codex', '_blank')}
          >
            查看安装指南
          </button>
        </div>
      </div>
      <button type="button" className="btn" onClick={onRecheck}>
        重新检测
      </button>
    </div>
  );
}
