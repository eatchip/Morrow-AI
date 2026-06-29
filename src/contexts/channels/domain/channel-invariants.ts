import type { Channel, RoleProfile } from './channel-types';

export function assertRoleHasInstruction(role: Pick<RoleProfile, 'instruction'>): void {
  if (role.instruction.trim().length === 0) {
    throw new Error('role instruction is required');
  }
}

export function assertRoleInChannel(channel: Channel, roleId: string): void {
  if (!channel.memberRoleIds.includes(roleId)) {
    throw new Error('role is not in channel');
  }
}

export function normalizeChannelName(raw: string): string {
  const name = raw.trim().replace(/^#+/, '');
  if (name.length === 0) throw new Error('channel name is required');
  return name.slice(0, 64);
}

export function normalizeRoleName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0) throw new Error('role name is required');
  return name.slice(0, 64);
}
