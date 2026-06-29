/** @vitest-environment happy-dom */
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Composer } from '../../src/app/renderer/src/components/Composer';
import { DEFAULT_AGENT_PREFS } from '../../src/app/renderer/src/lib/agent-prefs';

describe('Composer sendDisabled', () => {
  it('keeps the draft but blocks submit while an answer is streaming', () => {
    const onSubmit = vi.fn();
    const onChange = vi.fn();
    const { getByRole } = render(
      <Composer
        placeholder="继续追问…"
        hint="正在回复"
        runtime="codex"
        prefs={DEFAULT_AGENT_PREFS}
        onChangePrefs={vi.fn()}
        value="下一句"
        onChange={onChange}
        sendDisabled
        onSubmit={onSubmit}
      />,
    );

    const textbox = getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textbox, { target: { value: '下一句补充' } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith('下一句补充');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(textbox.value).toBe('下一句');
    expect(getByRole('button', { name: '发送' })).toBeDisabled();
  });
});
