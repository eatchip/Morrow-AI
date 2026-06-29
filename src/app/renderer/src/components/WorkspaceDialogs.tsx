import { useEffect, useMemo, useState } from 'react';
import type {
  Channel,
  CreateChannelArgs,
  CreateRoleArgs,
  Project,
  RoleProfile,
  RuntimeId,
} from '../../../../shared/ipc';

interface ChannelDialogProps {
  open: boolean;
  projects: Project[];
  roles: RoleProfile[];
  onChooseFolder: () => Promise<Project | null>;
  onCancel: () => void;
  onCreate: (args: CreateChannelArgs) => Promise<void> | void;
}

interface RoleDialogProps {
  open: boolean;
  channels: Channel[];
  onCancel: () => void;
  onCreate: (args: CreateRoleArgs) => Promise<void> | void;
}

interface ChannelDissolveDialogProps {
  channel: Channel | null;
  onCancel: () => void;
  onConfirm: (channelId: string) => Promise<void> | void;
}

export function ChannelCreateDialog({
  open,
  projects,
  roles,
  onChooseFolder,
  onCancel,
  onCreate,
}: ChannelDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [folderId, setFolderId] = useState<string | null>(null);
  const [chosenFolder, setChosenFolder] = useState<Project | null>(null);
  const [memberRoleIds, setMemberRoleIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setFolderId(null);
    setChosenFolder(null);
    setMemberRoleIds([]);
    setSubmitting(false);
  }, [open]);

  const folderOptions = useMemo(() => {
    const items = chosenFolder ? [chosenFolder, ...projects] : projects;
    return items.filter((item, index) => items.findIndex((p) => p.id === item.id) === index);
  }, [chosenFolder, projects]);

  if (!open) return null;
  const canSubmit = name.trim() && !submitting;
  const selectedFolder = folderOptions.find((project) => project.id === folderId) ?? null;

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate({
        name,
        description,
        folderProjectId: folderId,
        memberRoleIds,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleRole = (roleId: string): void => {
    setMemberRoleIds((ids) =>
      ids.includes(roleId) ? ids.filter((id) => id !== roleId) : [...ids, roleId],
    );
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal aria-label="新建群聊">
      <div className="workspace-dialog">
        <div className="dialog-head">
          <div>
            <h2>新建群聊</h2>
            <p>绑定一个本地文件夹，再选择初始 AI 队友。</p>
          </div>
          <button type="button" className="icon-btn" aria-label="关闭" onClick={onCancel}>
            ×
          </button>
        </div>
        <label className="form-field">
          <span>群聊名称</span>
          <input
            autoFocus
            placeholder="general"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>描述</span>
          <textarea
            rows={3}
            placeholder="这个群聊主要讨论什么？"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <div className="form-field">
          <span>绑定文件夹</span>
          <div className="folder-bind-row">
            <button
              type="button"
              className="btn"
              onClick={async () => {
                const project = await onChooseFolder();
                if (!project) return;
                setChosenFolder(project);
                setFolderId(project.id);
              }}
            >
              选择本地文件夹
            </button>
            <button type="button" className="btn" onClick={() => setFolderId(null)}>
              暂不绑定
            </button>
          </div>
          <div className="folder-result">
            {selectedFolder ? selectedFolder.path : '当前没有绑定文件夹'}
          </div>
        </div>
        <div className="form-field">
          <span>初始 AI 队友</span>
          <div className="dialog-list">
            {roles.map((role) => (
              <label key={role.id} className="check-row">
                <input
                  type="checkbox"
                  checked={memberRoleIds.includes(role.id)}
                  onChange={() => toggleRole(role.id)}
                />
                <span className="role-avatar">{role.name.slice(0, 2).toUpperCase()}</span>
                <span>
                  <strong>{role.name}</strong>
                  <em>{role.intro}</em>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn primary" disabled={!canSubmit} onClick={submit}>
            {submitting ? '创建中…' : '创建群聊'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RoleCreateDialog({ open, channels, onCancel, onCreate }: RoleDialogProps) {
  const [name, setName] = useState('');
  const [intro, setIntro] = useState('');
  const [instruction, setInstruction] = useState('');
  const [runtime, setRuntime] = useState<RuntimeId>('claude');
  const [channelIds, setChannelIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setIntro('');
    setInstruction('');
    setRuntime('claude');
    setChannelIds([]);
    setSubmitting(false);
  }, [open]);

  if (!open) return null;
  const canSubmit = name.trim() && intro.trim() && instruction.trim() && !submitting;

  const toggleChannel = (channelId: string): void => {
    setChannelIds((ids) =>
      ids.includes(channelId) ? ids.filter((id) => id !== channelId) : [...ids, channelId],
    );
  };

  const submit = async (): Promise<void> => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await onCreate({
        name,
        intro,
        instruction,
        defaultRuntime: runtime,
        channelIds,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal aria-label="新建角色">
      <div className="workspace-dialog">
        <div className="dialog-head">
          <div>
            <h2>新建角色</h2>
            <p>指示会作为这个角色的核心 prompt，可随时在角色详情里修改。</p>
          </div>
          <button type="button" className="icon-btn" aria-label="关闭" onClick={onCancel}>
            ×
          </button>
        </div>
        <label className="form-field">
          <span>显示名称</span>
          <input
            autoFocus
            placeholder="设计师"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>模型</span>
          <select value={runtime} onChange={(event) => setRuntime(event.target.value as RuntimeId)}>
            <option value="claude">Claude Code</option>
            <option value="codex">Codex</option>
          </select>
        </label>
        <label className="form-field">
          <span>简介</span>
          <textarea
            rows={3}
            placeholder="一句话说明这个角色负责什么"
            value={intro}
            onChange={(event) => setIntro(event.target.value)}
          />
        </label>
        <label className="form-field">
          <span>指示</span>
          <textarea
            rows={8}
            placeholder="写清楚这个角色的职责、回答方式、边界和工作习惯"
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
          />
        </label>
        <div className="form-field">
          <span>加入群聊</span>
          {channels.length === 0 ? (
            <div className="dialog-muted">当前还没有群聊，角色会先保存在 AI 队友列表里。</div>
          ) : (
            <div className="dialog-list compact">
              {channels.map((channel) => (
                <label key={channel.id} className="check-row">
                  <input
                    type="checkbox"
                    checked={channelIds.includes(channel.id)}
                    onChange={() => toggleChannel(channel.id)}
                  />
                  <span>#{channel.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            取消
          </button>
          <button type="button" className="btn primary" disabled={!canSubmit} onClick={submit}>
            {submitting ? '创建中…' : '创建角色'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ChannelDissolveDialog({
  channel,
  onCancel,
  onConfirm,
}: ChannelDissolveDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!channel) return;
    setSubmitting(false);
    setError('');
  }, [channel]);

  useEffect(() => {
    if (!channel || submitting) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [channel, onCancel, submitting]);

  if (!channel) return null;

  const confirm = async (): Promise<void> => {
    if (submitting) return;
    setSubmitting(true);
    setError('');
    try {
      await onConfirm(channel.id);
    } catch {
      setError('解散失败，请稍后重试。');
      setSubmitting(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="dialog" aria-modal aria-label="解散群聊">
      <div className="workspace-dialog dissolve-dialog">
        <div className="dialog-head">
          <div>
            <h2>解散 #{channel.name}？</h2>
            <p>
              这个群聊会从侧边栏移除，群聊消息、交接记录和运行记录会一并删除。AI
              队友本身不会删除。此操作无法撤销。
            </p>
          </div>
          <button
            type="button"
            className="icon-btn"
            aria-label="关闭"
            disabled={submitting}
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        {error ? (
          <div className="dialog-error" role="alert">
            {error}
          </div>
        ) : null}
        <div className="dialog-actions">
          <button type="button" className="btn" disabled={submitting} onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="btn danger"
            disabled={submitting}
            autoFocus
            onClick={confirm}
          >
            {submitting ? '解散中…' : '确认解散'}
          </button>
        </div>
      </div>
    </div>
  );
}
