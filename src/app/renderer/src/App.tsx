import { useCallback, useEffect, useRef, useState } from 'react';
import type { DetectResult, Project, RuntimeId } from '../../../shared/ipc';
import { Splash } from './screens/Splash';
import { Install } from './screens/Install';
import { Home } from './screens/Home';
import { Chat, type Msg } from './screens/Chat';
import { ChannelWorkspace } from './screens/ChannelWorkspace';
import { RuntimeBadge } from './components/RuntimeBadge';
import { Sidebar, type Conversation } from './components/Sidebar';
import { RoleDrawer } from './components/RoleDrawer';
import {
  ChannelCreateDialog,
  ChannelDissolveDialog,
  RoleCreateDialog,
} from './components/WorkspaceDialogs';
import {
  deleteConversation,
  deriveConversationTitle,
  evictEmptyOnLeave,
} from './lib/conversations';
import { type AgentPrefs, DEFAULT_AGENT_PREFS, loadPrefs, savePrefs } from './lib/agent-prefs';
import {
  removeStreamingForConversation,
  useSendMessage,
  type StreamingRegistry,
} from './lib/use-send-message';
import { useChannelWorkspace } from './lib/use-channel-workspace';
import { useRuntimeRunStatus } from './lib/use-runtime-run-status';

type Scene = 'splash' | 'install' | 'home' | 'chat' | 'channel';

