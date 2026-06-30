export type {
  AcceptHandoffArgs,
  AddRoleToChannelArgs,
  Channel,
  ChannelEvent,
  ChannelSnapshot,
  ChannelUiEvent,
  ChannelsApi,
  ConfirmTeamProposalArgs,
  CreateChannelArgs,
  CreateRoleArgs,
  DeleteChannelArgs,
  DeleteRoleArgs,
  DismissTeamProposalArgs,
  HandoffProposal,
  PostChannelMessageArgs,
  RoleProfile,
  RoleRun,
  TeamProposal,
  UpdateRoleArgs,
} from './channel-ipc';

/**
 * IPC contract shared by main / preload / renderer.
 * 这是 Morrow 唯一的进程间公共接口，改动需同步更新三端。
 */

export type RuntimeId = 'claude' | 'codex';

export const RUNTIME_IDS: readonly RuntimeId[] = ['claude', 'codex'] as const;

export interface RuntimeInfo {
  id: RuntimeId;
  installed: boolean;
  version: string | null;
  binaryPath: string | null;
  error: string | null;
}

export interface DetectResult {
  claude: RuntimeInfo;
  codex: RuntimeInfo;
}

/**
 * Project = 持久化的本地文件夹绑定；由主进程拥有（userData/projects.json）。
 * Conversation 可选地归属到一个 Project，对应 CLI spawn 的 cwd。
 */
export interface Project {
  id: string;
  name: string;
  path: string;
  createdAt: number;
  lastUsedAt: number;
  /** 首次出现"目录不可访问"后会被置 true；仅用于 UI 提示，不自动清理 */
  invalid?: boolean;
}

/**
 * codex reasoning effort 档位。claude 目前不支持同维度开关。
 * 新增档位时这里是唯一事实来源，主/preload/renderer 三端共享。
 * 值对齐 codex-cli v0.130 TUI 的 `Select Model and Effort`（含 `xhigh`）。
 */
export const EFFORT_LEVELS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

/**
 * 模型 ID 白名单。升级 CLI 支持的新模型时改动这里即可。
 * 禁止运行时动态拉取（两个 CLI 均无稳定 list-models API）。
 * codex 值对齐 codex-cli v0.130 ChatGPT 账号模式 TUI 的 `/model` 列表；
 * API key 模式下的旧 id（gpt-5 / gpt-5-codex / o3）会被服务端拒绝，因此不再列出。
 */
export const CODEX_MODELS = [
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini',
  'gpt-5.3-codex',
  'gpt-5.3-codex-spark',
  'gpt-5.2',
] as const;
export const CLAUDE_MODELS = ['sonnet', 'opus', 'haiku'] as const;
export type CodexModel = (typeof CODEX_MODELS)[number];
export type ClaudeModel = (typeof CLAUDE_MODELS)[number];

/**
 * IPC 边界接受的 model 字符串正则。渲染层常量虽是白名单，但 IPC 边界仍以此正则兜底——
 * 防御渲染层或 preload 被绕过后的命令注入（空格、反引号、`$()`、管道符等都不满足）。
 * 唯一合法字符：字母、数字、`.`、`_`、`:`、`-`；长度 1–64。
 */
export const MODEL_ID_REGEX = /^[A-Za-z0-9._:-]{1,64}$/;

export interface SendPromptArgs {
  runtime: RuntimeId;
  prompt: string;
  sessionId: string;
  /** 可选项目绑定；主进程据此解析 cwd。禁止直接传 path，仅接受 id 防逃逸 */
  projectId?: string | null;
  /**
   * 上层会话 id（renderer 的 conversation.id）。仅 codex 路径用于跨轮 thread 复用；
   * 主进程不持久化，进程退出即丢。Renderer 创建/切换 conversation 时透传即可。
   */
  conversationId?: string | null;
  /**
   * 可选模型 ID。校验唯一发生在主进程（见 `main/ipc.ts`）。
   * 缺省时不注入 CLI flag，走 CLI 默认值——保证老会话零回退。
   */
  model?: string;
  /** 可选 reasoning effort。仅 codex runtime 会被实际注入 CLI。 */
  effort?: EffortLevel;
}

export type StreamEvent =
  | { sessionId: string; kind: 'chunk'; text: string }
  | { sessionId: string; kind: 'done'; exitCode: number }
  | { sessionId: string; kind: 'error'; message: string };

export type RuntimeLaneId = 'fast' | 'friendly';
export type RuntimeRunActiveStatus = 'created' | 'starting' | 'running' | 'streaming';
export type RuntimeRunTerminalStatus = 'done' | 'error' | 'canceled' | 'timeout';
export type RuntimeRunStatus = RuntimeRunActiveStatus | RuntimeRunTerminalStatus;
export type RuntimeRunDeadline = 'first-output' | 'idle' | 'hard';

