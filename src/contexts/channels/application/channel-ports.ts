import type {
  AcceptHandoffArgs,
  ChannelSnapshot,
  DeleteChannelArgs,
  ChannelUiEvent,
  PostChannelMessageArgs,
  RoleRun,
  TeamProposal,
} from '../../../shared/channel-ipc';
import type { RuntimeId, StreamEvent } from '../../../shared/ipc';

export interface RunsPatch {
  snapshot: ChannelSnapshot;
  runsToStart: RoleRun[];
}

export interface DeleteChannelPatch {
  snapshot: ChannelSnapshot;
  runIdsToAbort: string[];
}

export interface ChannelStorePort {
  getSnapshot(): ChannelSnapshot;
  deleteChannel(args: DeleteChannelArgs): Promise<DeleteChannelPatch>;
  postUserMessage(args: PostChannelMessageArgs): Promise<RunsPatch>;
  completeRoleRun(runId: string, text: string): Promise<ChannelSnapshot>;
  failRoleRun(runId: string, message: string): Promise<ChannelSnapshot>;
  acceptHandoff(args: AcceptHandoffArgs): Promise<RunsPatch>;
  createTeamProposal(
    channelId: string,
    runId: string,
    role: TeamProposal['role'],
  ): Promise<ChannelSnapshot>;
}

export interface RuntimeStartArgs {
  runtime: RuntimeId;
  prompt: string;
  sessionId: string;
  cwd: string;
  conversationId: string;
}

export interface RoleRuntimePort {
  start(args: RuntimeStartArgs, emit: (event: StreamEvent) => void): void;
  abort(sessionId: string): void;
}

export interface ChannelFolderResolver {
  resolve(folderProjectId: string | null): Promise<string | null>;
}

export type ChannelEventSink = (event: ChannelUiEvent) => void;
