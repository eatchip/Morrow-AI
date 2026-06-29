/** @vitest-environment happy-dom */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chat, type Msg } from '../../src/app/renderer/src/screens/Chat';
import { liveTextStore } from '../../src/app/renderer/src/lib/live-text-store';
import { DEFAULT_AGENT_PREFS } from '../../src/app/renderer/src/lib/agent-prefs';

afterEach(() => {
  cleanup();
  liveTextStore.drop('sess-1');
});

const flushRaf = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));

/**
 * Task 6.4 验证点：
 * 流式期间非流式消息组件不因 chunk 增量而 re-render。
 * 做法：在消息列表里放一条"静态 AI" + 一条"流式 AI"，向 store 高频 append；
 * 然后读取 DOM 文本，验证静态气泡节点身份不变（= 未重挂载/re-render）。
 */
describe('Chat · StreamingMessage 隔离重渲染', () => {
  const common = {
    currentLabel: 'Codex CLI',
    currentRuntime: 'codex' as const,
    streaming: true,
    onSend: vi.fn(),
    onBack: vi.fn(),
    projects: [],
    activeProjectId: null,
    pickerLocked: false,
    onPickProject: vi.fn(),
    onAddProject: vi.fn(),
    prefs: DEFAULT_AGENT_PREFS,
    onChangePrefs: vi.fn(),
    draft: '',
    onDraftChange: vi.fn(),
    runStatus: null,
    onCancelRun: vi.fn(),
    onRetryRun: vi.fn(),
    onRestartRuntime: vi.fn(),
  };

  it('chunk 抵达只更新流式气泡，不改静态气泡文本', async () => {
    const msgs: Msg[] = [
      { id: 'u1', role: 'user', text: 'hi' },
      { id: 'a1', role: 'ai', runtime: 'codex', text: '以前的回答', status: 'done' },
      {
        id: 'a2',
        role: 'ai',
        runtime: 'codex',
        text: '',
        status: 'streaming',
        sessionId: 'sess-1',
      },
    ];
    const { container } = render(<Chat messages={msgs} {...common} />);

    const bubbles = container.querySelectorAll('.ai-body');
    expect(bubbles.length).toBe(2);
    const staticBody = bubbles[0]!;
    const streamingBody = bubbles[1]!;
    expect(staticBody.textContent).toContain('以前的回答');
    expect(streamingBody.textContent?.trim()).toBe('');

    // 高频 append 模拟 token 流
    for (let i = 0; i < 50; i += 1) liveTextStore.append('sess-1', `t${i} `);
    await act(async () => {
      await flushRaf();
    });

    // 静态气泡节点身份 & 文本不变
    const bubblesAfter = container.querySelectorAll('.ai-body');
    expect(bubblesAfter[0]!).toBe(staticBody);
    expect(staticBody.textContent).toContain('以前的回答');
    // 流式气泡已累积全部 token
    expect(bubblesAfter[1]!.textContent).toContain('t0 ');
    expect(bubblesAfter[1]!.textContent).toContain('t49 ');
  });
});
