/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RoleProfile } from '../../src/shared/ipc';
import { ChannelComposer } from '../../src/app/renderer/src/components/ChannelComposer';

afterEach(() => cleanup());

const roles: RoleProfile[] = [
  {
    id: 'r1',
    name: '设计师',
    intro: '负责界面',
    instruction: '给出界面建议。',
    defaultRuntime: 'claude',
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'r2',
    name: '工程师',
    intro: '负责实现',
    instruction: '给出实现建议。',
    defaultRuntime: 'codex',
    createdAt: 2,
    updatedAt: 2,
  },
];

describe('ChannelComposer', () => {
  it('opens the mention menu only after @ and inserts the selected role', () => {
    render(<ChannelComposer roles={roles} onSubmit={() => {}} />);
    const textbox = screen.getByRole('textbox') as HTMLTextAreaElement;

    expect(screen.queryByRole('listbox', { name: '选择频道角色' })).toBeNull();

    fireEvent.change(textbox, { target: { value: '@', selectionStart: 1 } });
    expect(screen.getByRole('listbox', { name: '选择频道角色' })).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByText('设计师'));

    expect(textbox.value).toBe('@设计师 ');
  });

  it('submits with Enter when the draft has content', () => {
    const onSubmit = vi.fn();
    render(<ChannelComposer roles={roles} onSubmit={onSubmit} />);
    const textbox = screen.getByRole('textbox') as HTMLTextAreaElement;

    fireEvent.change(textbox, { target: { value: '@设计师 看下信息架构', selectionStart: 12 } });
    fireEvent.keyDown(textbox, { key: 'Enter' });

    expect(onSubmit).toHaveBeenCalledWith('@设计师 看下信息架构');
    expect(textbox.value).toBe('');
  });
});
