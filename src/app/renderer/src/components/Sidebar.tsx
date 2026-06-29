import type { Channel, RoleProfile, RuntimeId } from '../../../../shared/ipc';
import type { Msg } from '../screens/Chat';

export interface Conversation {
  id: string;
  title: string;
  runtime: RuntimeId | null;
  messages: Msg[];
  /** 未发送的用户输入；按 conversation 保存，切换视图后可恢复。 */
  draft: string;
  createdAt: number;
  updatedAt: number;
  /** 首次发送时定版；null 表示未归属任何项目 */
  projectId: string | null;
  /** 可选终端诊断会话 id；主对话不得依赖 PTY/TUI 字节流。 */
  ptySessionId?: string | null;
  ptyStarting?: boolean;
}

interface Props {
  conversations: Conversation[];
  channels: Channel[];
  roles: RoleProfile[];
  activeConversationId: string | null;
  activeChannelId: string | null;
  activeRoleId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateConversation: () => void;
  onDeleteConversation: (id: string) => void;
  onSelectChannel: (id: string) => void;
  onCreateChannel: () => void;
  onDissolveChannel: (id: string) => void;
  onSelectRole: (id: string) => void;
  onCreateRole: () => void;
}

export function Sidebar({
  conversations,
  channels,
  roles,
  activeConversationId,
  activeChannelId,
  activeRoleId,
  onSelectConversation,
  onCreateConversation,
  onDeleteConversation,
  onSelectChannel,
  onCreateChannel,
  onDissolveChannel,
  onSelectRole,
  onCreateRole,
}: Props) {
  const now = Date.now();
  // oxlint-disable-next-line no-array-sort
  const sortedConversations = [...conversations].sort((a, b) => b.updatedAt - a.updatedAt);
  // oxlint-disable-next-line no-array-sort
  const sortedChannels = [...channels].sort((a, b) => b.updatedAt - a.updatedAt);
  // oxlint-disable-next-line no-array-sort
  const sortedRoles = [...roles].sort((a, b) => a.createdAt - b.createdAt);

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="workspace-brand">
        <div className="workspace-mark">D</div>
        <div>
          <strong>Morrow Workspace</strong>
          <span>本地个人工作空间</span>
        </div>
      </div>
      <div className="sidebar-actions">
        <button
          type="button"
          className="sidebar-new"
          onClick={onCreateConversation}
          data-testid="sidebar-new"
        >
          <span className="plus">+</span> 新建对话
        </button>
        <button
          type="button"
          className="sidebar-new"
          onClick={onCreateChannel}
          data-testid="sidebar-new-channel"
        >
          <span className="plus">#</span> 新建群聊
        </button>
      </div>
      <div className="sidebar-group" data-testid="sidebar-conversations">
        <div className="sidebar-group-header">
          <span>个人对话</span>
        </div>
        <div className="sidebar-list">
          {sortedConversations.length === 0 ? (
            <div className="sidebar-empty">还没有对话</div>
          ) : (
            sortedConversations.map((conv) => (
              <ConvItem
                key={conv.id}
                conv={conv}
                active={conv.id === activeConversationId}
                now={now}
                onSelect={onSelectConversation}
                onDelete={onDeleteConversation}
              />
            ))
          )}
        </div>
      </div>
      <div className="sidebar-group" data-testid="sidebar-channels">
        <div className="sidebar-group-header">
          <span>群聊频道</span>
          <button
            type="button"
            className="sidebar-group-action"
            aria-label="新建群聊"
            title="新建群聊"
            onClick={onCreateChannel}
          >
            +
          </button>
        </div>
        <div className="sidebar-list">
          {sortedChannels.length === 0 ? (
            <div className="sidebar-empty">还没有群聊</div>
          ) : (
            sortedChannels.map((channel) => (
              <ChannelItem
                key={channel.id}
                channel={channel}
                active={channel.id === activeChannelId}
                memberCount={channel.memberRoleIds.length}
                onSelect={onSelectChannel}
                onDissolve={onDissolveChannel}
              />
            ))
          )}
        </div>
      </div>
      <div className="sidebar-group sidebar-ai" data-testid="sidebar-roles">
        <div className="sidebar-group-header">
          <span>AI 队友</span>
          <button
            type="button"
            className="sidebar-group-action"
            aria-label="新建角色"
            title="新建角色"
            onClick={onCreateRole}
          >
            +
          </button>
        </div>
        <div className="sidebar-list">
          {sortedRoles.map((role) => (
            <RoleItem
              key={role.id}
              role={role}
              active={role.id === activeRoleId}
              joinedCount={
                channels.filter((channel) => channel.memberRoleIds.includes(role.id)).length
              }
              onSelect={onSelectRole}
            />
          ))}
        </div>
      </div>
    </aside>
  );
}

