import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import type {
  Channel,
  ChannelEvent,
  HandoffProposal,
  RoleProfile,
  RoleRun,
  TeamProposal,
} from '../domain/channel-types';

export interface ChannelsFile {
  version: 1;
  channels: Channel[];
  roles: RoleProfile[];
  events: ChannelEvent[];
  runs: RoleRun[];
  handoffs: HandoffProposal[];
  teamProposals: TeamProposal[];
}

export interface ChannelsStoreDeps {
  userDataDir: string;
}

export const MORROW_ROLE_ID = 'role-morrow';

export const MORROW_SYSTEM_PROMPT = `你是 Morrow，一个频道助手。用户会描述他需要什么样的 AI 队友。

你的任务：根据用户描述，生成一个角色配置。

输出格式（严格 JSON，不要输出其他内容）：
\`\`\`json
{
  "name": "角色名称（2-8字）",
  "intro": "一句话简介（20字以内）",
  "instruction": "角色的完整指示词，描述角色的专业能力、回答风格和工作范围",
  "defaultRuntime": "codex 或 claude"
}
\`\`\`

规则：
- 只输出一个角色。如果用户描述了多个，选最重要的那个先输出。
- instruction 要具体、可执行，像在写给一个真实同事的工作说明。
- 如果无法理解用户需求，输出纯文本（不包含 JSON）说明你没听懂。`;

export const DEFAULT_ROLES: readonly RoleProfile[] = [
  {
    id: MORROW_ROLE_ID,
    name: 'Morrow',
    intro: '频道助手，帮你快速组建 AI 团队。',
    instruction: MORROW_SYSTEM_PROMPT,
    defaultRuntime: 'codex',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'role-design',
    name: '设计师',
    intro: '负责信息架构、界面布局、视觉稿和交互状态。',
    instruction:
      '你是 Morrow 工作空间里的设计师。优先关注信息架构、布局层级、视觉一致性、交互状态和空态/错误态，给出具体可执行的界面建议。',
    defaultRuntime: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'role-engineer',
    name: '工程师',
    intro: '负责实现路径、代码改动、测试和调试。',
    instruction:
      '你是 Morrow 工作空间里的工程师。把产品方案拆成可实现的代码路径，指出状态所有权、数据结构、边界校验、测试方式和实现风险。',
    defaultRuntime: 'codex',
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'role-product',
    name: '产品经理',
    intro: '负责目标澄清、需求拆解、验收口径和优先级。',
    instruction:
      '你是 Morrow 工作空间里的产品经理。帮助用户澄清目标、拆解 MVP 范围、判断优先级和验收标准，避免把简单产品做成复杂系统。',
    defaultRuntime: 'claude',
    createdAt: 0,
    updatedAt: 0,
  },
];

export function filename(userDataDir: string): string {
  return join(userDataDir, 'channels.json');
}

