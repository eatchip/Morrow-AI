import { useCallback, useEffect, useRef } from 'react';
import type { StreamEvent } from '../../../../shared/ipc';

/**
 * 订阅主进程流事件的 hook；组件卸载时自动 unsubscribe。
 * listener 可以随时更新，不会引起重新订阅（用 ref 固化）。
 */
export function useStream(listener: (e: StreamEvent) => void): void {
  const ref = useRef(listener);
  useEffect(() => {
    ref.current = listener;
  }, [listener]);
  useEffect(() => {
    const off = window.morrowApi.onStream((e) => ref.current(e));
    return () => {
      off();
    };
  }, []);
}

/** 生成一个 session id（UUID v4；主进程再次校验形状） */
export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // 退化路径
  return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** 稳定回调包装，避免 hook 依赖在每次渲染时变化 */
export function useEventCallback<T extends (...args: never[]) => unknown>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  return useCallback(((...args: Parameters<T>) => ref.current(...args)) as T, []);
}
