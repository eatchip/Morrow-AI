import type { HandoffProposal, RoleProfile } from './channel-types';
import { findMentionedRoles } from './role-mentions';

export function detectHandoffTargets(args: {
  text: string;
  roles: readonly RoleProfile[];
  fromRoleId: string;
}): RoleProfile[] {
  return findMentionedRoles(args.text, args.roles).filter((role) => role.id !== args.fromRoleId);
}

export function createHandoffProposal(args: {
  channelId: string;
  fromRoleId: string;
  toRoleId: string;
  sourceRunId: string;
  reason: string;
  instruction: string;
  now: number;
  id: (prefix: string) => string;
}): HandoffProposal {
  return {
    id: args.id('handoff'),
    channelId: args.channelId,
    fromRoleId: args.fromRoleId,
    toRoleId: args.toRoleId,
    sourceRunId: args.sourceRunId,
    reason: args.reason.trim(),
    instruction: args.instruction.trim(),
    status: 'proposed',
    createdAt: args.now,
    updatedAt: args.now,
  };
}