export function rid(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function seedFile(): ChannelsFile {
  return {
    version: 1,
    channels: [],
    roles: clone([...DEFAULT_ROLES]),
    events: [],
    runs: [],
    handoffs: [],
    teamProposals: [],
  };
}

function isArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function millis(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function runtime(value: unknown): RoleProfile['defaultRuntime'] {
  return value === 'claude' || value === 'codex' ? value : 'codex';
}

function normalizeRoles(values: unknown[]): RoleProfile[] {
  return values.map((value, index) => {
    const role = asRecord(value);
    const id = text(role?.['id'], rid('role'));
    const name = text(role?.['name'], `AI 队友 ${index + 1}`).slice(0, 64);
    const intro = text(role?.['intro'], '这个角色还没有简介。');
    return {
      id,
      name,
      intro,
      instruction: text(
        role?.['instruction'],
        `你是 Morrow 工作空间里的 ${name}。请基于用户当前上下文给出直接、具体的建议。`,
      ),
      defaultRuntime: runtime(role?.['defaultRuntime']),
      createdAt: millis(role?.['createdAt']),
      updatedAt: millis(role?.['updatedAt']),
    };
  });
}

function normalizeChannels(values: unknown[], roleIds: Set<string>): Channel[] {
  return values.map((value, index) => {
    const channel = asRecord(value);
    return {
      id: text(channel?.['id'], rid('channel')),
      name: text(channel?.['name'], `channel-${index + 1}`)
        .replace(/^#+/, '')
        .slice(0, 64),
      description: typeof channel?.['description'] === 'string' ? channel['description'] : '',
      folderProjectId:
        typeof channel?.['folderProjectId'] === 'string' ? channel['folderProjectId'] : null,
      memberRoleIds: compactUnique(
        isArray(channel?.['memberRoleIds'])
          ? channel['memberRoleIds'].filter((item): item is string => typeof item === 'string')
          : [],
      ).filter((id) => roleIds.has(id)),
      createdAt: millis(channel?.['createdAt']),
      updatedAt: millis(channel?.['updatedAt']),
    };
  });
}

function normalizeRuns(
  values: unknown[],
  channelIds: Set<string>,
  roleIds: Set<string>,
): RoleRun[] {
  const runs: RoleRun[] = [];
  for (const value of values) {
    const run = asRecord(value);
    if (!run) continue;
    const channelId = text(run['channelId'], '');
    const roleId = text(run['roleId'], '');
    if (!channelIds.has(channelId) || !roleIds.has(roleId)) continue;
    const status = run['status'];
    runs.push({
      id: text(run['id'], rid('run')),
      channelId,
      roleId,
      trigger: run['trigger'] === 'handoff_accept' ? 'handoff_accept' : 'mention',
      triggerEventId: text(run['triggerEventId'], ''),
      inputText: text(run['inputText'], ''),
      status: status === 'done' || status === 'failed' || status === 'canceled' ? status : 'failed',
      runtime: runtime(run['runtime']),
      createdAt: millis(run['createdAt']),
      updatedAt: millis(run['updatedAt']),
    });
  }
  return runs;
}

function normalizeEvents(values: unknown[], channelIds: Set<string>): ChannelEvent[] {
  const events: ChannelEvent[] = [];
  for (const value of values) {
    const event = asRecord(value);
    if (!event) continue;
    const channelId = text(event['channelId'], '');
    if (!channelIds.has(channelId)) continue;
    const normalized: ChannelEvent = {
      id: text(event['id'], rid('event')),
      channelId,
      type: text(event['type'], 'message_posted') as ChannelEvent['type'],
      authorType: text(event['authorType'], 'system') as ChannelEvent['authorType'],
      createdAt: millis(event['createdAt']),
    };
    if (typeof event['roleId'] === 'string') normalized.roleId = event['roleId'];
    if (typeof event['runId'] === 'string') normalized.runId = event['runId'];
    if (typeof event['handoffId'] === 'string') normalized.handoffId = event['handoffId'];
    if (typeof event['text'] === 'string') normalized.text = event['text'];
    events.push(normalized);
  }
  return events;
}

function normalizeHandoffs(
  values: unknown[],
  channelIds: Set<string>,
  roleIds: Set<string>,
): HandoffProposal[] {
  return values
    .map((value) => {
      const handoff = asRecord(value);
      if (!handoff) return null;
      const channelId = text(handoff['channelId'], '');
      const fromRoleId = text(handoff['fromRoleId'], '');
      const toRoleId = text(handoff['toRoleId'], '');
      if (!channelIds.has(channelId) || !roleIds.has(fromRoleId) || !roleIds.has(toRoleId)) {
        return null;
      }
      const status = handoff['status'];
      return {
        id: text(handoff['id'], rid('handoff')),
        channelId,
        fromRoleId,
        toRoleId,
        sourceRunId: text(handoff['sourceRunId'], ''),
        reason: text(handoff['reason'], ''),
        instruction: text(handoff['instruction'], ''),
        status: status === 'accepted' || status === 'canceled' ? status : 'proposed',
        createdAt: millis(handoff['createdAt']),
        updatedAt: millis(handoff['updatedAt']),
      } satisfies HandoffProposal;
    })
    .filter((handoff): handoff is HandoffProposal => Boolean(handoff));
}

function normalizeTeamProposals(values: unknown[], channelIds: Set<string>): TeamProposal[] {
  const proposals: TeamProposal[] = [];
  for (const value of values) {
    const p = asRecord(value);
    if (!p) continue;
    const channelId = text(p['channelId'], '');
    if (!channelIds.has(channelId)) continue;
    const role = asRecord(p['role']);
    if (!role) continue;
    const status = p['status'];
    proposals.push({
      id: text(p['id'], rid('tp')),
      channelId,
      runId: text(p['runId'], ''),
      role: {
        name: text(role['name'], 'AI 队友'),
        intro: text(role['intro'], ''),
        instruction: text(role['instruction'], ''),
        defaultRuntime: runtime(role['defaultRuntime']),
      },
      status: status === 'confirmed' || status === 'dismissed' ? status : 'proposed',
      createdAt: millis(p['createdAt']),
    });
  }
  return proposals;
}

export function normalizeFile(value: unknown): ChannelsFile {
  if (typeof value !== 'object' || value === null) return seedFile();
  const raw = value as Partial<ChannelsFile>;
  if (raw.version !== 1) return seedFile();
  const base = seedFile();
  const roles = isArray(raw.roles) ? normalizeRoles(raw.roles) : base.roles;
  // Ensure Morrow system role always exists
  if (!roles.some((r) => r.id === MORROW_ROLE_ID)) {
    roles.unshift(clone(DEFAULT_ROLES[0]) as RoleProfile);
  }
  const roleIds = new Set(roles.map((role) => role.id));
  const channels = isArray(raw.channels) ? normalizeChannels(raw.channels, roleIds) : [];
  const channelIds = new Set(channels.map((channel) => channel.id));
  return {
    version: 1,
    channels,
    roles,
    events: isArray(raw.events) ? normalizeEvents(raw.events, channelIds) : [],
    runs: isArray(raw.runs) ? normalizeRuns(raw.runs, channelIds, roleIds) : [],
    handoffs: isArray(raw.handoffs) ? normalizeHandoffs(raw.handoffs, channelIds, roleIds) : [],
    teamProposals: isArray(raw.teamProposals)
      ? normalizeTeamProposals(raw.teamProposals, channelIds)
      : [],
  };
}

export function compactUnique(values: readonly string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
