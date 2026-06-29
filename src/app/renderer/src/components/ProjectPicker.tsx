import { useEffect, useMemo, useRef, useState } from 'react';
import type { Project } from '../../../../shared/ipc';

interface Props {
  projects: Project[];
  activeProjectId: string | null;
  /** true 时禁用"换项目"，只允许"退出项目"（已发送过消息的会话锁定语义） */
  locked: boolean;
  onSelect: (id: string | null) => void;
  onAdd: () => void | Promise<void>;
}

/**
 * 项目选择器。语义：
 *  - 未选 → "进入项目工作"；选中 → "📁 <name>"
 *  - 搜索前缀匹配（大小写不敏感）；回车选中第一个；Esc 关闭
 *  - locked 模式下只保留"退出项目"
 * 依赖：全部样式来自 index.css tokens 与本组件内的 BEM-ish 类（写在 sidebar.css 尾部）
 */
export function ProjectPicker({ projects, activeProjectId, locked, onSelect, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const active = useMemo(
    () => projects.find((p) => p.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => p.name.toLowerCase().includes(q));
  }, [projects, query]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent): void => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = (): void => {
    setOpen(false);
    setQuery('');
  };

  const lockedNoProject = locked && !active;
  const triggerClass = `project-picker-trigger${active ? ' has-project' : ''}${locked ? ' locked' : ''}${lockedNoProject ? ' static' : ''}`;
  const triggerLabel = active
    ? `📁 ${active.name}`
    : lockedNoProject
      ? '本对话未关联项目'
      : '进入项目工作';

  return (
    <div className="project-picker" ref={rootRef}>
      <button
        type="button"
        className={triggerClass}
        onClick={() => {
          if (lockedNoProject) return;
          setOpen((v) => !v);
        }}
        aria-haspopup={lockedNoProject ? undefined : 'listbox'}
        aria-expanded={lockedNoProject ? undefined : open}
        aria-disabled={lockedNoProject || undefined}
        title={
          active
            ? `${active.path}${active.invalid ? ' (不可用)' : ''}`
            : lockedNoProject
              ? '本对话发送时未关联项目，无法切换'
              : '选择项目文件夹'
        }
      >
        <span className="project-picker-label">{triggerLabel}</span>
        {!locked ? <span className="project-picker-caret">▾</span> : null}
      </button>
      {open && !lockedNoProject ? (
        <div className="project-picker-panel" role="listbox">
          {locked ? (
            <button
              type="button"
              className="project-picker-item danger"
              onClick={() => {
                onSelect(null);
                close();
              }}
            >
              退出项目
            </button>
          ) : (
            <>
              <input
                className="project-picker-search"
                placeholder="搜索项目"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault();
                    close();
                  }
                  if (e.key === 'Enter' && filtered.length > 0) {
                    e.preventDefault();
                    onSelect(filtered[0]!.id);
                    close();
                  }
                }}
                autoFocus
              />
              <div className="project-picker-list">
                {filtered.length === 0 ? (
                  <div className="project-picker-empty">没有匹配的项目</div>
                ) : (
                  filtered.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className={`project-picker-item${p.id === activeProjectId ? ' active' : ''}${p.invalid ? ' invalid' : ''}`}
                      onClick={() => {
                        onSelect(p.id);
                        close();
                      }}
                      title={p.path}
                    >
                      <span className="project-picker-item-name">{p.name}</span>
                      {p.invalid ? <span className="project-picker-warn">❗</span> : null}
                    </button>
                  ))
                )}
                {active ? (
                  <button
                    type="button"
                    className="project-picker-item danger"
                    onClick={() => {
                      onSelect(null);
                      close();
                    }}
                  >
                    退出项目
                  </button>
                ) : null}
              </div>
              <div className="project-picker-divider" />
              <button
                type="button"
                className="project-picker-add"
                onClick={() => {
                  close();
                  void onAdd();
                }}
              >
                + 添加新项目
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
