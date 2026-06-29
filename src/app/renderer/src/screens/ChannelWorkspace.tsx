import { useMemo, useState, type ReactNode } from 'react';
import type {
  ChannelEvent,
  ChannelSnapshot,
  HandoffProposal,
  Project,
  RoleProfile,
  TeamProposal,
} from '../../../../shared/ipc';
import { ChannelComposer } from '../components/ChannelComposer';
import { buildChannelViewModel, type ChannelTimelineViewItem } from '../lib/channel-view-model';

interface Props {
  snapshot: ChannelSnapshot;
  activeChannelId: string | null;
  projects: Project[];
  pendingRunText: Record<string, string>;
  onPostMessage: (channelId: string, text: string) => void | Promise<void>;
  onOpenRole: (roleId: string) => void;
  onAddRoleToChannel: (channelId: string, roleId: string) => void | Promise<void>;
  onAcceptHandoff: (channelId: string, handoffId: string) => void | Promise<void>;
  onConfirmTeamProposal: (channelId: string, proposalId: string) => void | Promise<void>;
  onDismissTeamProposal: (channelId: string, proposalId: string) => void | Promise<void>;
}

export function ChannelWorkspace({
  snapshot,
  activeChannelId,
  projects,
  pendingRunText,
  onPostMessage,
  onOpenRole,
  onAddRoleToChannel,
  onAcceptHandoff,
  onConfirmTeamProposal,
  onDismissTeamProposal,
}: Props) {
  const [membersOpen, setMembersOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const view = useMemo(
    () => buildChannelViewModel(snapshot, activeChannelId),
    [activeChannelId, snapshot],
  );

  if (!view) {
    return (
      <main className="channel-empty-state">
        <div>
          <h1>选择或新建一个群聊</h1>
          <p>群聊用于把多个 AI 队友放在同一个本地文件夹上下文里讨论。</p>
        </div>
      </main>
    );
  }

  const { channel, channelRoles, events, availableRoles, rolesById } = view;
  const project = projects.find((item) => item.id === channel.folderProjectId) ?? null;

  return (
    <main className={`channel-shell${membersOpen ? ' has-members' : ''}`}>
      <section className="channel-main">
        <header className="channel-header">
          <div>
            <h1>#{channel.name}</h1>
            <p>{project ? `绑定文件夹 · ${project.path}` : '未绑定文件夹'}</p>
          </div>
          <button
            type="button"
            className="btn channel-members-toggle"
            onClick={() => setMembersOpen((open) => !open)}
          >
            {membersOpen ? '收起成员' : `频道成员 ${channelRoles.length}`}
          </button>
        </header>
        <div className="channel-stream">
          <div className="channel-stream-inner">
            {events.length === 0 ? (
              <div className="channel-empty-thread">
                <h2>还没有消息</h2>
                <p>直接发到群里，或输入 @ 选择一个频道里的角色。</p>
              </div>
            ) : (
              events.map((event) => (
                <ChannelTimelineItem
                  key={event.event.id}
                  item={event}
                  roles={snapshot.roles}
                  rolesById={rolesById}
                  pendingRunText={pendingRunText}
                  teamProposals={snapshot.teamProposals}
                  onOpenRole={onOpenRole}
                  onAcceptHandoff={(handoffId) => void onAcceptHandoff(channel.id, handoffId)}
                  onConfirmProposal={(proposalId) =>
                    void onConfirmTeamProposal(channel.id, proposalId)
                  }
                  onDismissProposal={(proposalId) =>
                    void onDismissTeamProposal(channel.id, proposalId)
                  }
                />
              ))
            )}
          </div>
        </div>
        <div className="channel-composer-wrap">
          <ChannelComposer
            roles={channelRoles}
            onSubmit={(text) => void onPostMessage(channel.id, text)}
          />
        </div>
      </section>
      {membersOpen ? (
        <aside className="members-panel" aria-label="频道成员">
          <div className="members-head">
            <h2>频道成员</h2>
            <button
              type="button"
              className="icon-btn"
              aria-label="添加频道成员"
              onClick={() => setPickerOpen((open) => !open)}
            >
              +
            </button>
          </div>
          {pickerOpen ? (
            <div className="member-picker">
              {availableRoles.length === 0 ? (
                <div className="dialog-muted">所有角色都已在频道里。</div>
              ) : (
                availableRoles.map((role) => (
                  <button
                    key={role.id}
                    type="button"
                    className="member-pick-row"
                    onClick={() => void onAddRoleToChannel(channel.id, role.id)}
                  >
                    <span className="role-avatar">{role.name.slice(0, 2).toUpperCase()}</span>
                    <span>{role.name}</span>
                  </button>
                ))
              )}
            </div>
          ) : null}
          <div className="member-list">
            {channelRoles.length === 0 ? (
              <div className="dialog-muted">这个群聊还没有 AI 队友。</div>
            ) : (
              channelRoles.map((role) => (
                <button
                  key={role.id}
                  type="button"
                  className="member-card"
                  onClick={() => onOpenRole(role.id)}
                >
                  <span className="role-avatar">{role.name.slice(0, 2).toUpperCase()}</span>
                  <span className="member-main">
                    <strong>{role.name}</strong>
                    <em>{role.defaultRuntime === 'claude' ? 'Claude Code' : 'Codex'}</em>
                    <span>{role.intro}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>
      ) : null}
    </main>
  );
}

function ChannelTimelineItem({
  item,
  roles,
  rolesById,
  pendingRunText,
  teamProposals,
  onOpenRole,
  onAcceptHandoff,
  onConfirmProposal,
  onDismissProposal,
}: {
  item: ChannelTimelineViewItem;
  roles: RoleProfile[];
  rolesById: ReadonlyMap<string, RoleProfile>;
  pendingRunText: Record<string, string>;
  teamProposals: TeamProposal[];
  onOpenRole: (roleId: string) => void;
  onAcceptHandoff: (handoffId: string) => void;
  onConfirmProposal: (proposalId: string) => void;
  onDismissProposal: (proposalId: string) => void;
}) {
  const { event, role, run, handoff } = item;
  if (event.type === 'role_run_started') {
    if (!run || run.status !== 'running') return null;
    return (
      <RoleMessage role={role} onOpenRole={onOpenRole} muted>
        {pendingRunText[run.id] || '正在思考…'}
        <span className="typing" />
      </RoleMessage>
    );
  }
  if (event.type === 'message_posted') {
    return <UserMessage text={event.text ?? ''} roles={roles} />;
  }
  if (event.type === 'role_message_posted') {
    return (
      <RoleMessage role={role} onOpenRole={onOpenRole}>
        {renderWithMentions(event.text ?? '', roles)}
      </RoleMessage>
    );
  }
  if (event.type === 'handoff_proposed') {
    if (!handoff) return null;
    return <HandoffCard handoff={handoff} rolesById={rolesById} onAccept={onAcceptHandoff} />;
  }
  if (event.type === 'team_proposal_posted') {
    const proposal = teamProposals.find(
      (p) => p.channelId === event.channelId && p.status === 'proposed',
    );
    if (!proposal) return <div className="system-pill">{event.text ?? '角色方案已处理'}</div>;
    return (
      <TeamProposalCard
        proposal={proposal}
        onConfirm={onConfirmProposal}
        onDismiss={onDismissProposal}
      />
    );
  }
  if (event.type === 'team_proposal_confirmed') {
    return <div className="system-pill">{event.text ?? '角色已创建'}</div>;
  }
  if (event.type === 'role_run_failed') {
    return (
      <RoleMessage role={role} onOpenRole={onOpenRole} error>
        {event.text ?? '角色运行失败'}
      </RoleMessage>
    );
  }
  return <div className="system-pill">{event.text ?? systemLabel(event.type)}</div>;
}

function UserMessage({ text, roles }: { text: string; roles: RoleProfile[] }) {
  return (
    <div className="channel-message user">
      <div className="channel-avatar user-avatar">S</div>
      <div>
        <div className="message-head">
          <strong>stephen s</strong>
        </div>
        <div className="message-body">{renderWithMentions(text, roles)}</div>
      </div>
    </div>
  );
}

function RoleMessage({
  role,
  muted = false,
  error = false,
  onOpenRole,
  children,
}: {
  role: RoleProfile | null;
  muted?: boolean;
  error?: boolean;
  onOpenRole: (roleId: string) => void;
  children: ReactNode;
}) {
  return (
    <div className={`channel-message role${muted ? ' muted' : ''}${error ? ' error' : ''}`}>
      <button
        type="button"
        className="channel-avatar role-avatar"
        disabled={!role}
        onClick={() => role && onOpenRole(role.id)}
      >
        {role?.name.slice(0, 2).toUpperCase() ?? 'AI'}
      </button>
      <div>
        <div className="message-head">
          <button type="button" onClick={() => role && onOpenRole(role.id)} disabled={!role}>
            {role?.name ?? 'AI 队友'}
          </button>
          <span className="ai-chip">AI</span>
        </div>
        <div className="message-body">{children}</div>
      </div>
    </div>
  );
}

function HandoffCard({
  handoff,
  rolesById,
  onAccept,
}: {
  handoff: HandoffProposal;
  rolesById: ReadonlyMap<string, RoleProfile>;
  onAccept: (handoffId: string) => void;
}) {
  const from = rolesById.get(handoff.fromRoleId)?.name ?? '上一个角色';
  const to = rolesById.get(handoff.toRoleId)?.name ?? '目标角色';
  return (
    <div className="handoff-card">
      <div>
        <strong>
          {from} 建议交给 {to}
        </strong>
        <p>{handoff.reason || handoff.instruction}</p>
      </div>
      {handoff.status === 'proposed' ? (
        <button type="button" className="btn" onClick={() => onAccept(handoff.id)}>
          接受交接
        </button>
      ) : (
        <span className="handoff-status">已接受</span>
      )}
    </div>
  );
}

function TeamProposalCard({
  proposal,
  onConfirm,
  onDismiss,
}: {
  proposal: TeamProposal;
  onConfirm: (proposalId: string) => void;
  onDismiss: (proposalId: string) => void;
}) {
  return (
    <div className="handoff-card team-proposal-card">
      <div className="team-proposal-body">
        <strong>Morrow 建议创建角色</strong>
        <dl className="team-proposal-fields">
          <dt>名称</dt>
          <dd>{proposal.role.name}</dd>
          <dt>模型</dt>
          <dd>{proposal.role.defaultRuntime === 'claude' ? 'Claude Code' : 'Codex'}</dd>
          <dt>简介</dt>
          <dd>{proposal.role.intro}</dd>
          <dt>指示词</dt>
          <dd className="team-proposal-instruction">{proposal.role.instruction}</dd>
        </dl>
      </div>
      <div className="team-proposal-actions">
        <button type="button" className="btn" onClick={() => onConfirm(proposal.id)}>
          确认创建
        </button>
        <button type="button" className="btn btn-muted" onClick={() => onDismiss(proposal.id)}>
          忽略
        </button>
      </div>
    </div>
  );
}

function renderWithMentions(text: string, roles: RoleProfile[]): ReactNode {
  const names = roles.map((role) => role.name).filter(Boolean);
  if (names.length === 0) return text;
  const pattern = new RegExp(`@(${names.map(escapeRegExp).join('|')})`, 'g');
  const nodes: ReactNode[] = [];
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      <span key={`${match.index}-${match[0]}`} className="mention-token">
        {match[0]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function systemLabel(type: ChannelEvent['type']): string {
  if (type === 'role_joined') return '角色已加入频道';
  if (type === 'handoff_accepted') return '交接已接受';
  if (type === 'folder_bound') return '频道已绑定文件夹';
  return '系统事件';
}
