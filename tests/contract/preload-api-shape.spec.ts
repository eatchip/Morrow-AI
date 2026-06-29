import { describe, expect, it, vi } from 'vitest';

/**
 * Contract: preload exposes MorrowApi (4 methods) on window via contextBridge.
 * 不启动 Electron，mock `electron` 模块后 import preload，断言暴露的 API 形状。
 */
describe('preload api shape', () => {
  it('exposes MorrowApi with runtime + projects methods', async () => {
    const exposeInMainWorld = vi.fn();
    const on = vi.fn();
    const off = vi.fn();
    const invoke = vi.fn().mockResolvedValue(undefined);
    vi.doMock('electron', () => ({
      contextBridge: { exposeInMainWorld },
      ipcRenderer: { invoke, on, off },
    }));

    await import('../../src/app/preload/index');

    expect(exposeInMainWorld).toHaveBeenCalledTimes(1);
    const [key, api] = exposeInMainWorld.mock.calls[0]!;
    expect(key).toBe('morrowApi');
    expect(typeof api.detectRuntimes).toBe('function');
    expect(typeof api.sendPrompt).toBe('function');
    expect(typeof api.abortSession).toBe('function');
    expect(typeof api.onStream).toBe('function');
    expect(typeof api.cancelRun).toBe('function');
    expect(typeof api.onRunEvent).toBe('function');
    expect(typeof api.pty.startAgentSession).toBe('function');
    expect(typeof api.pty.write).toBe('function');
    expect(typeof api.pty.resize).toBe('function');
    expect(typeof api.pty.kill).toBe('function');
    expect(typeof api.pty.snapshot).toBe('function');
    expect(typeof api.pty.onData).toBe('function');
    expect(typeof api.pty.onExit).toBe('function');
    expect(typeof api.listProjects).toBe('function');
    expect(typeof api.addProject).toBe('function');
    expect(typeof api.removeProject).toBe('function');
    expect(typeof api.channels.getSnapshot).toBe('function');
    expect(typeof api.channels.createChannel).toBe('function');
    expect(typeof api.channels.createRole).toBe('function');
    expect(typeof api.channels.updateRole).toBe('function');
    expect(typeof api.channels.deleteRole).toBe('function');
    expect(typeof api.channels.deleteChannel).toBe('function');
    expect(typeof api.channels.addRoleToChannel).toBe('function');
    expect(typeof api.channels.postMessage).toBe('function');
    expect(typeof api.channels.acceptHandoff).toBe('function');
    expect(typeof api.channels.onEvent).toBe('function');

    // onStream 返回 unsubscribe
    const unsub = api.onStream(() => {});
    expect(on).toHaveBeenCalledWith('runtime:stream', expect.any(Function));
    expect(typeof unsub).toBe('function');
    unsub();
    expect(off).toHaveBeenCalledWith('runtime:stream', expect.any(Function));

    const unsubRun = api.onRunEvent(() => {});
    expect(on).toHaveBeenCalledWith('runtime:run-event', expect.any(Function));
    expect(typeof unsubRun).toBe('function');
    unsubRun();
    expect(off).toHaveBeenCalledWith('runtime:run-event', expect.any(Function));

    const unsubPtyData = api.pty.onData(() => {});
    expect(on).toHaveBeenCalledWith('pty:data', expect.any(Function));
    expect(typeof unsubPtyData).toBe('function');
    unsubPtyData();
    expect(off).toHaveBeenCalledWith('pty:data', expect.any(Function));

    const unsubPtyExit = api.pty.onExit(() => {});
    expect(on).toHaveBeenCalledWith('pty:exit', expect.any(Function));
    expect(typeof unsubPtyExit).toBe('function');
    unsubPtyExit();
    expect(off).toHaveBeenCalledWith('pty:exit', expect.any(Function));

    await api.pty.startAgentSession({ runtime: 'codex', prompt: 'hi', cols: 120, rows: 30 });
    expect(invoke).toHaveBeenCalledWith('pty:start-agent', {
      runtime: 'codex',
      prompt: 'hi',
      cols: 120,
      rows: 30,
    });
    await api.pty.write({ sessionId: 'pty-1', data: 'x' });
    expect(invoke).toHaveBeenCalledWith('pty:write', { sessionId: 'pty-1', data: 'x' });
    await api.pty.resize({ sessionId: 'pty-1', cols: 120, rows: 30 });
    expect(invoke).toHaveBeenCalledWith('pty:resize', {
      sessionId: 'pty-1',
      cols: 120,
      rows: 30,
    });
    await api.pty.kill('pty-1');
    expect(invoke).toHaveBeenCalledWith('pty:kill', 'pty-1');
    await api.pty.snapshot('pty-1');
    expect(invoke).toHaveBeenCalledWith('pty:snapshot', 'pty-1');
    await api.cancelRun('run-1');
    expect(invoke).toHaveBeenCalledWith('runtime:run-cancel', 'run-1');

    // projects 方法走 invoke
    await api.listProjects();
    expect(invoke).toHaveBeenCalledWith('projects:list');
    await api.addProject();
    expect(invoke).toHaveBeenCalledWith('projects:add');
    await api.removeProject('p-x');
    expect(invoke).toHaveBeenCalledWith('projects:remove', 'p-x');

    await api.channels.getSnapshot();
    expect(invoke).toHaveBeenCalledWith('channels:get-snapshot');
    await api.channels.createChannel({ name: 'general' });
    expect(invoke).toHaveBeenCalledWith('channels:create-channel', { name: 'general' });
    await api.channels.createRole({
      name: '设计师',
      intro: '负责界面',
      instruction: '给出建议',
      defaultRuntime: 'claude',
    });
    expect(invoke).toHaveBeenCalledWith('channels:create-role', {
      name: '设计师',
      intro: '负责界面',
      instruction: '给出建议',
      defaultRuntime: 'claude',
    });
    await api.channels.updateRole({ roleId: 'r1', instruction: 'new' });
    expect(invoke).toHaveBeenCalledWith('channels:update-role', {
      roleId: 'r1',
      instruction: 'new',
    });
    await api.channels.deleteRole({ roleId: 'r1' });
    expect(invoke).toHaveBeenCalledWith('channels:delete-role', { roleId: 'r1' });
    await api.channels.deleteChannel({ channelId: 'c1' });
    expect(invoke).toHaveBeenCalledWith('channels:delete-channel', { channelId: 'c1' });
    await api.channels.addRoleToChannel({ channelId: 'c1', roleId: 'r1' });
    expect(invoke).toHaveBeenCalledWith('channels:add-role-to-channel', {
      channelId: 'c1',
      roleId: 'r1',
    });
    // oxlint-disable-next-line require-post-message-target-origin
    await api.channels.postMessage({ channelId: 'c1', text: '@设计师 看看' });
    expect(invoke).toHaveBeenCalledWith('channels:post-message', {
      channelId: 'c1',
      text: '@设计师 看看',
    });
    await api.channels.acceptHandoff({ channelId: 'c1', handoffId: 'h1' });
    expect(invoke).toHaveBeenCalledWith('channels:accept-handoff', {
      channelId: 'c1',
      handoffId: 'h1',
    });
    const unsubChannel = api.channels.onEvent(() => {});
    expect(on).toHaveBeenCalledWith('channels:event', expect.any(Function));
    expect(typeof unsubChannel).toBe('function');
    unsubChannel();
    expect(off).toHaveBeenCalledWith('channels:event', expect.any(Function));

    vi.doUnmock('electron');
  });
});
