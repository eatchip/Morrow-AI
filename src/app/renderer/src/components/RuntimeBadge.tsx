import { useEffect, useRef, useState } from 'react';
import type { DetectResult, RuntimeId } from '../../../../shared/ipc';

interface Props {
  runtimes: DetectResult;
  current: RuntimeId;
  onPick: (rt: RuntimeId) => void;
}

const LABEL: Record<RuntimeId, string> = {
  claude: 'Claude Code',
  codex: 'Codex CLI',
};

export function RuntimeBadge({ runtimes, current, onPick }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div className="rt-badge" onClick={() => setOpen((v) => !v)}>
        <span className="dot-ok" />
        <span>{LABEL[current]}</span>
        <span style={{ color: 'var(--muted)' }}>▾</span>
      </div>
      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 30,
            right: 0,
            minWidth: 220,
            zIndex: 20,
            background: 'var(--panel)',
            border: '1px solid var(--line-strong)',
            borderRadius: 8,
            padding: 4,
            boxShadow: '0 12px 28px -8px rgba(0,0,0,.5)',
          }}
        >
          {(['claude', 'codex'] as const).map((rt) => {
            const info = runtimes[rt];
            const disabled = !info.installed;
            return (
              <div
                key={rt}
                onClick={() => {
                  if (disabled) return;
                  onPick(rt);
                  setOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 10px',
                  borderRadius: 6,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  opacity: disabled ? 0.5 : 1,
                  fontSize: 13,
                  color: rt === current ? 'var(--accent)' : 'var(--text-2)',
                  fontFamily: 'var(--sans)',
                }}
              >
                <span>{LABEL[rt]}</span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontFamily: 'var(--mono)',
                    fontSize: 11,
                    color: 'var(--muted)',
                  }}
                >
                  {info.installed ? (info.version ?? '') : 'not installed'}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
