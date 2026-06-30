import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import type {
  AcceptHandoffArgs,
  AddRoleToChannelArgs,
  Channel,
  ChannelEvent,
  ChannelSnapshot,
  ConfirmTeamProposalArgs,
  CreateChannelArgs,
  CreateRoleArgs,
  DeleteChannelArgs,
  DeleteRoleArgs,
  DismissTeamProposalArgs,
  PostChannelMessageArgs,
  RoleProfile,
  RoleRun,
  TeamProposal,
  UpdateRoleArgs,
} from '../../../shared/channel-ipc';
import {
  assertRoleHasInstruction,
  assertRoleInChannel,
  normalizeChannelName,
  normalizeRoleName,
} from '../domain/channel-invariants';
import { createHandoffProposal, detectHandoffTargets } from '../domain/handoff-detection';
import { findMentionedRoles } from '../domain/role-mentions';
import {
  clone,
  compactUnique,
  filename,
  MORROW_ROLE_ID,
  normalizeFile,
  rid,
  seedFile,
  type ChannelsFile,
  type ChannelsStoreDeps,
} from './channels-file';
import {
  removeRoleReferences,
  applyCreateTeamProposal,
  applyConfirmTeamProposal,
  applyDismissTeamProposal,
} from './channels-store-cleanup';

export class ChannelsStore {
  private file: ChannelsFile = seedFile();
  private loaded = false;

  constructor(private readonly deps: ChannelsStoreDeps) {}

  async load(): Promise<void> {
    const file = filename(this.deps.userDataDir);
    try {
      this.file = normalizeFile(JSON.parse(await readFile(file, 'utf8')) as unknown);
    } catch (error) {
      const e = error as NodeJS.ErrnoException;
      if (e.code !== 'ENOENT') {
        try {
          await rename(file, `${file}.bak-${Date.now()}`);
        } catch {
          /* best effort */
        }
      }
      this.file = seedFile();
    }
    this.loaded = true;
  }

  getSnapshot(): ChannelSnapshot {
    this.assertLoaded();
    return this.snapshot();
  }

  async createChannel(args: CreateChannelArgs): Promise<ChannelSnapshot> {
    this.assertLoaded();
    const now = Date.now();
    const memberRoleIds = compactUnique(args.memberRoleIds ?? []).filter((id) =>
      this.file.roles.some((r) => r.id === id),
    );
    if (!memberRoleIds.includes(MORROW_ROLE_ID)) memberRoleIds.unshift(MORROW_ROLE_ID);
    const channel: Channel = {
      id: rid('channel'),
      name: normalizeChannelName(args.name),
      description: args.description?.trim() ?? '',
      folderProjectId: args.folderProjectId ?? null,
      memberRoleIds,
      createdAt: now,
      updatedAt: now,
    };
    this.file.channels.push(channel);
    if (channel.folderProjectId) {
      this.file.events.push(
        this.event(channel.id, 'folder_bound', 'system', now, {
          text: `#${channel.name} 已绑定文件夹`,
        }),
      );
    }
    await this.persist();
    return this.snapshot();
  }

  async createRole(args: CreateRoleArgs): Promise<ChannelSnapshot> {
    this.assertLoaded();
    assertRoleHasInstruction(args);
    const now = Date.now();
    const role: RoleProfile = {
      id: rid('role'),
      name: normalizeRoleName(args.name),
      intro: args.intro.trim(),
      instruction: args.instruction.trim(),
      defaultRuntime: args.defaultRuntime,
      createdAt: now,
      updatedAt: now,
    };
    if (!role.intro) throw new Error('role intro is required');
    this.file.roles.push(role);
    for (const channelId of compactUnique(args.channelIds ?? [])) {
      this.addRoleToChannelInMemory(channelId, role.id, now);
    }
    await this.persist();
    return this.snapshot();
  }

  async updateRole(args: UpdateRoleArgs): Promise<ChannelSnapshot> {
    this.assertLoaded();
    const role = this.requireRole(args.roleId);
    if (args.name !== undefined) role.name = normalizeRoleName(args.name);
    if (args.intro !== undefined) {
      role.intro = args.intro.trim();
      if (!role.intro) throw new Error('role intro is required');
    }
    if (args.instruction !== undefined) {
      role.instruction = args.instruction.trim();
      assertRoleHasInstruction(role);
    }
    if (args.defaultRuntime !== undefined) role.defaultRuntime = args.defaultRuntime;
    role.updatedAt = Date.now();
    await this.persist();
    return this.snapshot();
  }

