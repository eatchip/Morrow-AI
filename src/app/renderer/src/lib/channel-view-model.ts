import type {
  Channel,
  ChannelEvent,
  ChannelSnapshot,
  HandoffProposal,
  RoleProfile,
  RoleRun,
} from '../../../../shared/channel-ipc';

export interface ChannelTimelineViewItem {
  event: ChannelEvent;
  role: RoleProfile | null;
  run: RoleRun | null;
  handoff: HandoffProposal | null;
}

export interface ChannelViewModel {
  channel: Channel;
  channelRoles: RoleProfile[];
  events: ChannelTimelineViewItem[];
  availableRoles: RoleProfile[];
  rolesById: ReadonlyMap<string, RoleProfile>;
}

export function buildChannelViewModel(
  snapshot: ChannelSnapshot,
  activeChannelId: string | null,
): ChannelViewModel | null {
  if (!activeChannelId) return null;
  const channel = snapshot.channels.find((item) => item.id === activeChannelId) ?? null;
  if (!channel) return null;

  const rolesById = new Map(snapshot.roles.map((role) => [role.id, role]));
  const memberIds = new Set(channel.memberRoleIds);
  const activeEvents: ChannelEvent[] = [];
  const neededRunIds = new Set<string>();
  const neededHandoffIds = new Set<string>();

  for (const event of snapshot.events) {
    if (event.channelId !== channel.id) continue;
    activeEvents.push(event);
    if (event.runId) neededRunIds.add(event.runId);
    if (event.handoffId) neededHandoffIds.add(event.handoffId);
  }

  activeEvents.sort((a, b) => a.createdAt - b.createdAt);

  const runsById =
    neededRunIds.size === 0
      ? new Map<string, RoleRun>()
      : new Map(
          snapshot.runs
            .filter((run) => neededRunIds.has(run.id))
            .map((run) => [run.id, run] as const),
        );
  const handoffsById =
    neededHandoffIds.size === 0
      ? new Map<string, HandoffProposal>()
      : new Map(
          snapshot.handoffs
            .filter((handoff) => neededHandoffIds.has(handoff.id))
            .map((handoff) => [handoff.id, handoff] as const),
        );

  return {
    channel,
    channelRoles: channel.memberRoleIds
      .map((roleId) => rolesById.get(roleId))
      .filter((role): role is RoleProfile => Boolean(role)),
    events: activeEvents.map((event) => ({
      event,
      role: event.roleId ? (rolesById.get(event.roleId) ?? null) : null,
      run: event.runId ? (runsById.get(event.runId) ?? null) : null,
      handoff: event.handoffId ? (handoffsById.get(event.handoffId) ?? null) : null,
    })),
    availableRoles: snapshot.roles.filter((role) => !memberIds.has(role.id)),
    rolesById,
  };
}
