import { useEffect, useRef, useState } from 'react';
import {
  CLAUDE_MODELS,
  CODEX_MODELS,
  EFFORT_LEVELS,
  type ClaudeModel,
  type CodexModel,
  type EffortLevel,
  type RuntimeId,
} from '../../../../shared/ipc';
import type { AgentPrefs } from '../lib/agent-prefs';

interface Props {
  runtime: RuntimeId;
  value: AgentPrefs;
  onChange: (next: AgentPrefs) => void;
}

const EFFORT_LABELS: Record<EffortLevel, string> = {
  minimal: '最低',
  low: '低',
  medium: '中',
  high: '高',
  xhigh: '最高',
};

/**
 * Composer 内的模型/智能档位选择器。契约：
 *  - 仅做 prefs 的就地编辑；持久化由 App 的 onChange 负责
 *  - codex runtime 显示"模型 + 智能"两段；claude runtime 仅"模型"一段
 *  - 触发器是紧凑 chip；点击外部 / Esc / 选择后关闭 Popover
 *  - 所有模型常量来自 shared/ipc.ts，避免两处漂移
 */
export function ModelPicker({ runtime, value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const triggerLabel =
    runtime === 'codex'
      ? `${value.codex.model} · ${EFFORT_LABELS[value.codex.effort]}`
      : value.claude.model;

  const setCodexModel = (m: CodexModel): void => {
    onChange({ ...value, codex: { ...value.codex, model: m } });
  };
  const setCodexEffort = (e: EffortLevel): void => {
    onChange({ ...value, codex: { ...value.codex, effort: e } });
  };
  const setClaudeModel = (m: ClaudeModel): void => {
    onChange({ ...value, claude: { model: m } });
  };

  return (
    <div className="model-picker" ref={rootRef}>
      <button
        type="button"
        className="model-picker-trigger"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        title="切换模型 / 智能档位"
      >
        <span className="model-picker-trigger-label">{triggerLabel}</span>
        <span className="model-picker-caret" aria-hidden>
          ▾
        </span>
      </button>
      {open && (
        <div className="model-picker-panel" role="dialog" aria-label="模型选择">
          {runtime === 'codex' ? (
            <>
              <div className="model-picker-section-title">模型</div>
              <div className="model-picker-list" role="listbox">
                {CODEX_MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="option"
                    aria-selected={m === value.codex.model}
                    className={`model-picker-item${m === value.codex.model ? ' active' : ''}`}
                    onClick={() => setCodexModel(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="model-picker-divider" />
              <div className="model-picker-section-title">智能档位</div>
              <div className="model-picker-list" role="listbox">
                {EFFORT_LEVELS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    role="option"
                    aria-selected={e === value.codex.effort}
                    className={`model-picker-item${e === value.codex.effort ? ' active' : ''}`}
                    onClick={() => setCodexEffort(e)}
                  >
                    {EFFORT_LABELS[e]}
                    <span className="model-picker-item-sub">{e}</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="model-picker-section-title">模型</div>
              <div className="model-picker-list" role="listbox">
                {CLAUDE_MODELS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="option"
                    aria-selected={m === value.claude.model}
                    className={`model-picker-item${m === value.claude.model ? ' active' : ''}`}
                    onClick={() => setClaudeModel(m)}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
