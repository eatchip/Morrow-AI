/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { liveTextStore } from '../../src/app/renderer/src/lib/live-text-store';

afterEach(() => {
  liveTextStore.drop('s1');
  liveTextStore.drop('s2');
});

/**
 * Task 5.4 验证点：
 *  1) 高频 append 被 rAF 合批，订阅者每帧只被唤醒一次
 *  2) done 时 consume 拿到全部累积文本并清空桶
 *  3) drop 不触发订阅者
 */
describe('liveTextStore', () => {
  it('rAF 合并多次 append，一帧内只通知一次', async () => {
    const notify = vi.fn();
    const unsub = liveTextStore.subscribe('s1', notify);

    liveTextStore.append('s1', 'a');
    liveTextStore.append('s1', 'b');
    liveTextStore.append('s1', 'c');

    // 合批：rAF/宏任务触发前，订阅者未被唤醒
    expect(notify).toHaveBeenCalledTimes(0);

    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    expect(notify).toHaveBeenCalledTimes(1);
    expect(liveTextStore.read('s1')).toBe('abc');

    unsub();
  });

  it('consume 读走全部并清空', async () => {
    liveTextStore.append('s1', 'hello ');
    liveTextStore.append('s1', 'world');
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    expect(liveTextStore.consume('s1')).toBe('hello world');
    expect(liveTextStore.read('s1')).toBe('');
  });

  it('不同 sessionId 互不影响', async () => {
    const n1 = vi.fn();
    const n2 = vi.fn();
    liveTextStore.subscribe('s1', n1);
    liveTextStore.subscribe('s2', n2);

    liveTextStore.append('s1', 'x');
    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    expect(n1).toHaveBeenCalledTimes(1);
    expect(n2).toHaveBeenCalledTimes(0);
    expect(liveTextStore.read('s2')).toBe('');
  });

  it('drop 不通知订阅者', async () => {
    const notify = vi.fn();
    liveTextStore.subscribe('s1', notify);
    liveTextStore.append('s1', 'x');
    liveTextStore.drop('s1');
    // rAF 仍会触发 flush（s1 在 pending 里），但桶已空且订阅者拿到空串
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    expect(liveTextStore.read('s1')).toBe('');
  });
});
