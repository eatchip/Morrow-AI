import type { RoleProfile } from './channel-types';

const TOKEN = /@([A-Za-z0-9_\-\u4e00-\u9fa5]{1,32})/g;

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

export function findMentionedRoles(text: string, roles: readonly RoleProfile[]): RoleProfile[] {
  const tokens = new Set<string>();
  for (const match of text.matchAll(TOKEN)) {
    const raw = match[1];
    if (raw) tokens.add(normalize(raw));
  }
  if (tokens.size === 0) return [];
  return roles.filter((role) => tokens.has(normalize(role.name)));
}
