import type {
  ChannelSnapshot,
  ChannelUiEvent,
  DetectResult,
  MorrowApi,
  Project,
  PtyDataEvent,
  PtyExitEvent,
  RuntimeRunEvent,
  StreamEvent,
} from '../../shared/ipc';

/**
 * E2E 专用的内存态 mock：在 MORROW_E2E=1 下启用。
 * - 两个 runtime 默认都报 installed，保证 renderer 可进入 home 场景；
 * - sendPrompt 立即 resolve 并通过 microtask 广播假 chunk + done；
 * - 不触达 ipcMain，不 spawn 任何子进程。
 */
export function createMockApi(): MorrowApi {
  const listeners = new Set<(e: StreamEvent) => void>();
  const runListeners = new Set<(e: RuntimeRunEvent) => void>();
  const ptyDataListeners = new Set<(e: PtyDataEvent) => void>();
  const ptyExitListeners = new Set<(e: PtyExitEvent) => void>();
  const mockDetect: DetectResult = {
    claude: { id: 'claude', installed: true, version: '9.9.9', binaryPath: null, error: null },
    codex: { id: 'codex', installed: true, version: '9.9.9', binaryPath: null, error: null },
  };
  const mockProjects: Project[] = [];
  const now = Date.now();
  const mockChannels: ChannelSnapshot = {
    channels: [],
    roles: [
      {
        id: 'role-design',
        name: '设计师',
        intro: '负责界面',
        instruction: '给出具体设计建议。',
        defaultRuntime: 'claude',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'role-engineer',
        name: '工程师',
        intro: '负责实现',
        instruction: '给出具体实现建议。',
        defaultRuntime: 'codex',
        createdAt: now,
        updatedAt: now,
      },
    ],
    events: [],
    runs: [],
    handoffs: [],
    teamProposals: [],
  };
  const channelListeners = new Set<(event: ChannelUiEvent) => void>();
  const mockPtys = new Map<
    string,
    {
      seq: number;
      data: string;
      exited: boolean;
      exitCode: number | null;
      pendingApprovalCommand: string | null;
    }
  >();
  let mockSeq = 0;

  const emitPtyData = (sessionId: string, data: string): void => {
    const state = mockPtys.get(sessionId);
    if (!state) return;
    state.seq += 1;
    state.data += data;
    const event: PtyDataEvent = { sessionId, seq: state.seq, data };
    for (const fn of ptyDataListeners) fn(event);
  };

  const emitRun = (event: RuntimeRunEvent): void => {
    for (const fn of runListeners) fn(event);
  };

  const emitChannelSnapshot = (): void => {
    const event: ChannelUiEvent = {
      kind: 'snapshot',
      snapshot: JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot,
    };
    for (const fn of channelListeners) fn(event);
  };

  return {
    detectRuntimes: () => Promise.resolve(mockDetect),
    sendPrompt: (args) => {
      const startedAt = Date.now();
      emitRun({
        kind: 'run-started',
        run: {
          runId: args.sessionId,
          conversationId: args.conversationId ?? args.sessionId,
          runtime: args.runtime,
          status: 'running',
          createdAt: startedAt,
          updatedAt: startedAt,
          firstOutputAt: null,
          settledAt: null,
          reason: null,
        },
      });
      if (args.prompt.includes('[stuck]')) {
        setTimeout(() => {
          emitRun({
            kind: 'deadline',
            runId: args.sessionId,
            deadline: 'first-output',
            at: Date.now(),
          });
        }, 80);
        setTimeout(() => {
          emitRun({
            kind: 'run-settled',
            runId: args.sessionId,
            status: 'timeout',
            reason: 'mock_timeout',
            at: Date.now(),
          });
        }, 700);
        return Promise.resolve();
      }
      setTimeout(
        () => {
          const text = args.runtime === 'codex' ? `结构化回复：${args.prompt}` : 'hi';
          emitRun({
            kind: 'run-first-output',
            runId: args.sessionId,
            lane: 'friendly',
            at: Date.now(),
          });
          for (const fn of listeners) {
            fn({ sessionId: args.sessionId, kind: 'chunk', text });
            fn({ sessionId: args.sessionId, kind: 'done', exitCode: 0 });
          }
          emitRun({
            kind: 'run-settled',
            runId: args.sessionId,
            status: 'done',
            reason: null,
            at: Date.now(),
          });
        },
        args.prompt.includes('[slow]') ? 1500 : 20,
      );
      return Promise.resolve();
    },
    abortSession: () => Promise.resolve(),
    onStream: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    cancelRun: (runId) => {
      emitRun({
        kind: 'run-settled',
        runId,
        status: 'canceled',
        reason: 'user_cancel',
        at: Date.now(),
      });
      return Promise.resolve();
    },
    onRunEvent: (listener) => {
      runListeners.add(listener);
      return () => {
        runListeners.delete(listener);
      };
    },
    pty: {
      startAgentSession: (args) => {
        mockSeq += 1;
        const sessionId = `pty-mock-${mockSeq}`;
        const pendingApprovalCommand = args.prompt.includes('approval')
          ? 'mock-command --safe'
          : null;
        mockPtys.set(sessionId, {
          seq: 0,
          data: '',
          exited: false,
          exitCode: null,
          pendingApprovalCommand,
        });
        setTimeout(() => {
          const approval = pendingApprovalCommand
            ? `Approval required to run command: ${pendingApprovalCommand}\r\nPress Enter to approve, Esc to reject\r\n`
            : '';
          emitPtyData(
            sessionId,
            `Codex CLI\r\n> ${args.prompt}\r\n✨ Update available! 0.130.0 -> 0.131.0\r\nRun npm install -g @openai/codex to update.\r\n• 我会直接处理这个请求。 ›Run /review on my current changesgpt-5.5 medium · ~/Library/Application Support/morrow/no-project-cwd\r\n• Running networkQuality -v\r\n${approval}`,
          );
        }, 20);
        return Promise.resolve({ sessionId });
      },
      write: (args) => {
        const state = mockPtys.get(args.sessionId);
        if (state?.pendingApprovalCommand && args.data === '\r') {
          const command = state.pendingApprovalCommand;
          state.pendingApprovalCommand = null;
          emitPtyData(
            args.sessionId,
            `✓ You approved codex to run ${command} this time\r\n• Ran ${command}\r\n• 已完成。\r\n`,
          );
          return Promise.resolve();
        }
        if (state?.pendingApprovalCommand && args.data === '\x1b') {
          const command = state.pendingApprovalCommand;
          state.pendingApprovalCommand = null;
          emitPtyData(args.sessionId, `Rejected command: ${command}\r\n`);
          return Promise.resolve();
        }
        const esc = String.fromCharCode(27);
        const prompt = args.data
          .split(`${esc}[200~`)
          .join('')
          .split(`${esc}[201~`)
          .join('')
          .split('\r')
          .join('')
          .trim();
        emitPtyData(args.sessionId, `\r\n> ${prompt}\r\n• 收到：${prompt}\r\n`);
        return Promise.resolve();
      },
      resize: () => Promise.resolve(),
      kill: (sessionId) => {
        const state = mockPtys.get(sessionId);
        if (state) {
          state.exited = true;
          state.exitCode = 0;
        }
        for (const fn of ptyExitListeners) fn({ sessionId, exitCode: 0 });
        return Promise.resolve();
      },
      snapshot: (sessionId) => {
        const state = mockPtys.get(sessionId) ?? {
          seq: 0,
          data: '',
          exited: false,
          exitCode: null,
          pendingApprovalCommand: null,
        };
        return Promise.resolve({ sessionId, ...state });
      },
      onData: (listener) => {
        ptyDataListeners.add(listener);
        return () => {
          ptyDataListeners.delete(listener);
        };
      },
      onExit: (listener) => {
        ptyExitListeners.add(listener);
        return () => {
          ptyExitListeners.delete(listener);
        };
      },
    },
    listProjects: () => Promise.resolve(mockProjects.slice()),
    addProject: () => {
      mockSeq += 1;
      const createdAt = Date.now();
      const p: Project = {
        id: `p-mock-${mockSeq}`,
        name: `mock-${mockSeq}`,
        path: `/tmp/mock-${mockSeq}`,
        createdAt,
        lastUsedAt: createdAt,
      };
      mockProjects.unshift(p);
      return Promise.resolve(p);
    },
    removeProject: (id) => {
      const idx = mockProjects.findIndex((p) => p.id === id);
      if (idx >= 0) mockProjects.splice(idx, 1);
      return Promise.resolve();
    },
    channels: {
      getSnapshot: () =>
        Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot),
      createChannel: (args) => {
        const channel = {
          id: `channel-${mockChannels.channels.length + 1}`,
          name: args.name.replace(/^#+/, ''),
          description: args.description ?? '',
          folderProjectId: args.folderProjectId ?? null,
          memberRoleIds: args.memberRoleIds ?? [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        mockChannels.channels.unshift(channel);
        emitChannelSnapshot();
        return Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot);
      },
      createRole: (args) => {
        const role = {
          id: `role-${mockChannels.roles.length + 1}`,
          name: args.name,
          intro: args.intro,
          instruction: args.instruction,
          defaultRuntime: args.defaultRuntime,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        mockChannels.roles.push(role);
        for (const channelId of args.channelIds ?? []) {
          const channel = mockChannels.channels.find((item) => item.id === channelId);
          if (channel && !channel.memberRoleIds.includes(role.id))
            channel.memberRoleIds.push(role.id);
        }
        emitChannelSnapshot();
        return Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot);
      },
      updateRole: (args) => {
        const role = mockChannels.roles.find((item) => item.id === args.roleId);
        if (role) Object.assign(role, args, { updatedAt: Date.now() });
        emitChannelSnapshot();
        return Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot);
      },
      deleteRole: (args) => {
        mockChannels.roles = mockChannels.roles.filter((item) => item.id !== args.roleId);
        for (const channel of mockChannels.channels) {
          channel.memberRoleIds = channel.memberRoleIds.filter((id) => id !== args.roleId);
        }
        emitChannelSnapshot();
        return Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot);
      },
      deleteChannel: (args) => {
        mockChannels.channels = mockChannels.channels.filter((item) => item.id !== args.channelId);
        mockChannels.events = mockChannels.events.filter(
          (item) => item.channelId !== args.channelId,
        );
        mockChannels.runs = mockChannels.runs.filter((item) => item.channelId !== args.channelId);
        mockChannels.handoffs = mockChannels.handoffs.filter(
          (item) => item.channelId !== args.channelId,
        );
        emitChannelSnapshot();
        return Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot);
      },
      addRoleToChannel: (args) => {
        const channel = mockChannels.channels.find((item) => item.id === args.channelId);
        if (channel && !channel.memberRoleIds.includes(args.roleId)) {
          channel.memberRoleIds.push(args.roleId);
        }
        emitChannelSnapshot();
        return Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot);
      },
      postMessage: (args) => {
        mockChannels.events.push({
          id: `event-${mockChannels.events.length + 1}`,
          channelId: args.channelId,
          type: 'message_posted',
          authorType: 'user',
          text: args.text,
          createdAt: Date.now(),
        });
        emitChannelSnapshot();
        return Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot);
      },
      acceptHandoff: () =>
        Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot),
      confirmTeamProposal: () =>
        Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot),
      dismissTeamProposal: () =>
        Promise.resolve(JSON.parse(JSON.stringify(mockChannels)) as ChannelSnapshot),
      onEvent: (listener) => {
        channelListeners.add(listener);
        return () => {
          channelListeners.delete(listener);
        };
      },
    },
  };
}