  async deleteRole(args: DeleteRoleArgs): Promise<ChannelSnapshot> {
    this.assertLoaded();
    if (args.roleId === MORROW_ROLE_ID) throw new Error('cannot delete system role: Morrow');
    this.requireRole(args.roleId);
    removeRoleReferences(this.file, args.roleId, Date.now());
    await this.persist();
    return this.snapshot();
  }

  async deleteChannel(args: DeleteChannelArgs) {
    this.assertLoaded();
    const channel = this.requireChannel(args.channelId);
    const runIdsToAbort = this.file.runs
      .filter((run) => run.channelId === channel.id && run.status === 'running')
      .map((run) => run.id);
    this.file.channels = this.file.channels.filter((item) => item.id !== channel.id);
    this.file.events = this.file.events.filter((event) => event.channelId !== channel.id);
    this.file.runs = this.file.runs.filter((run) => run.channelId !== channel.id);
    this.file.handoffs = this.file.handoffs.filter((handoff) => handoff.channelId !== channel.id);
    await this.persist();
    return { snapshot: this.snapshot(), runIdsToAbort };
  }

  async addRoleToChannel(args: AddRoleToChannelArgs): Promise<ChannelSnapshot> {
    this.assertLoaded();
    this.requireRole(args.roleId);
    this.addRoleToChannelInMemory(args.channelId, args.roleId, Date.now());
    await this.persist();
    return this.snapshot();
  }

  async postUserMessage(args: PostChannelMessageArgs) {
    this.assertLoaded();
    const channel = this.requireChannel(args.channelId);
    const now = Date.now();
    const text = args.text.trim();
    if (!text) throw new Error('message text is required');
    const message = this.event(channel.id, 'message_posted', 'user', now, { text });
    this.file.events.push(message);
    const roles = this.rolesForChannel(channel);
    const runsToStart = findMentionedRoles(text, roles).map((role) =>
      this.createRun(channel, role, 'mention', message.id, text, now),
    );
    for (const run of runsToStart) {
      this.file.runs.push(run);
      this.file.events.push(
        this.event(channel.id, 'role_run_started', 'system', now, {
          roleId: run.roleId,
          runId: run.id,
          text: `${this.roleName(run.roleId)} 已被激活`,
        }),
      );
    }
    await this.persist();
    return { snapshot: this.snapshot(), runsToStart: clone(runsToStart) };
  }

  async completeRoleRun(runId: string, text: string): Promise<ChannelSnapshot> {
    this.assertLoaded();
    const run = this.file.runs.find((item) => item.id === runId);
    if (!run || run.status !== 'running') return this.snapshot();
    const channel = this.requireChannel(run.channelId);
    const role = this.requireRole(run.roleId);
    const now = Date.now();
    run.status = 'done';
    run.updatedAt = now;
    this.file.events.push(
      this.event(channel.id, 'role_message_posted', 'role', now, {
        roleId: role.id,
        runId: run.id,
        text: text.trim() || '(no output)',
      }),
    );
    this.file.handoffs.push(...this.createHandoffs(channel, role, run, text, now));
    await this.persist();
    return this.snapshot();
  }

  // prettier-ignore
  private createHandoffs(channel: Channel, role: RoleProfile, run: RoleRun, text: string, now: number) {
    return detectHandoffTargets({ text, roles: this.rolesForChannel(channel), fromRoleId: role.id }).map((target) => {
      const handoff = createHandoffProposal({ channelId: channel.id, fromRoleId: role.id, toRoleId: target.id, sourceRunId: run.id, reason: `${role.name} 建议让 ${target.name} 继续看`, instruction: `请基于 ${role.name} 的上一条回复继续推进：${text.trim()}`, now, id: rid });
      this.file.events.push(this.event(channel.id, 'handoff_proposed', 'system', now, { roleId: role.id, handoffId: handoff.id, text: handoff.reason }));
      return handoff;
    });
  }

  async failRoleRun(runId: string, message: string): Promise<ChannelSnapshot> {
    this.assertLoaded();
    const run = this.file.runs.find((item) => item.id === runId);
    if (!run || run.status !== 'running') return this.snapshot();
    const now = Date.now();
    run.status = 'failed';
    run.updatedAt = now;
    this.file.events.push(
      this.event(run.channelId, 'role_run_failed', 'system', now, {
        roleId: run.roleId,
        runId: run.id,
        text: message,
      }),
    );
    await this.persist();
    return this.snapshot();
  }

