/** @vitest-environment happy-dom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Project } from '../../src/shared/ipc';
import { ProjectPicker } from '../../src/app/renderer/src/components/ProjectPicker';

afterEach(() => cleanup());

const projects: Project[] = [
  { id: 'p1', name: 'alpha', path: '/tmp/alpha', createdAt: 1, lastUsedAt: 10 },
  { id: 'p2', name: 'beta', path: '/tmp/beta', createdAt: 1, lastUsedAt: 20 },
];

describe('ProjectPicker', () => {
  it('默认态显示"进入项目工作"', () => {
    render(
      <ProjectPicker
        projects={projects}
        activeProjectId={null}
        locked={false}
        onSelect={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText('进入项目工作')).toBeInTheDocument();
  });

  it('选中后显示项目名', () => {
    render(
      <ProjectPicker
        projects={projects}
        activeProjectId="p1"
        locked={false}
        onSelect={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(screen.getByText(/alpha/)).toBeInTheDocument();
  });

  it('打开后可按名称过滤', () => {
    render(
      <ProjectPicker
        projects={projects}
        activeProjectId={null}
        locked={false}
        onSelect={() => {}}
        onAdd={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('进入项目工作'));
    const search = screen.getByPlaceholderText('搜索项目');
    fireEvent.change(search, { target: { value: 'bet' } });
    expect(screen.queryByText('alpha')).not.toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
  });

  it('locked 模式只有"退出项目"', () => {
    const onSelect = vi.fn();
    render(
      <ProjectPicker
        projects={projects}
        activeProjectId="p1"
        locked
        onSelect={onSelect}
        onAdd={() => {}}
      />,
    );
    fireEvent.click(screen.getByText(/alpha/));
    const exit = screen.getByText('退出项目');
    fireEvent.click(exit);
    expect(onSelect).toHaveBeenCalledWith(null);
    // locked 不展示搜索框
    expect(screen.queryByPlaceholderText('搜索项目')).not.toBeInTheDocument();
  });

  it('locked 且未关联项目时触发器静态化（点击不展开 panel）', () => {
    const onSelect = vi.fn();
    render(
      <ProjectPicker
        projects={projects}
        activeProjectId={null}
        locked
        onSelect={onSelect}
        onAdd={() => {}}
      />,
    );
    const trigger = screen.getByText('本对话未关联项目');
    fireEvent.click(trigger);
    // 不展开任何 panel：既无搜索框，也无"退出项目"按钮
    expect(screen.queryByPlaceholderText('搜索项目')).not.toBeInTheDocument();
    expect(screen.queryByText('退出项目')).not.toBeInTheDocument();
    expect(onSelect).not.toHaveBeenCalled();
    // a11y：标记为 disabled，不暴露 listbox 语义
    const button = trigger.closest('button')!;
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-haspopup')).toBeNull();
  });
});