export interface RuntimeRunSnapshot {
  runId: string;
  conversationId: string;
  runtime: RuntimeId;
  status: RuntimeRunStatus;
  createdAt: number;
  updatedAt: number;
  firstOutputAt: number | null;
  settledAt: number | null;
  reason: string | null;
}

export type RuntimeRunEvent =
  | { kind: 'run-started'; run: RuntimeRunSnapshot }
  | { kind: 'run-first-output'; runId: string; lane: RuntimeLaneId; at: number }
  | { kind: 'friendly-chunk'; runId: string; text: string; at: number }
  | { kind: 'deadline'; runId: string; deadline: RuntimeRunDeadline; at: number }
  | {
      kind: 'run-settled';
      runId: string;
      status: RuntimeRunTerminalStatus;
      reason: string | null;
      at: number;
    }
  | { kind: 'late-lane-event'; runId: string; lane: RuntimeLaneId; laneEventKind: string };

export type PtyWriteEncoding = 'utf8' | 'binary';

export interface PtyAgentStartArgs {
  runtime: RuntimeId;
  prompt: string;
  /** 可选项目绑定；主进程据此解析 cwd。禁止直接传 path，仅接受 id 防逃逸 */
  projectId?: string | null;
  model?: string;
  effort?: EffortLevel;
  cols: number;
  rows: number;
}

export interface PtyAgentStartResult {
  sessionId: string;
}

export interface PtyWriteArgs {
  sessionId: string;
  data: string;
  encoding?: PtyWriteEncoding;
}

export interface PtyResizeArgs {
  sessionId: string;
  cols: number;
  rows: number;
}

export interface PtySnapshotResult {
  sessionId: string;
  seq: number;
  data: string;
  exited: boolean;
  exitCode: number | null;
}

export interface PtyDataEvent {
  sessionId: string;
  seq: number;
  data: string;
}

export interface PtyExitEvent {
  sessionId: string;
  exitCode: number;
}

export interface MorrowApi {
  detectRuntimes(): Promise<DetectResult>;
  sendPrompt(args: SendPromptArgs): Promise<void>;
  abortSession(sessionId: string): Promise<void>;
  onStream(listener: (e: StreamEvent) => void): () => void;
  cancelRun(runId: string): Promise<void>;
  onRunEvent(listener: (e: RuntimeRunEvent) => void): () => void;
  pty: {
    startAgentSession(args: PtyAgentStartArgs): Promise<PtyAgentStartResult>;
    write(args: PtyWriteArgs): Promise<void>;
    resize(args: PtyResizeArgs): Promise<void>;
    kill(sessionId: string): Promise<void>;
    snapshot(sessionId: string): Promise<PtySnapshotResult>;
    onData(listener: (e: PtyDataEvent) => void): () => void;
    onExit(listener: (e: PtyExitEvent) => void): () => void;
  };
  listProjects(): Promise<Project[]>;
  /** 打开系统目录选择器；用户取消返回 null */
  addProject(): Promise<Project | null>;
  removeProject(id: string): Promise<void>;
  channels: import('./channel-ipc').ChannelsApi;
}

/** IPC channel names — 唯一事实来源，禁止在别处写字符串字面量。 */
export const IPC_CHANNELS = {
  detect: 'runtime:detect',
  sendPrompt: 'runtime:send-prompt',
  abort: 'runtime:abort',
  stream: 'runtime:stream',
  runCancel: 'runtime:run-cancel',
  runEvent: 'runtime:run-event',
  ptyStartAgent: 'pty:start-agent',
  ptyWrite: 'pty:write',
  ptyResize: 'pty:resize',
  ptyKill: 'pty:kill',
  ptySnapshot: 'pty:snapshot',
  ptyData: 'pty:data',
  ptyExit: 'pty:exit',
  projectsList: 'projects:list',
  projectsAdd: 'projects:add',
  projectsRemove: 'projects:remove',
  channelsGetSnapshot: 'channels:get-snapshot',
  channelsCreateChannel: 'channels:create-channel',
  channelsCreateRole: 'channels:create-role',
  channelsUpdateRole: 'channels:update-role',
  channelsDeleteRole: 'channels:delete-role',
  channelsDeleteChannel: 'channels:delete-channel',
  channelsAddRoleToChannel: 'channels:add-role-to-channel',
  channelsPostMessage: 'channels:post-message',
  channelsAcceptHandoff: 'channels:accept-handoff',
  channelsConfirmTeamProposal: 'channels:confirm-team-proposal',
  channelsDismissTeamProposal: 'channels:dismiss-team-proposal',
  channelsEvent: 'channels:event',
} as const;
