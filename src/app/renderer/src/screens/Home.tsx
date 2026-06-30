import type { DetectResult, Project, RuntimeId } from '../../../../shared/ipc';
import { Composer } from '../components/Composer';
import { ProjectPicker } from '../components/ProjectPicker';
import type { AgentPrefs } from '../lib/agent-prefs';

interface Props {
  runtimes: DetectResult;
  current: RuntimeId;
  streaming: boolean;
  onPick: (rt: RuntimeId) => void;
  onSend: (text: string) => void;
  projects: Project[];
  activeProjectId: string | null;
  pickerLocked: boolean;
  onPickProject: (id: string | null) => void;
  onAddProject: () => void | Promise<void>;
  prefs: AgentPrefs;
  onChangePrefs: (next: AgentPrefs) => void;
  draft: string;
  onDraftChange: (next: string) => void;
}

const LABEL: Record<RuntimeId, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
};

const BY: Record<RuntimeId, string> = {
  claude: 'Anthropic',
  codex: 'OpenAI',
};

export function Home({
  runtimes,
  current,
  streaming,
  onPick,
  onSend,
  projects,
  activeProjectId,
  pickerLocked,
  onPickProject,
  onAddProject,
  prefs,
  onChangePrefs,
  draft,
  onDraftChange,
}: Props) {
  return (
    <div className="home">
      <div className="hero">
        我们该做什么？
        <span className="caret" />
      </div>
      <ProjectPicker
        projects={projects}
        activeProjectId={activeProjectId}
        locked={pickerLocked}
        onSelect={onPickProject}
        onAdd={onAddProject}
      />
      <Composer
        placeholder="描述你要做的事，Morrow 会转给当前 runtime"
        hint={streaming ? '正在回复 · 完成后可继续发送' : '⏎ 发送 · Shift⏎ 换行'}
        runtime={current}
        prefs={prefs}
        onChangePrefs={onChangePrefs}
        value={draft}
        onChange={onDraftChange}
        sendDisabled={streaming}
        autoFocus
        onSubmit={onSend}
      />
      <div className="runtime-strip">
        {(['claude', 'codex'] as const).map((rt) => {
          const info = runtimes[rt];
          const active = current === rt;
          const miss = !info.installed;
          const cls = ['rt-card', rt, active ? 'active' : '', miss ? 'miss' : '']
            .filter(Boolean)
            .join(' ');
          return (
            <div
              key={rt}
              className={cls}
              data-rt={rt}
              onClick={() => {
                if (!miss) onPick(rt);
              }}
            >
              <div className="row">
                <div className="logo">C</div>
                <div className="name">{LABEL[rt]}</div>
                <div className="dot-ok" />
              </div>
              <div className="meta">
                {BY[rt]} · {info.installed ? (info.version ?? 'installed') : 'not installed'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
