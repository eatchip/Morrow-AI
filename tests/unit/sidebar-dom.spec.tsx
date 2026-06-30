/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ComponentProps } from 'react';
import type { Channel, RoleProfile } from '../../src/shared/ipc';
import { Sidebar, type Conversation } from '../../src/app/renderer/src/components/Sidebar';

afterEach(() => cleanup());

const convScoped: Conversation = {
  id: 'c1',
  title: 'project-bound-conv',
  runtime: 'codex',
  messages: [],
  draft: '',
  createdAt: 1,
  updatedAt: 1,
  projectId: 'p1',
};
const convFree: Conversation = {
  id: 'c2',
  title: 'free-conv',
  runtime: 'codex',
  messages: [],
  draft: '',
  createdAt: 1,
  updatedAt: 2,
  projectId: null,
};

const channelA: Channel = {
  id: 'ch-a',
  name: 'general',
  description: '',
  folderProjectId: null,
  memberRoleIds: ['r1'],
  createdAt: 1,
  updatedAt: 1,
};
const channelB: Channel = {
  id: 'ch-b',
  name: 'design',
  description: '',
  folderProjectId: 'p1',
  memberRoleIds: ['r1', 'r2'],
  createdAt: 1,
  updatedAt: 2,
};
const roleA: RoleProfile = {
  id: 'r1',
  name: '设计师',
  intro: '负责界面',
  instruction: '给出界面建议。',
  defaultRuntime: 'claude',
  createdAt: 1,
  updatedAt: 1,
};
const roleB: RoleProfile = {
  id: 'r2',
  name: '工程师',
  intro: '负责实现',
  instruction: '给出实现建议。',
  defaultRuntime: 'codex',
  createdAt: 2,
  updatedAt: 2,
};

function renderSidebar(overrides: Partial<ComponentProps<typeof Sidebar>> = {}) {
  return render(
    <Sidebar
      conversations={[convScoped, convFree]}
      channels={[channelA, channelB]}
      roles={[roleA, roleB]}
      activeConversationId={null}
      activeChannelId={null}
      activeRoleId={null}
      onSelectConversation={() => {}}
      onCreateConversation={() => {}}
      onDeleteConversation={() => {}}
      onSelectChannel={() => {}}
      onCreateChannel={() => {}}
      onDissolveChannel={() => {}}
      onSelectRole={() => {}}
      onCreateRole={() => {}}
      {...overrides}
    />,
  );
}

describe('Sidebar', () => {
  it('renders scoped and unscoped personal conversations in one personal group', () => {
    renderSidebar();
    expect(screen.getByTestId('sidebar-conversations')).toBeInTheDocument();
    expect(screen.getByText('project-bound-conv')).toBeInTheDocument();
    expect(screen.getByText('free-conv')).toBeInTheDocument();
  });

  it('renders channels sorted by updatedAt desc', () => {
    renderSidebar();
    const names = screen.getAllByText(/general|design/).map((el) => el.textContent);
    expect(names.findIndex((name) => name === 'design')).toBeLessThan(
      names.findIndex((name) => name === 'general'),
    );
  });

  it('new channel and new role actions are explicit in the left rail', () => {
    const onCreateChannel = vi.fn();
    const onCreateRole = vi.fn();
    renderSidebar({ onCreateChannel, onCreateRole });

    fireEvent.click(screen.getByTestId('sidebar-new-channel'));
    fireEvent.click(screen.getByLabelText('新建角色'));

    expect(onCreateChannel).toHaveBeenCalledTimes(1);
    expect(onCreateRole).toHaveBeenCalledTimes(1);
  });

  it('× on a conversation triggers onDeleteConversation without selecting it', () => {
    const onSelectConversation = vi.fn();
    const onDeleteConversation = vi.fn();
    renderSidebar({ onSelectConversation, onDeleteConversation });

    fireEvent.click(screen.getByLabelText('删除对话 free-conv'));

    expect(onDeleteConversation).toHaveBeenCalledWith('c2');
    expect(onSelectConversation).not.toHaveBeenCalled();
  });

  it('role item opens the role detail surface', () => {
    const onSelectRole = vi.fn();
    renderSidebar({ onSelectRole });

    fireEvent.click(screen.getByTitle('工程师'));

    expect(onSelectRole).toHaveBeenCalledWith('r2');
  });

  it('dissolve channel action does not select the channel', () => {
    const onSelectChannel = vi.fn();
    const onDissolveChannel = vi.fn();
    renderSidebar({ onSelectChannel, onDissolveChannel });

    fireEvent.click(screen.getByLabelText('解散群聊 design'));

    expect(onDissolveChannel).toHaveBeenCalledWith('ch-b');
    expect(onSelectChannel).not.toHaveBeenCalled();
  });
});