  async acceptHandoff(args: AcceptHandoffArgs) {
    this.assertLoaded();
    const handoff = this.file.handoffs.find(
      (h) => h.id === args.handoffId && h.channelId === args.channelId && h.status === 'proposed',
    );
    if (!handoff) throw new Error(`unknown handoff: ${args.handoffId}`);
    const role = this.requireRole(handoff.toRoleId);
    const channel = this.requireChannel(args.channelId);
    assertRoleInChannel(channel, role.id);
    const now = Date.now();
    handoff.status = 'accepted';
    handoff.updatedAt = now;
    const accepted = this.event(channel.id, 'handoff_accepted', 'system', now, {
      roleId: role.id,
      handoffId: handoff.id,
      text: `${role.name} 接手交接`,
    });
    this.file.events.push(accepted);
    const run = this.createRun(
      channel,
      role,
      'handoff_accept',
      accepted.id,
      handoff.instruction,
      now,
    );
    this.file.runs.push(run);
    this.file.events.push(
      this.event(channel.id, 'role_run_started', 'system', now, {
        roleId: role.id,
        runId: run.id,
        text: `${role.name} 已被激活`,
      }),
    );
    await this.persist();
    return { snapshot: this.snapshot(), runsToStart: [clone(run)] };
  }

  async createTeamProposal(
    channelId: string,
    runId: string,
    role: TeamProposal['role'],
  ): Promise<ChannelSnapshot> {
    this.assertLoaded();
    this.requireChannel(channelId);
    applyCreateTeamProposal(this.file, channelId, runId, role, this.event.bind(this));
    await this.persist();
    return this.snapshot();
  }

  async confirmTeamProposal(args: ConfirmTeamProposalArgs): Promise<ChannelSnapshot> {
    this.assertLoaded();
    const { createRoleArgs } = applyConfirmTeamProposal(this.file, args, this.event.bind(this));
    await this.createRole(createRoleArgs);
    await this.persist();
    return this.snapshot();
  }

  async dismissTeamProposal(args: DismissTeamProposalArgs): Promise<ChannelSnapshot> {
    this.assertLoaded();
    applyDismissTeamProposal(this.file, args);
    await this.persist();
    return this.snapshot();
  }

  private createRun(
    channel: Channel,
    role: RoleProfile,
    trigger: RoleRun['trigger'],
    triggerEventId: string,
    inputText: string,
    now: number,
  ): RoleRun {
    return {
      id: rid('run'),
      channelId: channel.id,
      roleId: role.id,
      trigger,
      triggerEventId,
      inputText,
      status: 'running',
      runtime: role.defaultRuntime,
      createdAt: now,
      updatedAt: now,
    };
  }

  // prettier-ignore
  private addRoleToChannelInMemory(channelId: string, roleId: string, now: number): void {
    const channel = this.requireChannel(channelId);
    if (channel.memberRoleIds.includes(roleId)) return;
    channel.memberRoleIds.push(roleId);
    channel.updatedAt = now;
    this.file.events.push(this.event(channel.id, 'role_joined', 'system', now, { roleId, text: `${this.roleName(roleId)} 已加入频道` }));
  }

  private snapshot(): ChannelSnapshot {
    return clone({
      channels: this.file.channels,
      roles: this.file.roles,
      events: this.file.events,
      runs: this.file.runs,
      handoffs: this.file.handoffs,
      teamProposals: this.file.teamProposals,
    });
  }

  private rolesForChannel(channel: Channel): RoleProfile[] {
    return channel.memberRoleIds
      .map((id) => this.file.roles.find((r) => r.id === id))
      .filter((r): r is RoleProfile => Boolean(r));
  }

  private event(
    channelId: string,
    type: ChannelEvent['type'],
    authorType: ChannelEvent['authorType'],
    createdAt: number,
    extra: Omit<Partial<ChannelEvent>, 'id' | 'channelId' | 'type' | 'authorType' | 'createdAt'>,
  ): ChannelEvent {
    return { id: rid('event'), channelId, type, authorType, createdAt, ...extra };
  }

  private roleName(roleId: string): string {
    return this.file.roles.find((role) => role.id === roleId)?.name ?? roleId;
  }

  private requireChannel(id: string): Channel {
    const channel = this.file.channels.find((item) => item.id === id);
    if (!channel) throw new Error(`unknown channel: ${id}`);
    return channel;
  }

  private requireRole(id: string): RoleProfile {
    const role = this.file.roles.find((item) => item.id === id);
    if (!role) throw new Error(`unknown role: ${id}`);
    return role;
  }

  private assertLoaded(): void {
    if (!this.loaded) throw new Error('ChannelsStore.load() must be called first');
  }

  private async persist(): Promise<void> {
    const file = filename(this.deps.userDataDir);
    const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
    await mkdir(this.deps.userDataDir, { recursive: true });
    await writeFile(tmp, JSON.stringify(this.file, null, 2), 'utf8');
    await rename(tmp, file);
  }
}
