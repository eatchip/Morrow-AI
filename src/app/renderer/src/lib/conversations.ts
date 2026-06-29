import type { Conversation } from '../components/Sidebar';

const TITLE_MAX = 24;

export function deriveConversationTitle(text: string): string {
  const s = text.trim().replace(/\s+/g, ' ');
  return s.length > TITLE_MAX ? s.slice(0, TITLE_MAX) + '…' : s || '新对话';
}

/**
 * 当 activeId 从 prevId 转换到 nextId 时，若旧的活动会话是"空对话"
 * （messages 长度为 0 且没有草稿），则将其从 conversations 中剔除。
 *
 * 不变量：
 *  - prevId === nextId → no-op
 *  - prevId == null → no-op
 *  - prevId 不在 conversations 中 → no-op
 *  - 仅当旧会话 messages.length === 0 且 draft 为空白时回收
 */
export function evictEmptyOnLeave(
  convs: Conversation[],
  prevId: string | null,
  nextId: string | null,
): Conversation[] {
  if (!prevId || prevId === nextId) return convs;
  const prev = convs.find((c) => c.id === prevId);
  if (!prev) return convs;
  if (prev.messages.length !== 0) return convs;
  if ((prev.draft ?? '').trim().length !== 0) return convs;
  return convs.filter((c) => c.id !== prevId);
}

/** 从 conversations 中删除指定 id，不存在则返回原数组（引用稳定）。 */
export function deleteConversation(convs: Conversation[], id: string): Conversation[] {
  if (!convs.some((c) => c.id === id)) return convs;
  return convs.filter((c) => c.id !== id);
}
