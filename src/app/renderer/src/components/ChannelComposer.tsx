import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { RoleProfile } from '../../../../shared/ipc';

interface Props {
  roles: RoleProfile[];
  disabled?: boolean;
  onSubmit: (text: string) => void;
}

interface MentionMatch {
  start: number;
  query: string;
}

function findMention(text: string, cursor: number): MentionMatch | null {
  const before = text.slice(0, cursor);
  const match = /(^|\s)@([^\s@]*)$/.exec(before);
  if (!match) return null;
  return {
    start: before.length - match[2]!.length - 1,
    query: match[2]!.toLowerCase(),
  };
}

export function ChannelComposer({ roles, disabled = false, onSubmit }: Props) {
  const [draft, setDraft] = useState('');
  const [cursor, setCursor] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pendingSelectionRef = useRef<number | null>(null);
  const mention = findMention(draft, cursor);
  const filteredRoles = useMemo(() => {
    if (!mention) return [];
    return roles.filter((role) => role.name.toLowerCase().includes(mention.query)).slice(0, 6);
  }, [mention, roles]);
  const showMention = mention !== null;

  const commitRole = (role: RoleProfile): void => {
    if (!mention) return;
    const next = `${draft.slice(0, mention.start)}@${role.name} ${draft.slice(cursor)}`;
    const nextCursor = mention.start + role.name.length + 2;
    setDraft(next);
    setCursor(nextCursor);
    setActiveIndex(0);
    pendingSelectionRef.current = nextCursor;
  };

  useLayoutEffect(() => {
    const nextCursor = pendingSelectionRef.current;
    if (nextCursor === null) return;
    pendingSelectionRef.current = null;
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(nextCursor, nextCursor);
  }, [draft]);

  const submit = (): void => {
    const text = draft.trim();
    if (!text || disabled) return;
    onSubmit(text);
    setDraft('');
    setCursor(0);
    setActiveIndex(0);
  };

  return (
    <div className="channel-composer">
      {showMention ? (
        <div className="mention-menu" role="listbox" aria-label="选择频道角色">
          {filteredRoles.length === 0 ? (
            <div className="mention-empty">频道里没有匹配的角色</div>
          ) : (
            filteredRoles.map((role, index) => (
              <button
                key={role.id}
                type="button"
                role="option"
                aria-selected={index === activeIndex}
                className={`mention-item${index === activeIndex ? ' active' : ''}`}
                onMouseDown={(event) => {
                  event.preventDefault();
                  commitRole(role);
                }}
              >
                <span className="role-avatar">{role.name.slice(0, 2).toUpperCase()}</span>
                <span className="mention-main">
                  <span className="mention-name">{role.name}</span>
                  <span className="mention-intro">{role.intro}</span>
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
      <textarea
        ref={textareaRef}
        value={draft}
        disabled={disabled}
        placeholder="@角色名 提问，或直接发到群里"
        rows={4}
        onChange={(event) => {
          setDraft(event.target.value);
          setCursor(event.target.selectionStart);
          setActiveIndex(0);
        }}
        onSelect={(event) => setCursor(event.currentTarget.selectionStart)}
        onKeyDown={(event) => {
          if (showMention && filteredRoles.length > 0) {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setActiveIndex((index) => (index + 1) % filteredRoles.length);
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((index) => (index - 1 + filteredRoles.length) % filteredRoles.length);
              return;
            }
            if (event.key === 'Enter' || event.key === 'Tab') {
              event.preventDefault();
              commitRole(filteredRoles[activeIndex]!);
              return;
            }
          }
          if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            submit();
          }
        }}
      />
      <div className="channel-composer-row">
        <span className="channel-composer-hint">Enter 发送 · @ 后选择频道角色</span>
        <button
          type="button"
          className="btn primary channel-send"
          disabled={disabled || draft.trim().length === 0}
          onClick={submit}
        >
          发送
        </button>
      </div>
    </div>
  );
}
