import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ChannelSnapshot,
  ConfirmTeamProposalArgs,
  CreateChannelArgs,
  CreateRoleArgs,
  DismissTeamProposalArgs,
  Project,
  UpdateRoleArgs,
} from '../../../../shared/ipc';

const EMPTY_CHANNEL_SNAPSHOT: ChannelSnapshot = {
  channels: [],
  roles: [],
  events: [],
  runs: [],
  handoffs: [],
  teamProposals: [],
};

interface Deps {
  refreshProjects: () => Promise<void>;
  onLeavePersonal: () => void;
  onOpenChannelScene: () => void;
}

export function useChannelWorkspace({
  refreshProjects,
  onLeavePersonal,
  onOpenChannelScene,
}: Deps) {
  const [channelSnapshot, setChannelSnapshot] = useState<ChannelSnapshot>(EMPTY_CHANNEL_SNAPSHOT);
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [activeRoleId, setActiveRoleId] = useState<string | null>(null);
  const [channelToDissolveId, setChannelToDissolveId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<'channel' | 'role' | null>(null);
  const [pendingRunText, setPendingRunText] = useState<Record<string, string>>({});

  const applyChannelSnapshot = useCallback((snapshot: ChannelSnapshot) => {
    setChannelSnapshot(snapshot);
    const channelIds = new Set(snapshot.channels.map((channel) => channel.id));
    setActiveChannelId((current) => (current && !channelIds.has(current) ? null : current));
    setChannelToDissolveId((current) => (current && !channelIds.has(current) ? null : current));
    const runningIds = new Set(
      snapshot.runs.filter((run) => run.status === 'running').map((run) => run.id),
    );
    setPendingRunText((prev) => {
      const next: Record<string, string> = {};
      for (const [runId, text] of Object.entries(prev)) {
        if (runningIds.has(runId)) next[runId] = text;
      }
      return next;
    });
  }, []);

  useEffect(() => {
    let alive = true;
    void window.morrowApi.channels.getSnapshot().then((snapshot) => {
      if (alive) applyChannelSnapshot(snapshot);
    });
    const off = window.morrowApi.channels.onEvent((event) => {
      if (event.kind === 'snapshot') {
        applyChannelSnapshot(event.snapshot);
        return;
      }
      setPendingRunText((prev) => ({
        ...prev,
        [event.runId]: (prev[event.runId] ?? '') + event.text,
      }));
    });
    return () => {
      alive = false;
      off();
    };
  }, [applyChannelSnapshot]);

  const selectChannel = useCallback(
    (id: string) => {
      onLeavePersonal();
      setActiveChannelId(id);
      onOpenChannelScene();
    },
    [onLeavePersonal, onOpenChannelScene],
  );

  const handleChooseFolderForChannel = useCallback(async (): Promise<Project | null> => {
    const project = await window.morrowApi.addProject();
    if (!project) return null;
    await refreshProjects();
    return project;
  }, [refreshProjects]);

  const handleCreateChannel = useCallback(
    async (args: CreateChannelArgs) => {
      const knownIds = new Set(channelSnapshot.channels.map((channel) => channel.id));
      const next = await window.morrowApi.channels.createChannel(args);
      applyChannelSnapshot(next);
      const created =
        next.channels.find((channel) => !knownIds.has(channel.id)) ?? next.channels.at(-1);
      if (created) selectChannel(created.id);
      setDialog(null);
    },
    [applyChannelSnapshot, channelSnapshot.channels, selectChannel],
  );

  const handleCreateRole = useCallback(
    async (args: CreateRoleArgs) => {
      const knownIds = new Set(channelSnapshot.roles.map((role) => role.id));
      const next = await window.morrowApi.channels.createRole(args);
      applyChannelSnapshot(next);
      const created = next.roles.find((role) => !knownIds.has(role.id)) ?? next.roles.at(-1);
      if (created) setActiveRoleId(created.id);
      setDialog(null);
    },
    [applyChannelSnapshot, channelSnapshot.roles],
  );

  const handleUpdateRole = useCallback(
    async (args: UpdateRoleArgs) => {
      const next = await window.morrowApi.channels.updateRole(args);
      applyChannelSnapshot(next);
    },
    [applyChannelSnapshot],
  );

  const handleDeleteRole = useCallback(
    async (roleId: string) => {
      const next = await window.morrowApi.channels.deleteRole({ roleId });
      applyChannelSnapshot(next);
      setActiveRoleId((current) => (current === roleId ? null : current));
    },
    [applyChannelSnapshot],
  );

  const requestDissolveChannel = useCallback((channelId: string) => {
    setChannelToDissolveId(channelId);
  }, []);

  const cancelDissolveChannel = useCallback(() => {
    setChannelToDissolveId(null);
  }, []);

  const handleDissolveChannel = useCallback(
    async (channelId: string) => {
      const next = await window.morrowApi.channels.deleteChannel({ channelId });
      applyChannelSnapshot(next);
      setActiveChannelId((current) => (current === channelId ? null : current));
      setChannelToDissolveId(null);
    },
    [applyChannelSnapshot],
  );

  const handleAddRoleToChannel = useCallback(
    async (channelId: string, roleId: string) => {
      const next = await window.morrowApi.channels.addRoleToChannel({ channelId, roleId });
      applyChannelSnapshot(next);
    },
    [applyChannelSnapshot],
  );

  const handlePostChannelMessage = useCallback(
    async (channelId: string, text: string) => {
      // oxlint-disable-next-line require-post-message-target-origin
      const next = await window.morrowApi.channels.postMessage({ channelId, text });
      applyChannelSnapshot(next);
    },
    [applyChannelSnapshot],
  );

  const handleAcceptHandoff = useCallback(
    async (channelId: string, handoffId: string) => {
      const next = await window.morrowApi.channels.acceptHandoff({ channelId, handoffId });
      applyChannelSnapshot(next);
    },
    [applyChannelSnapshot],
  );

  const handleConfirmTeamProposal = useCallback(
    async (channelId: string, proposalId: string) => {
      const args: ConfirmTeamProposalArgs = { channelId, proposalId };
      const next = await window.morrowApi.channels.confirmTeamProposal(args);
      applyChannelSnapshot(next);
    },
    [applyChannelSnapshot],
  );

  const handleDismissTeamProposal = useCallback(
    async (channelId: string, proposalId: string) => {
      const args: DismissTeamProposalArgs = { channelId, proposalId };
      const next = await window.morrowApi.channels.dismissTeamProposal(args);
      applyChannelSnapshot(next);
    },
    [applyChannelSnapshot],
  );

  const activeRole = useMemo(
    () =>
      activeRoleId
        ? (channelSnapshot.roles.find((role) => role.id === activeRoleId) ?? null)
        : null,
    [activeRoleId, channelSnapshot.roles],
  );
  const channelToDissolve = useMemo(
    () =>
      channelToDissolveId
        ? (channelSnapshot.channels.find((channel) => channel.id === channelToDissolveId) ?? null)
        : null,
    [channelSnapshot.channels, channelToDissolveId],
  );

  return {
    activeChannelId,
    activeRole,
    activeRoleId,
    channelSnapshot,
    channelToDissolve,
    dialog,
    pendingRunText,
    setActiveChannelId,
    setActiveRoleId,
    setDialog,
    selectChannel,
    handleChooseFolderForChannel,
    handleCreateChannel,
    handleCreateRole,
    handleUpdateRole,
    handleDeleteRole,
    requestDissolveChannel,
    cancelDissolveChannel,
    handleDissolveChannel,
    handleAddRoleToChannel,
    handlePostChannelMessage,
    handleAcceptHandoff,
    handleConfirmTeamProposal,
    handleDismissTeamProposal,
  };
}
