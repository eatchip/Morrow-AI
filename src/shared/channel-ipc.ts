import type { RuntimeId } from './ipc';

export type ChannelEventType =
  | 'message_posted'
  | 'role_run_started'
  | 'role_message_posted'
  | 'role_run_failed'
  | 'handoff_proposed'
  | 'handoff_accepted'
  | 'role_joined'
  | 'folder_bound'
  | 'team_proposal_posted'
  | 'team_proposal_confirmed';

export type ChannelAuthorType = 'user' | 'role' | 'system';
export type RoleRunStatus = 'running' | 'done' | 'failed' | 'canceled';
export type RoleRunTrigger = 'mention' | 'handoff_accept';
export type HandoffStatus = 'proposed' | 'accepted' | 'canceled';

export interface Channel {
  id: string;
  name: string;
  description: string;
  folderProjectId: string | null;
  memberRoleIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RoleProfile {
  id: string;
  name: string;
  intro: string;
  instruction: string;
  defaultRuntime: RuntimeId;
  createdAt: number;
  updatedAt: number;
}

export interface ChannelEvent {
  id: string;
  channelId: string;
  type: ChannelEventType;
  authorType: ChannelAuthorType;
  roleId?: string;
  runId?: string;
  handoffId?: string;
  text?: string;
  createdAt: number;
}

export interface RoleRun {
  id: string;
  channelId: string;
  roleId: string;
  trigger: RoleRunTrigger;
  triggerEventId: string;
  inputText: string;
  status: RoleRunStatus;
  runtime: RuntimeId;
  createdAt: number;
  updatedAt: number;
}

export interface HandoffProposal {
  id: string;
  channelId: string;
  fromRoleId: string;
  toRoleId: string;
  sourceRunId: string;
  reason: string;
  instruction: string;
  status: HandoffStatus;
  createdAt: number;
  updatedAt: number;
}

export interface ChannelSnapshot {
  channels: Channel[];
  roles: RoleProfile[];
  events: ChannelEvent[];
  runs: RoleRun[];
  handoffs: HandoffProposal[];
  teamProposals: TeamProposal[];
}

export interface TeamProposal {
  id: string;
  channelId: string;
  runId: string;
  role: { name: string; intro: string; instruction: string; defaultRuntime: RuntimeId };
  status: 'proposed' | 'confirmed' | 'dismissed';
  createdAt: number;
}

export interface CreateChannelArgs {
  name: string;
  description?: string;
  folderProjectId?: string | null;
  memberRoleIds?: string[];
}

export interface CreateRoleArgs {
  name: string;
  intro: string;
  instruction: string;
  defaultRuntime: RuntimeId;
  channelIds?: string[];
}

export interface UpdateRoleArgs {
  roleId: string;
  name?: string;
  intro?: string;
  instruction?: string;
  defaultRuntime?: RuntimeId;
}

export interface DeleteRoleArgs {
  roleId: string;
}

export interface DeleteChannelArgs {
  channelId: string;
}

export interface AddRoleToChannelArgs {
  channelId: string;
  roleId: string;
}

export interface PostChannelMessageArgs {
  channelId: string;
  text: string;
}

export interface AcceptHandoffArgs {
  channelId: string;
  handoffId: string;
}

export interface ConfirmTeamProposalArgs {
  channelId: string;
  proposalId: string;
}

export interface DismissTeamProposalArgs {
  channelId: string;
  proposalId: string;
}

export type ChannelUiEvent =
  | { kind: 'snapshot'; snapshot: ChannelSnapshot }
  | { kind: 'run-chunk'; channelId: string; roleId: string; runId: string; text: string };

export interface ChannelsApi {
  getSnapshot(): Promise<ChannelSnapshot>;
  createChannel(args: CreateChannelArgs): Promise<ChannelSnapshot>;
  createRole(args: CreateRoleArgs): Promise<ChannelSnapshot>;
  updateRole(args: UpdateRoleArgs): Promise<ChannelSnapshot>;
  deleteRole(args: DeleteRoleArgs): Promise<ChannelSnapshot>;
  deleteChannel(args: DeleteChannelArgs): Promise<ChannelSnapshot>;
  addRoleToChannel(args: AddRoleToChannelArgs): Promise<ChannelSnapshot>;
  postMessage(args: PostChannelMessageArgs): Promise<ChannelSnapshot>;
  acceptHandoff(args: AcceptHandoffArgs): Promise<ChannelSnapshot>;
  confirmTeamProposal(args: ConfirmTeamProposalArgs): Promise<ChannelSnapshot>;
  dismissTeamProposal(args: DismissTeamProposalArgs): Promise<ChannelSnapshot>;
  onEvent(listener: (event: ChannelUiEvent) => void): () => void;
}
