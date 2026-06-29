import type { DetectResult } from '../../../../shared/ipc';

interface Props {
  runtimes: DetectResult | null;
}

interface Row {
  id: 'claude' | 'codex';
  name: string;
  state: 'pending' | 'ok' | 'miss';
  version: string;
}

function rows(runtimes: DetectResult | null): Row[] {
  const mk = (id: 'claude' | 'codex', name: string): Row => {
    if (!runtimes) return { id, name, state: 'pending', version: 'checking…' };
    const info = runtimes[id];
    if (info.installed) return { id, name, state: 'ok', version: info.version ?? 'installed' };
    return { id, name, state: 'miss', version: 'not found' };
  };
  return [mk('claude', 'Claude Code'), mk('codex', 'Codex CLI')];
}

export function Splash({ runtimes }: Props) {
  return (
    <div className="splash">
      <div className="wordmark" data-testid="wordmark">
        morrow
        <span className="caret" />
      </div>
      <div className="splash-sub">Detecting local AI runtimes…</div>
      <div className="detect-list" data-testid="detect-list">
        {rows(runtimes).map((r) => (
          <div key={r.id} className="detect-row" data-row={r.id}>
            <span className={`status ${r.state}`}>
              {r.state === 'pending' ? <span className="spinner" /> : r.state === 'ok' ? '✓' : '✕'}
            </span>
            <span className="name">{r.name}</span>
            <span className="version">{r.version}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