export function App() {
  const [scene, setScene] = useState<Scene>('splash');
  const [runtimes, setRuntimes] = useState<DetectResult | null>(null);
  const [current, setCurrent] = useState<RuntimeId | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<AgentPrefs>(DEFAULT_AGENT_PREFS);
  const prefsHydratedRef = useRef(false);
  const streamingRef = useRef<StreamingRegistry>({});
  const activeIdRef = useRef<string | null>(null);
  const draftByConversationRef = useRef<Record<string, string>>({});

  const setActiveIdWithEviction = useCallback((nextId: string | null) => {
    const prevId = activeIdRef.current;
    if (prevId && prevId !== nextId) {
      setConversations((convs) => {
        const pendingDraft = draftByConversationRef.current[prevId];
        const hydrated =
          pendingDraft === undefined
            ? convs
            : convs.map((conv) => {
                if (conv.id !== prevId || conv.draft === pendingDraft) return conv;
                const isEmptyConversation = conv.messages.length === 0;
                return {
                  ...conv,
                  draft: pendingDraft,
                  title: isEmptyConversation ? deriveConversationTitle(pendingDraft) : conv.title,
                  updatedAt: isEmptyConversation ? Date.now() : conv.updatedAt,
                };
              });
        return evictEmptyOnLeave(hydrated, prevId, nextId);
      });
    }
    activeIdRef.current = nextId;
    setActiveId(nextId);
  }, []);

  const refreshProjects = useCallback(async () => {
    const list = await window.morrowApi.listProjects();
    setProjects(list);
  }, []);

  const leavePersonal = useCallback(() => {
    setActiveIdWithEviction(null);
  }, [setActiveIdWithEviction]);

  const openChannelScene = useCallback(() => {
    setScene('channel');
  }, []);

  const channel = useChannelWorkspace({
    refreshProjects,
    onLeavePersonal: leavePersonal,
    onOpenChannelScene: openChannelScene,
  });

  const detect = useCallback(async () => {
    setScene('splash');
    setRuntimes(null);
    const r = await window.morrowApi.detectRuntimes();
    setRuntimes(r);
    if (!r.claude.installed && !r.codex.installed) {
      setScene('install');
      return;
    }
    setCurrent((prev) => {
      if (prev && r[prev].installed) return prev;
      return r.claude.installed ? 'claude' : 'codex';
    });
    setScene('home');
  }, []);

  useEffect(() => {
    void detect();
    void refreshProjects();
  }, [detect, refreshProjects]);

  useEffect(() => {
    setPrefs(loadPrefs());
    prefsHydratedRef.current = true;
  }, []);

  const handleChangePrefs = useCallback((next: AgentPrefs) => {
    setPrefs(next);
    savePrefs(next);
  }, []);

  const createConversation = useCallback(
    (draft = ''): string => {
      const id = `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const now = Date.now();
      const conv: Conversation = {
        id,
        title: deriveConversationTitle(draft),
        runtime: null,
        messages: [],
        draft,
        createdAt: now,
        updatedAt: now,
        projectId: null,
      };
      draftByConversationRef.current[id] = draft;
      setConversations((prev) => [conv, ...prev]);
      setActiveIdWithEviction(id);
      return id;
    },
    [setActiveIdWithEviction],
  );

  const selectConversation = useCallback(
    (id: string) => {
      channel.setActiveChannelId(null);
      setActiveIdWithEviction(id);
      const conv = conversations.find((c) => c.id === id);
      if (conv) {
        setActiveProjectId(conv.projectId);
        if (conv.runtime) setCurrent(conv.runtime);
        setScene(conv.messages.length > 0 ? 'chat' : 'home');
      } else {
        setScene('home');
      }
    },
    [channel, conversations, setActiveIdWithEviction],
  );

  const handleNewConversation = useCallback(() => {
    channel.setActiveChannelId(null);
    channel.setActiveRoleId(null);
    createConversation();
    setScene('home');
  }, [channel, createConversation]);

  const send = useSendMessage({
    current,
    activeId,
    activeProjectId,
    conversations,
    prefs,
    createConversation,
    setActiveIdWithEviction,
    setConversations,
    setChatScene: () => setScene('chat'),
    streamingRef,
  });

  const back = useCallback(() => {
    setScene('home');
  }, []);

  const handleAddProject = useCallback(async () => {
    const p = await window.morrowApi.addProject();
    if (p) {
      await refreshProjects();
      setActiveProjectId(p.id);
    }
  }, [refreshProjects]);

  const handlePickProject = useCallback((id: string | null) => {
    setActiveProjectId(id);
  }, []);

  const handleDraftChange = useCallback(
    (draft: string) => {
      const existingActiveId = activeIdRef.current;
      if (!existingActiveId) {
        if (draft.trim().length === 0) return;
        createConversation(draft);
        return;
      }
      draftByConversationRef.current[existingActiveId] = draft;
      const now = Date.now();
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== existingActiveId) return c;
          const isEmptyConversation = c.messages.length === 0;
          return {
            ...c,
            draft,
            title: isEmptyConversation ? deriveConversationTitle(draft) : c.title,
            updatedAt: isEmptyConversation ? now : c.updatedAt,
          };
        }),
      );
    },
    [createConversation],
  );

  const handleDeleteConversation = useCallback(
    (id: string) => {
      const conv = conversations.find((c) => c.id === id);
      if (conv?.ptySessionId) void window.morrowApi.pty.kill(conv.ptySessionId);
      delete draftByConversationRef.current[id];
      setConversations((prev) => deleteConversation(prev, id));
      removeStreamingForConversation(streamingRef.current, id);
      if (activeIdRef.current === id) {
        activeIdRef.current = null;
        setActiveId(null);
        setScene('home');
      }
    },
    [conversations],
  );

  const activeConv = activeId ? (conversations.find((c) => c.id === activeId) ?? null) : null;
  const activeMessages: Msg[] = activeConv?.messages ?? [];
  const activeRuntime = activeConv?.runtime ?? current;
  const activeDraft = activeConv?.draft ?? '';
  const streamingActive =
    activeConv?.messages.some((m) => m.role === 'ai' && m.status === 'streaming') ?? false;
  const pickerLocked = !!activeConv && activeConv.messages.some((m) => m.role === 'user');
  const showSidebar = scene === 'home' || scene === 'chat' || scene === 'channel';
  const { activeRunStatus, onCancelRun, onRetryRun, onRestartRuntime } = useRuntimeRunStatus({
    activeConversationId: activeConv?.id ?? null,
    conversations,
    restartRuntime: () => void detect(),
    send,
    setConversations,
    streamingRef,
  });

  return (
    <div className="window">
      <div className="top">
        {scene === 'chat' ? (
          <button type="button" className="back-btn" onClick={back} title="返回首页 (Esc)">
            ← 首页
          </button>
        ) : null}
        <div className="top-spacer" />
        {(scene === 'home' || scene === 'chat') && runtimes && current ? (
          <RuntimeBadge runtimes={runtimes} current={current} onPick={setCurrent} />
        ) : null}
      </div>
      <div className="body" data-testid="scaffold-ok">
        {scene === 'splash' ? <Splash runtimes={runtimes} /> : null}
        {scene === 'install' ? <Install onRecheck={() => void detect()} /> : null}
        {showSidebar && runtimes && current ? (
          <div className="layout">
            <Sidebar
              conversations={conversations}
              channels={channel.channelSnapshot.channels}
              roles={channel.channelSnapshot.roles}
              activeConversationId={activeId}
              activeChannelId={channel.activeChannelId}
              activeRoleId={channel.activeRoleId}
              onSelectConversation={selectConversation}
              onCreateConversation={handleNewConversation}
              onSelectChannel={channel.selectChannel}
              onCreateChannel={() => channel.setDialog('channel')}
              onDissolveChannel={channel.requestDissolveChannel}
              onSelectRole={channel.setActiveRoleId}
              onCreateRole={() => channel.setDialog('role')}
              onDeleteConversation={handleDeleteConversation}
            />
            <div className="layout-main">
              {scene === 'home' ? (
                <Home
                  runtimes={runtimes}
                  current={current}
                  streaming={streamingActive}
                  onPick={setCurrent}
                  onSend={send}
                  projects={projects}
                  activeProjectId={activeProjectId}
                  pickerLocked={pickerLocked}
                  onPickProject={handlePickProject}
                  onAddProject={handleAddProject}
                  prefs={prefs}
                  onChangePrefs={handleChangePrefs}
                  draft={activeDraft}
                  onDraftChange={handleDraftChange}
                />
              ) : null}
              {scene === 'chat' && activeRuntime ? (
                <Chat
                  messages={activeMessages}
                  currentRuntime={activeRuntime}
                  streaming={streamingActive}
                  ptySessionId={activeConv?.ptySessionId ?? null}
                  ptyStarting={activeConv?.ptyStarting ?? false}
                  onSend={send}
                  onBack={back}
                  projects={projects}
                  activeProjectId={activeProjectId}
                  pickerLocked={pickerLocked}
                  onPickProject={handlePickProject}
                  onAddProject={handleAddProject}
                  prefs={prefs}
                  onChangePrefs={handleChangePrefs}
                  draft={activeDraft}
                  onDraftChange={handleDraftChange}
                  runStatus={activeRunStatus}
                  onCancelRun={onCancelRun}
                  onRetryRun={onRetryRun}
                  onRestartRuntime={onRestartRuntime}
                />
              ) : null}
              {scene === 'channel' ? (
                <ChannelWorkspace
                  snapshot={channel.channelSnapshot}
                  activeChannelId={channel.activeChannelId}
                  projects={projects}
                  pendingRunText={channel.pendingRunText}
                  onPostMessage={channel.handlePostChannelMessage}
                  onOpenRole={channel.setActiveRoleId}
                  onAddRoleToChannel={channel.handleAddRoleToChannel}
                  onAcceptHandoff={channel.handleAcceptHandoff}
                  onConfirmTeamProposal={channel.handleConfirmTeamProposal}
                  onDismissTeamProposal={channel.handleDismissTeamProposal}
                />
              ) : null}
            </div>
            <RoleDrawer
              role={channel.activeRole}
              channels={channel.channelSnapshot.channels}
              onClose={() => channel.setActiveRoleId(null)}
              onSave={channel.handleUpdateRole}
              onDelete={channel.handleDeleteRole}
            />
          </div>
        ) : null}
      </div>
      <ChannelCreateDialog
        open={channel.dialog === 'channel'}
        projects={projects}
        roles={channel.channelSnapshot.roles}
        onChooseFolder={channel.handleChooseFolderForChannel}
        onCancel={() => channel.setDialog(null)}
        onCreate={channel.handleCreateChannel}
      />
      <RoleCreateDialog
        open={channel.dialog === 'role'}
        channels={channel.channelSnapshot.channels}
        onCancel={() => channel.setDialog(null)}
        onCreate={channel.handleCreateRole}
      />
      <ChannelDissolveDialog
        channel={channel.channelToDissolve}
        onCancel={channel.cancelDissolveChannel}
        onConfirm={channel.handleDissolveChannel}
      />
    </div>
  );
}
