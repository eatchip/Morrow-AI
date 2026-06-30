import { contextBridge, ipcRenderer } from 'electron';
import type {
  MorrowApi,
  ChannelUiEvent,
  PtyDataEvent,
  PtyExitEvent,
  RuntimeRunEvent,
  StreamEvent,
} from '../../shared/ipc';
import { IPC_CHANNELS } from '../../shared/ipc';
import { createMockApi } from './mock-api';

function createRealApi(): MorrowApi {
  return {
    detectRuntimes: () => ipcRenderer.invoke(IPC_CHANNELS.detect),
    sendPrompt: (args) => ipcRenderer.invoke(IPC_CHANNELS.sendPrompt, args),
    abortSession: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.abort, sessionId),
    onStream: (listener) => {
      const wrapped = (_: unknown, e: StreamEvent): void => listener(e);
      ipcRenderer.on(IPC_CHANNELS.stream, wrapped);
      return () => {
        ipcRenderer.off(IPC_CHANNELS.stream, wrapped);
      };
    },
    cancelRun: (runId) => ipcRenderer.invoke(IPC_CHANNELS.runCancel, runId),
    onRunEvent: (listener) => {
      const wrapped = (_: unknown, e: RuntimeRunEvent): void => listener(e);
      ipcRenderer.on(IPC_CHANNELS.runEvent, wrapped);
      return () => {
        ipcRenderer.off(IPC_CHANNELS.runEvent, wrapped);
      };
    },
    pty: {
      startAgentSession: (args) => ipcRenderer.invoke(IPC_CHANNELS.ptyStartAgent, args),
      write: (args) => ipcRenderer.invoke(IPC_CHANNELS.ptyWrite, args),
      resize: (args) => ipcRenderer.invoke(IPC_CHANNELS.ptyResize, args),
      kill: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.ptyKill, sessionId),
      snapshot: (sessionId) => ipcRenderer.invoke(IPC_CHANNELS.ptySnapshot, sessionId),
      onData: (listener) => {
        const wrapped = (_: unknown, e: PtyDataEvent): void => listener(e);
        ipcRenderer.on(IPC_CHANNELS.ptyData, wrapped);
        return () => {
          ipcRenderer.off(IPC_CHANNELS.ptyData, wrapped);
        };
      },
      onExit: (listener) => {
        const wrapped = (_: unknown, e: PtyExitEvent): void => listener(e);
        ipcRenderer.on(IPC_CHANNELS.ptyExit, wrapped);
        return () => {
          ipcRenderer.off(IPC_CHANNELS.ptyExit, wrapped);
        };
      },
    },
    listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.projectsList),
    addProject: () => ipcRenderer.invoke(IPC_CHANNELS.projectsAdd),
    removeProject: (id) => ipcRenderer.invoke(IPC_CHANNELS.projectsRemove, id),
    channels: {
      getSnapshot: () => ipcRenderer.invoke(IPC_CHANNELS.channelsGetSnapshot),
      createChannel: (args) => ipcRenderer.invoke(IPC_CHANNELS.channelsCreateChannel, args),
      createRole: (args) => ipcRenderer.invoke(IPC_CHANNELS.channelsCreateRole, args),
      updateRole: (args) => ipcRenderer.invoke(IPC_CHANNELS.channelsUpdateRole, args),
      deleteRole: (args) => ipcRenderer.invoke(IPC_CHANNELS.channelsDeleteRole, args),
      deleteChannel: (args) => ipcRenderer.invoke(IPC_CHANNELS.channelsDeleteChannel, args),
      addRoleToChannel: (args) => ipcRenderer.invoke(IPC_CHANNELS.channelsAddRoleToChannel, args),
      postMessage: (args) => ipcRenderer.invoke(IPC_CHANNELS.channelsPostMessage, args),
      acceptHandoff: (args) => ipcRenderer.invoke(IPC_CHANNELS.channelsAcceptHandoff, args),
      confirmTeamProposal: (args) =>
        ipcRenderer.invoke(IPC_CHANNELS.channelsConfirmTeamProposal, args),
      dismissTeamProposal: (args) =>
        ipcRenderer.invoke(IPC_CHANNELS.channelsDismissTeamProposal, args),
      onEvent: (listener) => {
        const wrapped = (_: unknown, e: ChannelUiEvent): void => listener(e);
        ipcRenderer.on(IPC_CHANNELS.channelsEvent, wrapped);
        return () => {
          ipcRenderer.off(IPC_CHANNELS.channelsEvent, wrapped);
        };
      },
    },
  };
}

const isE2E = process.argv.includes('--morrow-e2e');
const api: MorrowApi = isE2E ? createMockApi() : createRealApi();

try {
  contextBridge.exposeInMainWorld('morrowApi', api);
} catch (error) {
  console.error('[preload] failed to expose morrowApi:', error);
}