function ConvItem({
  conv,
  active,
  now,
  onSelect,
  onDelete,
}: {
  conv: Conversation;
  active: boolean;
  now: number;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className={`sidebar-item${active ? ' active' : ''}`}>
      <button
        type="button"
        className="sidebar-item-body"
        onClick={() => onSelect(conv.id)}
        title={conv.title}
      >
        <div className="sidebar-item-title">{conv.title}</div>
        <div className="sidebar-item-time">{formatRelativeTime(conv.updatedAt, now)}</div>
      </button>
      <span
        className="sidebar-item-remove"
        role="button"
        tabIndex={0}
        aria-label={`删除对话 ${conv.title}`}
        title="删除对话"
        onClick={(event) => {
          event.stopPropagation();
          onDelete(conv.id);
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onDelete(conv.id);
          }
        }}
      >
        ×
      </span>
    </div>
  );
}

function ChannelItem({
  channel,
  active,
  memberCount,
  onSelect,
  onDissolve,
}: {
  channel: Channel;
  active: boolean;
  memberCount: number;
  onSelect: (id: string) => void;
  onDissolve: (id: string) => void;
}) {
  return (
    <div className={`sidebar-channel-row${active ? ' active' : ''}`}>
      <button
        type="button"
        className="sidebar-channel"
        onClick={() => onSelect(channel.id)}
        title={`#${channel.name}`}
      >
        <span className="channel-hash">#</span>
        <span className="sidebar-channel-main">
          <strong>{channel.name}</strong>
          <em>{channel.folderProjectId ? '已绑定文件夹' : '未绑定文件夹'}</em>
        </span>
        <span className="sidebar-count">{memberCount}</span>
      </button>
      <button
        type="button"
        className="sidebar-channel-dissolve"
        aria-label={`解散群聊 ${channel.name}`}
        title="解散群聊"
        onClick={() => onDissolve(channel.id)}
      >
        ×
      </button>
    </div>
  );
}

function RoleItem({
  role,
  active,
  joinedCount,
  onSelect,
}: {
  role: RoleProfile;
  active: boolean;
  joinedCount: number;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      className={`sidebar-role${active ? ' active' : ''}`}
      onClick={() => onSelect(role.id)}
      title={role.name}
    >
      <span className="role-avatar">{role.name.slice(0, 2).toUpperCase()}</span>
      <span className="sidebar-role-main">
        <strong>{role.name}</strong>
        <em>{role.defaultRuntime === 'claude' ? 'Claude Code' : 'Codex'}</em>
      </span>
      <span className="sidebar-count">{joinedCount}</span>
    </button>
  );
}

/**
 * 相对时间文案。纯函数，便于单测。
 *  <60s → "刚刚"
 *  <60min → "N 分钟前"
 *  同一天 → "HH:mm"
 *  昨天 → "昨天"
 *  其他 → "MM-DD"
 */
export function formatRelativeTime(ts: number, now: number): string {
  const diff = now - ts;
  if (diff < 60_000) return '刚刚';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  const d = new Date(ts);
  const n = new Date(now);
  const sameDay =
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate();
  if (sameDay) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const yesterday = new Date(n);
  yesterday.setDate(n.getDate() - 1);
  const isYesterday =
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate();
  if (isYesterday) return '昨天';
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
