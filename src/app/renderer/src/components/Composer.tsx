import { useEffect, useRef } from 'react';
import type { RuntimeId } from '../../../../shared/ipc';
import type { AgentPrefs } from '../lib/agent-prefs';
import { ModelPicker } from './ModelPicker';

interface Props {
  placeholder: string;
  hint: string;
  runtime: RuntimeId;
  prefs: AgentPrefs;
  onChangePrefs: (next: AgentPrefs) => void;
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
  sendDisabled?: boolean;
  onSubmit: (text: string) => void;
}

/**
 * 共享输入框。契约：
 *  - Enter 发送（对齐 ChatGPT/Claude/Cursor 默认）
 *  - Shift+Enter 换行
 *  - ⌘/Ctrl+Enter 作为等价发送，冗余保留（兼容老肌肉记忆）
 *  - IME 合成期间（中文输入法候选词阶段）一律不发送
 */
export function Composer({
  placeholder,
  hint,
  runtime,
  prefs,
  onChangePrefs,
  value,
  onChange,
  autoFocus,
  sendDisabled = false,
  onSubmit,
}: Props) {
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (autoFocus) taRef.current?.focus();
  }, [autoFocus]);

  const canSend = value.trim().length > 0 && !sendDisabled;

  const submit = (): void => {
    if (sendDisabled) return;
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
  };

  return (
    <div className="composer">
      <textarea
        ref={taRef}
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          // IME 合成中（中文/日文等输入法候选词）双重兜底：不拦截
          if (e.nativeEvent.isComposing || e.keyCode === 229) return;
          if (e.shiftKey) return; // 走默认，插入换行
          e.preventDefault();
          submit();
        }}
      />
      <div className="composer-row">
        <span className="hint">{hint}</span>
        <div className="spacer" />
        <ModelPicker runtime={runtime} value={prefs} onChange={onChangePrefs} />
        <button
          type="button"
          className={`send-btn${canSend ? ' on' : ''}`}
          onClick={submit}
          disabled={!canSend}
          aria-label="发送"
          title={sendDisabled ? '正在回复，完成后可发送' : '发送 (⏎)'}
        >
          <svg viewBox="0 0 24 24">
            <path d="M12 19V5M6 11l6-6 6 6" />
          </svg>
        </button>
      </div>
    </div>
  );
}
