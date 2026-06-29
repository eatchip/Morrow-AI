import { app, dialog, ipcMain, type BrowserWindow } from 'electron';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { IPC_CHANNELS, type RuntimeRunStatus } from '../../shared/ipc';
import { detectRuntimes } from './runtime-detect';
import { abortSession, killAll, startSession } from './runtime-session';
import { ProjectsStore } from './projects-store';
import { ChannelOrchestrator } from '../../contexts/channels/application/channel-orchestrator';
import { ChannelsStore } from '../../contexts/channels/infrastructure/channels-store';
import {
  validateAcceptHandoffArgs,
  validateAddRoleToChannelArgs,
  validateConfirmTeamProposalArgs,
  validateCreateChannelArgs,
  validateCreateRoleArgs,
  validateDeleteChannelArgs,
  validateDeleteRoleArgs,
  validateDismissTeamProposalArgs,
  validatePostChannelMessageArgs,
  validatePtyAgentStartArgs,
  validatePtyResizeArgs,
  validatePtyWriteArgs,
  validateRunId,
  validateSendPromptArgs,
  validateUpdateRoleArgs,
} from './ipc-validate';
import { PtySessionManager } from './pty-session';
import { RuntimeRunSupervisor, type RuntimeLaneEvent } from './runtime-run-supervisor';

export {
  validateAcceptHandoffArgs,
  validateAddRoleToChannelArgs,
  validateConfirmTeamProposalArgs,
  validateCreateChannelArgs,
  validateCreateRoleArgs,
  validateDeleteChannelArgs,
  validateDeleteRoleArgs,
  validateDismissTeamProposalArgs,
  validatePostChannelMessageArgs,
  validatePtyAgentStartArgs,
  validatePtyResizeArgs,
  validatePtyWriteArgs,
  validateRunId,
  validateSendPromptArgs,
  validateUpdateRoleArgs,
};

