import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const mainBundle = resolve(process.cwd(), 'out/main/index.js');

// 继承环境但剔除 ELECTRON_RUN_AS_NODE（某些宿主会将其置 1，Electron 会被误判为 Node）。
// 同时注入 MORROW_E2E=1：preload 改用内存态 mock，不触达真实 ipcMain / 子进程。
const env: Record<string, string> = { MORROW_E2E: '1' };
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') {
    env[k] = v;
  }
}

/**
 * MVP 烟测：splash → home → chat 关键状态机 + 侧边栏多会话 + 键盘契约。
 * Mock 在 preload 层（MORROW_E2E=1），渲染层无感。
 */
test('mvp smoke: splash → home → chat with sidebar + enter-send + back', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');

    // 检测完成后进入 home（出现 hero 与两张 runtime 卡）
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });
    await expect(win.locator('.rt-card[data-rt="claude"]')).toBeVisible();
    await expect(win.locator('.rt-card[data-rt="codex"]')).toBeVisible();

    // 侧边栏始终可见，并包含"+ 新建对话"按钮与空态
    await expect(win.locator('[data-testid="sidebar"]')).toBeVisible();
    await expect(win.locator('[data-testid="sidebar-new"]')).toBeVisible();
    await expect(win.locator('.sidebar-empty').first()).toBeVisible();

    // preload 注入的 API 暴露了 7 个方法（4 个核心 + 3 个 projects）
    const apiShape = await win.evaluate(() => {
      const api = (window as unknown as { morrowApi: Record<string, unknown> }).morrowApi;
      const pty = api?.pty as Record<string, unknown> | undefined;
      return {
        detect: typeof api?.detectRuntimes,
        send: typeof api?.sendPrompt,
        abort: typeof api?.abortSession,
        stream: typeof api?.onStream,
        cancelRun: typeof api?.cancelRun,
        runEvent: typeof api?.onRunEvent,
        ptyStart: typeof pty?.startAgentSession,
        ptyWrite: typeof pty?.write,
        ptySnapshot: typeof pty?.snapshot,
        listProjects: typeof api?.listProjects,
        addProject: typeof api?.addProject,
        removeProject: typeof api?.removeProject,
      };
    });
    expect(apiShape).toEqual({
      detect: 'function',
      send: 'function',
      abort: 'function',
      stream: 'function',
      cancelRun: 'function',
      runEvent: 'function',
      ptyStart: 'function',
      ptyWrite: 'function',
      ptySnapshot: 'function',
      listProjects: 'function',
      addProject: 'function',
      removeProject: 'function',
    });

    // Enter 直接发送（不需要 ⌘+Enter）→ 进入 chat → 出现 user 气泡 + AI 回复
    const ta = win.locator('.composer textarea').first();
    await ta.fill('ping');
    await ta.press('Enter');

    await expect(win.locator('.msg-user')).toHaveText('ping');
    await expect(win.locator('.ai-body')).toContainText('hi');

    // 侧边栏应出现一条会话，标题派生自首条用户消息
    await expect(win.locator('.sidebar-item').first()).toContainText('ping');

    // 顶部"← 首页"按钮可见，点击后回到 home
    const backBtn = win.locator('.back-btn');
    await expect(backBtn).toBeVisible();
    await backBtn.click();
    await expect(win.locator('.hero')).toBeVisible();

    // 新建对话：点击 "+ 新建对话"，会出现第二条会话项；此时仍在 home
    await win.locator('[data-testid="sidebar-new"]').click();
    await expect(win.locator('.hero')).toBeVisible();
    await expect(win.locator('.sidebar-item')).toHaveCount(2);
  } finally {
    await app.close();
  }
});
