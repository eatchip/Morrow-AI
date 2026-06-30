import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from '../../src/app/renderer/src/components/Sidebar';

describe('formatRelativeTime', () => {
  const now = new Date('2026-05-12T10:00:00').getTime();

  it('< 60s → 刚刚', () => {
    expect(formatRelativeTime(now - 10_000, now)).toBe('刚刚');
  });

  it('< 60min → N 分钟前', () => {
    expect(formatRelativeTime(now - 5 * 60_000, now)).toBe('5 分钟前');
  });

  it('same day → HH:mm', () => {
    const earlier = new Date('2026-05-12T03:07:00').getTime();
    expect(formatRelativeTime(earlier, now)).toBe('03:07');
  });

  it('yesterday → 昨天', () => {
    const y = new Date('2026-05-11T22:00:00').getTime();
    expect(formatRelativeTime(y, now)).toBe('昨天');
  });

  it('earlier → MM-DD', () => {
    const d = new Date('2026-03-02T10:00:00').getTime();
    expect(formatRelativeTime(d, now)).toBe('03-02');
  });
});