export function registerIpc(win: BrowserWindow): { cleanup: () => void } {
  const projects = new ProjectsStore({ userDataDir: app.getPath('userData') });
  const channels = new ChannelsStore({ userDataDir: app.getPath('userData') });
  const ptySessions = new PtySessionManager(
    (event) => {
      if (win.isDestroyed()) return;
      win.webContents.send(IPC_CHANNELS.ptyData, event);
    },
    (event) => {
      if (win.isDestroyed()) return;
      win.webContents.send(IPC_CHANNELS.ptyExit, event);
    },
  );
  const runtimeRuns = new RuntimeRunSupervisor({
    deadlines: {
      firstOutputMs: 1_000,
      idleMs: 30_000,
      hardMs: 180_000,
    },
    emit: (event) => {
      if (win.isDestroyed()) return;
      win.webContents.send(IPC_CHANNELS.runEvent, event);
    },
  });
  // load() 是异步的；首次 list/add 调用都会走到 assertLoaded。
  // 立即 fire-and-forget load；即便失败也回退空数组，见 ProjectsStore.load 内部兜底。
  const projectsReady = projects.load();
  const channelsReady = channels.load();

  // 未选择项目时使用的"无项目隔离 cwd"：app userData 下一个空目录。
  // 目的：杜绝子进程继承 Electron 主进程 cwd（开发态 = 仓库根，打包态 = `/`），
  // 避免 Codex/Claude 自动加载随机目录的 AGENTS.md 等"项目级"约定文件。
  const noProjectCwd = join(app.getPath('userData'), 'no-project-cwd');
  mkdirSync(noProjectCwd, { recursive: true });

  async function resolveCwd(projectId: string | null | undefined): Promise<string | null> {
    await projectsReady;
    if (!projectId) return noProjectCwd;
    return projects.getAccessiblePath(projectId);
  }

  const channelOrchestrator = new ChannelOrchestrator({
    store: channels,
    folders: {
      resolve: (folderProjectId) => resolveCwd(folderProjectId),
    },
    runtime: {
      start: (args, emit) => startSession(args, emit),
      abort: (sessionId) => abortSession(sessionId),
    },
    emit: (event) => {
      if (win.isDestroyed()) return;
      win.webContents.send(IPC_CHANNELS.channelsEvent, event);
    },
  });

  function sendChannelSnapshot(snapshot: unknown): void {
    if (win.isDestroyed()) return;
    win.webContents.send(IPC_CHANNELS.channelsEvent, { kind: 'snapshot', snapshot });
  }

  ipcMain.handle(IPC_CHANNELS.detect, () => detectRuntimes());

  ipcMain.handle(IPC_CHANNELS.sendPrompt, async (_evt, rawArgs: unknown) => {
    if (!validateSendPromptArgs(rawArgs)) {
      throw new Error('invalid send-prompt args');
    }
    const cwd = await resolveCwd(rawArgs.projectId);
    if (cwd === null) {
      if (!win.isDestroyed()) {
        win.webContents.send(IPC_CHANNELS.stream, {
          sessionId: rawArgs.sessionId,
          kind: 'error',
          message: `project unavailable: ${rawArgs.projectId}`,
        });
      }
      return;
    }
    runtimeRuns.startRun({
      runId: rawArgs.sessionId,
      conversationId: rawArgs.conversationId ?? rawArgs.sessionId,
      runtime: rawArgs.runtime,
      lanes: {
        friendly: {
          cancel: () => abortSession(rawArgs.sessionId),
          kill: () => abortSession(rawArgs.sessionId),
          dispose: () => {},
        },
      },
    });
    startSession(
      {
        runtime: rawArgs.runtime,
        prompt: rawArgs.prompt,
        sessionId: rawArgs.sessionId,
        cwd,
        conversationId: rawArgs.conversationId ?? null,
        model: rawArgs.model,
        effort: rawArgs.effort,
      },
      (event) => {
        if (win.isDestroyed()) return;
        const laneEvent = streamToFriendlyLaneEvent(event);
        const terminalBeforeEvent = isTerminalStatus(runtimeRuns.snapshot(event.sessionId)?.status);
        if (laneEvent) {
          runtimeRuns.receiveLaneEvent(laneEvent);
          if (terminalBeforeEvent) return;
        }
        win.webContents.send(IPC_CHANNELS.stream, event);
      },
    );
  });

  ipcMain.handle(IPC_CHANNELS.abort, (_evt, sessionId: unknown) => {
    if (typeof sessionId !== 'string') return;
    runtimeRuns.cancelRun(sessionId, 'legacy_abort');
    abortSession(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.runCancel, (_evt, runId: unknown) => {
    if (!validateRunId(runId)) return;
    runtimeRuns.cancelRun(runId, 'user_cancel');
  });

  ipcMain.handle(IPC_CHANNELS.ptyStartAgent, async (_evt, rawArgs: unknown) => {
    if (!validatePtyAgentStartArgs(rawArgs)) {
      throw new Error('invalid pty start-agent args');
    }
    const cwd = await resolveCwd(rawArgs.projectId);
    if (cwd === null) {
      throw new Error(`project unavailable: ${rawArgs.projectId}`);
    }
    return ptySessions.startCodexAgentSession({
      cwd,
      prompt: rawArgs.prompt,
      model: rawArgs.model,
      effort: rawArgs.effort,
      cols: rawArgs.cols,
      rows: rawArgs.rows,
    });
  });

  ipcMain.handle(IPC_CHANNELS.ptyWrite, (_evt, rawArgs: unknown) => {
    if (!validatePtyWriteArgs(rawArgs)) {
      throw new Error('invalid pty write args');
    }
    ptySessions.write(rawArgs.sessionId, rawArgs.data, rawArgs.encoding);
  });

  ipcMain.handle(IPC_CHANNELS.ptyResize, (_evt, rawArgs: unknown) => {
    if (!validatePtyResizeArgs(rawArgs)) {
      throw new Error('invalid pty resize args');
    }
    ptySessions.resize(rawArgs.sessionId, rawArgs.cols, rawArgs.rows);
  });

  ipcMain.handle(IPC_CHANNELS.ptyKill, (_evt, sessionId: unknown) => {
    if (typeof sessionId !== 'string' || sessionId.length === 0) return;
    ptySessions.kill(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.ptySnapshot, (_evt, sessionId: unknown) => {
    if (typeof sessionId !== 'string' || sessionId.length === 0) {
      throw new Error('invalid pty snapshot args');
    }
    return ptySessions.snapshot(sessionId);
  });

  ipcMain.handle(IPC_CHANNELS.projectsList, async () => {
    await projectsReady;
    return projects.list();
  });

  ipcMain.handle(IPC_CHANNELS.projectsAdd, async () => {
    await projectsReady;
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const target = result.filePaths[0]!;
    return projects.add(target);
  });

  ipcMain.handle(IPC_CHANNELS.projectsRemove, async (_evt, id: unknown) => {
    await projectsReady;
    if (typeof id !== 'string') return;
    await projects.remove(id);
  });

  ipcMain.handle(IPC_CHANNELS.channelsGetSnapshot, async () => {
    await channelsReady;
    return channelOrchestrator.getSnapshot();
  });

  ipcMain.handle(IPC_CHANNELS.channelsCreateChannel, async (_evt, rawArgs: unknown) => {
    if (!validateCreateChannelArgs(rawArgs)) throw new Error('invalid create channel args');
    await channelsReady;
    const snapshot = await channels.createChannel(rawArgs);
    sendChannelSnapshot(snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.channelsCreateRole, async (_evt, rawArgs: unknown) => {
    if (!validateCreateRoleArgs(rawArgs)) throw new Error('invalid create role args');
    await channelsReady;
    const snapshot = await channels.createRole(rawArgs);
    sendChannelSnapshot(snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.channelsUpdateRole, async (_evt, rawArgs: unknown) => {
    if (!validateUpdateRoleArgs(rawArgs)) throw new Error('invalid update role args');
    await channelsReady;
    const snapshot = await channels.updateRole(rawArgs);
    sendChannelSnapshot(snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.channelsDeleteRole, async (_evt, rawArgs: unknown) => {
    if (!validateDeleteRoleArgs(rawArgs)) throw new Error('invalid delete role args');
    await channelsReady;
    const snapshot = await channels.deleteRole(rawArgs);
    sendChannelSnapshot(snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.channelsDeleteChannel, async (_evt, rawArgs: unknown) => {
    if (!validateDeleteChannelArgs(rawArgs)) throw new Error('invalid delete channel args');
    await channelsReady;
    return channelOrchestrator.deleteChannel(rawArgs);
  });

  ipcMain.handle(IPC_CHANNELS.channelsAddRoleToChannel, async (_evt, rawArgs: unknown) => {
    if (!validateAddRoleToChannelArgs(rawArgs)) {
      throw new Error('invalid add role to channel args');
    }
    await channelsReady;
    const snapshot = await channels.addRoleToChannel(rawArgs);
    sendChannelSnapshot(snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.channelsPostMessage, async (_evt, rawArgs: unknown) => {
    if (!validatePostChannelMessageArgs(rawArgs)) throw new Error('invalid channel message args');
    await channelsReady;
    // oxlint-disable-next-line require-post-message-target-origin
    return channelOrchestrator.postMessage(rawArgs);
  });

  ipcMain.handle(IPC_CHANNELS.channelsAcceptHandoff, async (_evt, rawArgs: unknown) => {
    if (!validateAcceptHandoffArgs(rawArgs)) throw new Error('invalid accept handoff args');
    await channelsReady;
    return channelOrchestrator.acceptHandoff(rawArgs);
  });

  ipcMain.handle(IPC_CHANNELS.channelsConfirmTeamProposal, async (_evt, rawArgs: unknown) => {
    if (!validateConfirmTeamProposalArgs(rawArgs)) {
      throw new Error('invalid confirm team proposal args');
    }
    await channelsReady;
    const snapshot = await channels.confirmTeamProposal(rawArgs);
    sendChannelSnapshot(snapshot);
    return snapshot;
  });

  ipcMain.handle(IPC_CHANNELS.channelsDismissTeamProposal, async (_evt, rawArgs: unknown) => {
    if (!validateDismissTeamProposalArgs(rawArgs)) {
      throw new Error('invalid dismiss team proposal args');
    }
    await channelsReady;
    const snapshot = await channels.dismissTeamProposal(rawArgs);
    sendChannelSnapshot(snapshot);
    return snapshot;
  });

  return {
    cleanup: () => {
      runtimeRuns.dispose();
      killAll();
      ptySessions.dispose();
    },
  };
}

function streamToFriendlyLaneEvent(
  event: import('../../shared/ipc').StreamEvent,
): RuntimeLaneEvent | null {
  if (event.kind === 'chunk') {
    return { runId: event.sessionId, lane: 'friendly', kind: 'chunk', text: event.text };
  }
  if (event.kind === 'done') {
    return { runId: event.sessionId, lane: 'friendly', kind: 'done', exitCode: event.exitCode };
  }
  return { runId: event.sessionId, lane: 'friendly', kind: 'error', message: event.message };
}

function isTerminalStatus(status: RuntimeRunStatus | undefined): boolean {
  return status === 'done' || status === 'error' || status === 'canceled' || status === 'timeout';
}
