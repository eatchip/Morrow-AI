import { useEffect, useState } from 'react';
import type { Channel, RoleProfile, RuntimeId, UpdateRoleArgs } from '../../../../shared/ipc';

interface Props {
  role: RoleProfile | null;
  channels: Channel[];
  onClose: () => void;
  onSave: (args: UpdateRoleArgs) => Promise<void> | void;
  onDelete: (roleId: string) => Promise<void> | void;
}

const RUNTIME_LABEL: Record<RuntimeId, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
};

export function RoleDrawer({ role, channels, onClose, onSave, onDelete }: Props) {
  const [tab, setTab] = useState<'chat' | 'settings'>('settings');
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [instruction, setInstruction] = useState('');
  const [runtime, setRuntime] = useState<RuntimeId>('claude');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!role) return;
    setName(role.name);
    setIntro(role.intro);
    setInstruction(role.instruction);
    setRuntime(role.defaultRuntime);
    setTab('settings');
  }, [role]);

  if (!role) return null;
  const joinedChannels = channels.filter((channel) => channel.memberRoleIds.includes(role.id));
  const canSave = name.trim() && intro.trim() && instruction.trim() && !saving;

  const save = async (): Promise<void> => {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        roleId: role.id,
        name,
        intro,
        instruction,
        defaultRuntime: runtime,
      });
    } finally {
      setSaving(false);
    }
  };
  const confirmDelete = (): void => {
    if (!window.confirm(`删除角色「${role.name}」？`)) return;
    void onDelete(role.id);
  };

  return (
    <aside className="role-drawer" aria-label="角色详情">
      <div className="role-drawer-head">
        <div className="role-drawer-avatar">{role.name.slice(0, 2).toUpperCase()}</div>
        <div className="role-drawer-title">
          <div className="role-drawer-name">{role.name}</div>
          <div className="role-drawer-meta">AI 队友 · {RUNTIME_LABEL[role.defaultRuntime]}</div>
        </div>
        <button
          type="button"
          className="btn danger role-delete-head"
          aria-label="删除当前角色"
          onClick={confirmDelete}
        >
          删除
        </button>
        <button type="button" className="icon-btn" aria-label="关闭角色详情" onClick={onClose}>
          ×
        </button>
      </div>
      <div className="role-tabs" role="tablist" aria-label="角色视图">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'chat'}
          className={tab === 'chat' ? 'active' : ''}
          onClick={() => setTab('chat')}
        >
          Chat
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'settings'}
          className={tab === 'settings' ? 'active' : ''}
          onClick={() => setTab('settings')}
        >
          Settings
        </button>
      </div>
      {tab === 'chat' ? (
        <div className="role-drawer-body">
          <div className="role-readonly-block">
            <div className="field-label">简介</div>
            <p>{role.intro}</p>
          </div>
          <div className="role-readonly-block">
            <div className="field-label">已加入群聊</div>
            {joinedChannels.length === 0 ? (
              <p>还没有加入任何群聊。</p>
            ) : (
              <div className="joined-channel-list">
                {joinedChannels.map((channel) => (
                  <span key={channel.id}>#{channel.name}</span>
                ))}
              </div>
            )}
          </div>
          <div className="role-readonly-block">
            <div className="field-label">指示</div>
            <p>{role.instruction}</p>
          </div>
        </div>
      ) : (
        <div className="role-drawer-body">
          <label className="form-field">
            <span>显示名称</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="form-field">
            <span>模型</span>
            <select
              value={runtime}
              onChange={(event) => setRuntime(event.target.value as RuntimeId)}
            >
              <option value="claude">Claude Code</option>
              <option value="codex">Codex</option>
            </select>
          </label>
          <label className="form-field">
            <span>简介</span>
            <textarea rows={3} value={intro} onChange={(event) => setIntro(event.target.value)} />
          </label>
          <label className="form-field">
            <span>指示</span>
            <textarea
              rows={9}
              value={instruction}
              onChange={(event) => setInstruction(event.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn primary role-save"
            disabled={!canSave}
            onClick={save}
          >
            {saving ? '保存中…' : '保存设置'}
          </button>
          <div className="danger-zone">
            <div>
              <strong>删除角色</strong>
              <p>会从 AI 队友列表和所有群聊成员里移除，历史消息仍会保留。</p>
            </div>
            <button type="button" className="btn danger" onClick={confirmDelete}>
              删除角色
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
