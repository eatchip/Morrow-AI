import type {
  ChannelEvent,
  ConfirmTeamProposalArgs,
  CreateRoleArgs,
  DismissTeamProposalArgs,
  TeamProposal,
} from '../../../shared/channel-ipc';
import type { ChannelsFile } from './channels-file';
import { clone, rid } from './channels-file';

export function removeRoleReferences(file: ChannelsFile, roleId: string, now: number): void {
  file.roles = file.roles.filter((role) => role.id !== roleId);
  for (const channel of file.channels) {
    if (!channel.memberRoleIds.includes(roleId)) continue;
    channel.memberRoleIds = channel.memberRoleIds.filter((id) => id !== roleId);
    channel.updatedAt = now;
  }
  for (const handoff of file.handoffs) {
    if (handoff.status !== 'proposed') continue;
    if (handoff.fromRoleId !== roleId && handoff.toRoleId !== roleId) continue;
    handoff.status = 'canceled';
    handoff.updatedAt = now;
  }
  for (const run of file.runs) {
    if (run.roleId !== roleId || run.status !== 'running') continue;
    run.status = 'canceled';
    run.updatedAt = now;
  }
}

export function applyCreateTeamProposal(
  file: ChannelsFile,
  channelId: string,
  runId: string,
  role: TeamProposal['role'],
  makeEvent: (
    channelId: string,
    type: ChannelEvent['type'],
    authorType: ChannelEvent['authorType'],
    createdAt: number,
    extra: Record<string, unknown>,
  ) => ChannelEvent,
): TeamProposal {
  const now = Date.now();
  const proposal: TeamProposal = {
    id: rid('tp'),
    channelId,
    runId,
    role,
    status: 'proposed',
    createdAt: now,
  };
  file.teamProposals.push(proposal);
  file.events.push(
    makeEvent(channelId, 'team_proposal_posted', 'system', now, {
      text: `Morrow 建议创建角色：${role.name}`,
    }),
  );
  return proposal;
}

export function applyConfirmTeamProposal(
  file: ChannelsFile,
  args: ConfirmTeamProposalArgs,
  makeEvent: (
    channelId: string,
    type: ChannelEvent['type'],
    authorType: ChannelEvent['authorType'],
    createdAt: number,
    extra: Record<string, unknown>,
  ) => ChannelEvent,
): { proposal: TeamProposal; createRoleArgs: CreateRoleArgs } {
  const proposal = file.teamProposals.find(
    (p) => p.id === args.proposalId && p.channelId === args.channelId && p.status === 'proposed',
  );
  if (!proposal) throw new Error(`unknown team proposal: ${args.proposalId}`);
  proposal.status = 'confirmed';
  const now = Date.now();
  file.events.push(
    makeEvent(proposal.channelId, 'team_proposal_confirmed', 'system', now, {
      text: `已创建角色：${proposal.role.name}`,
    }),
  );
  return {
    proposal,
    createRoleArgs: {
      name: proposal.role.name,
      intro: proposal.role.intro,
      instruction: proposal.role.instruction,
      defaultRuntime: proposal.role.defaultRuntime,
      channelIds: [proposal.channelId],
    },
  };
}

export function applyDismissTeamProposal(file: ChannelsFile, args: DismissTeamProposalArgs): void {
  const proposal = file.teamProposals.find(
    (p) => p.id === args.proposalId && p.channelId === args.channelId && p.status === 'proposed',
  );
  if (!proposal) throw new Error(`unknown team proposal: ${args.proposalId}`);
  proposal.status = 'dismissed';
}

export function snapshotTeamProposals(file: ChannelsFile): TeamProposal[] {
  return clone(file.teamProposals);
}
