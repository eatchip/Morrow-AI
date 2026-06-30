/**
 * 流式文本的临时缓冲区，按 sessionId 分桶。
 *
 * 目的：把高频到达的 chunk 与 React 的 setState 解耦，避免在 conversations 树上
 * 每个 chunk 触发一次深拷贝 + 整列重渲染（O(N²)）。
 *
 * 生命周期：
 *  - chunk  → append(sessionId, text)  写入 + rAF 通知订阅者
 *  - done   → consume(sessionId)       读取 + 清空，由上层写回到 message.text
 *  - error  → consume(sessionId)       同上
 *  - cancel → drop(sessionId)          丢弃（不通知）
 *
 * 所有权：renderer 进程内存，随页面刷新丢失；主进程事件是唯一写入源。
 * 订阅者配合 `useSyncExternalStore`，只有挂载的流式气泡会重渲染；其余消息气泡 memo 后无需刷新。
 */
import { useSyncExternalStore } from 'react';

const buffers = new Map<string, string>();
const subscribers = new Map<string, Set<() => void>>();
let pendingIds: Set<string> | null = null;

function schedule(id: string): void {
  if (pendingIds) {
    pendingIds.add(id);
    return;
  }
  pendingIds = new Set([id]);
  const flush = (): void => {
    const ids = pendingIds;
    pendingIds = null;
    if (!ids) return;
    for (const sid of ids) {
      const subs = subscribers.get(sid);
      if (!subs) continue;
      for (const fn of subs) fn();
    }
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(flush);
  } else {
    // 测试环境或非浏览器：退化为下一个宏任务
    setTimeout(flush, 0);
  }
}

export const liveTextStore = {
  append(sessionId: string, text: string): void {
    if (!text) return;
    const cur = buffers.get(sessionId) ?? '';
    buffers.set(sessionId, cur + text);
    schedule(sessionId);
  },
  read(sessionId: string): string {
    return buffers.get(sessionId) ?? '';
  },
  consume(sessionId: string): string {
    const v = buffers.get(sessionId) ?? '';
    buffers.delete(sessionId);
    return v;
  },
  drop(sessionId: string): void {
    buffers.delete(sessionId);
  },
  subscribe(sessionId: string, fn: () => void): () => void {
    let set = subscribers.get(sessionId);
    if (!set) {
      set = new Set();
      subscribers.set(sessionId, set);
    }
    set.add(fn);
    return () => {
      const s = subscribers.get(sessionId);
      if (!s) return;
      s.delete(fn);
      if (s.size === 0) subscribers.delete(sessionId);
    };
  },
};

/** React hook：订阅单个 sessionId 的缓冲文本。 */
export function useLiveText(sessionId: string | null | undefined): string {
  return useSyncExternalStore(
    (fn) => {
      if (!sessionId) return () => {};
      return liveTextStore.subscribe(sessionId, fn);
    },
    () => (sessionId ? liveTextStore.read(sessionId) : ''),
    () => '',
  );
}
