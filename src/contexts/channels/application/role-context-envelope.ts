import type { ChannelEvent, ChannelSnapshot, RoleRun } from '../../../shared/channel-ipc';

function roleName(snapshot: ChannelSnapshot, roleId?: string): string {
  if (!roleId) return 'System';
  return snapshot.roles.find((role) => role.id === roleId)?.name ?? roleId;
}

function eventLine(snapshot: ChannelSnapshot, event: ChannelEvent): string {
  const text = event.text ?? event.type;
  if (event.authorType === 'role') return `${roleName(snapshot, event.roleId)}: ${text}`;
  if (event.authorType === 'user') return `用户: ${text}`;
  return `系统: ${text}`;
}

export function buildRoleContextEnvelope(args: {
  snapshot: ChannelSnapshot;
  run: RoleRun;
  cwd: string;
}): string {
  const channel = args.snapshot.channels.find((item) => item.id === args.run.channelId);
  const role = args.snapshot.roles.find((item) => item.id === args.run.roleId);
  if (!channel) throw new Error(`unknown channel: ${args.run.channelId}`);
  if (!role) throw new Error(`unknown role: ${args.run.roleId}`);
  const members = channel.memberRoleIds
    .map((id) => args.snapshot.roles.find((item) => item.id === id))
    .filter(Boolean)
    .map((item) => `${item!.name}：${item!.intro}`)
    .join('\n');
  const recent = args.snapshot.events
    .filter((event) => event.channelId === channel.id)
    .slice(-12)
    .map((event) => eventLine(args.snapshot, event))
    .join('\n');
  return [
    '你是 Morrow 本地工作空间中的 AI 队友。',
    '',
    '角色：',
    `- 名称：${role.name}`,
    `- 简介：${role.intro}`,
    '- 指示：',
    role.instruction,
    '',
    '频道：',
    `- 名称：#${channel.name}`,
    `- 绑定文件夹：${args.cwd}`,
    '- 成员：',
    members || '暂无其他成员',
    '',
    '最近上下文：',
    recent || '暂无历史消息。',
    '',
    '本次输入：',
    args.run.inputText,
    '',
    '回复要求：',
    '- 用中文，像一位同事在群里发言，直接、具体。',
    '- 只代表自己的角色视角，不替其他角色发言。',
    '- 如果需要另一个角色继续，请明确 @目标角色，并说明原因和交接输入。',
    '- 不要声称已经读取或修改文件，除非 runtime 实际完成了相关动作。',
  ].join('\n');
}
