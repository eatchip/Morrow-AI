import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const mainBundle = resolve(process.cwd(), 'out/main/index.js');

const env: Record<string, string> = { MORROW_E2E: '1' };
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') {
    env[k] = v;
  }
}

test('channel MVP: create channel, mention role, create role, open settings', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    await win.locator('[data-testid="sidebar-new-channel"]').click();
    await expect(win.locator('.workspace-dialog')).toContainText('新建群聊');
    await win.locator('.workspace-dialog input').first().fill('general');
    await win.locator('.check-row').filter({ hasText: '设计师' }).click();
    await win.getByRole('button', { name: '创建群聊' }).click();

    await expect(win.locator('.channel-header h1')).toHaveText('#general');
    await expect(win.locator('[data-testid="sidebar-channels"]')).toContainText('general');
    await expect
      .poll(async () =>
        win
          .locator('.sidebar-channel-row.active .sidebar-channel-main strong')
          .evaluate((node) => getComputedStyle(node).color),
      )
      .not.toBe('rgb(0, 0, 0)');

    const composer = win.locator('.channel-composer textarea');
    await composer.fill('@');
    await expect(win.getByRole('listbox', { name: '选择频道角色' })).toBeVisible();
    await win.getByRole('option').filter({ hasText: '设计师' }).click();
    await expect(composer).toHaveValue('@设计师 ');
    await composer.fill('@设计师 看一下频道体验');
    await composer.press('Enter');

    await expect(win.locator('.channel-message.user .message-body')).toContainText(
      '@设计师 看一下频道体验',
    );

    await win.getByLabel('新建角色').click();
    await expect(win.locator('.workspace-dialog')).toContainText('新建角色');
    await win.locator('.workspace-dialog input').first().fill('测试员');
    await win.locator('.workspace-dialog select').selectOption('codex');
    await win.locator('.workspace-dialog textarea').nth(0).fill('负责复查边界和验收。');
    await win.locator('.workspace-dialog textarea').nth(1).fill('你是测试员，优先指出风险。');
    await win.locator('.dialog-list.compact .check-row').filter({ hasText: 'general' }).click();
    await win.getByRole('button', { name: '创建角色' }).click();

    await expect(win.locator('.role-drawer')).toContainText('测试员');
    await expect(win.locator('.role-drawer')).toContainText('指示');
    await expect(win.locator('[data-testid="sidebar-roles"]')).toContainText('测试员');

    await win.locator('.role-drawer textarea').nth(1).fill('你是测试员，优先指出验收风险。');
    await win.getByRole('button', { name: '保存设置' }).click();
    await expect(win.locator('.role-drawer textarea').nth(1)).toHaveValue(
      '你是测试员，优先指出验收风险。',
    );

    win.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await win.getByRole('button', { name: '删除当前角色' }).click();
    await expect(win.locator('.role-drawer')).toHaveCount(0);
    await expect(win.locator('[data-testid="sidebar-roles"]')).not.toContainText('测试员');

    await win.getByLabel('解散群聊 general').click();
    await expect(win.locator('.workspace-dialog')).toContainText('解散 #general？');
    await expect(win.locator('.workspace-dialog')).toContainText('此操作无法撤销');
    await win.getByRole('button', { name: '确认解散' }).click();
    await expect(win.locator('[data-testid="sidebar-channels"]')).not.toContainText('general');
    await expect(win.locator('.channel-empty-state')).toContainText('选择或新建一个群聊');
  } finally {
    await app.close();
  }
});

test('channel keeps the composer visible after long history', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    await win.locator('[data-testid="sidebar-new-channel"]').click();
    await win.locator('.workspace-dialog input').first().fill('long-thread');
    await win.getByRole('button', { name: '创建群聊' }).click();
    await expect(win.locator('.channel-header h1')).toHaveText('#long-thread');

    const channelId = await win.evaluate(async () => {
      const api = (window as unknown as { morrowApi: typeof window.morrowApi }).morrowApi;
      const snapshot = await api.channels.getSnapshot();
      const channel = snapshot.channels.find((item) => item.name === 'long-thread');
      if (!channel) throw new Error('long-thread channel missing');
      return channel.id;
    });

    await win.evaluate(async (id) => {
      const api = (window as unknown as { morrowApi: typeof window.morrowApi }).morrowApi;
      const postChannelMessage = api.channels.postMessage;
      await Promise.all(
        Array.from({ length: 28 }, (_, index) =>
          postChannelMessage({
            channelId: id,
            text: `第 ${index + 1} 条消息：这是一段用来撑高群聊历史的内容，确保页面需要滚动时输入框仍然留在底部。`,
          }),
        ),
      );
    }, channelId);
    await expect(win.locator('.channel-message.user')).toHaveCount(28);

    const layout = await win.evaluate(() => {
      const main = document.querySelector<HTMLElement>('.layout-main');
      const stream = document.querySelector<HTMLElement>('.channel-stream');
      const composer = document.querySelector<HTMLElement>('.channel-composer-wrap');
      if (!main || !stream || !composer) {
        throw new Error('channel layout elements missing');
      }
      const mainRect = main.getBoundingClientRect();
      const composerRect = composer.getBoundingClientRect();
      return {
        composerBottom: composerRect.bottom,
        composerTop: composerRect.top,
        mainBottom: mainRect.bottom,
        mainTop: mainRect.top,
        streamClientHeight: stream.clientHeight,
        streamScrollHeight: stream.scrollHeight,
      };
    });

    expect(layout.composerTop).toBeGreaterThanOrEqual(layout.mainTop);
    expect(layout.composerBottom).toBeLessThanOrEqual(layout.mainBottom);
    expect(layout.streamScrollHeight).toBeGreaterThan(layout.streamClientHeight);

    const composer = win.locator('.channel-composer textarea');
    await composer.fill('输入框仍然可用');
    await composer.press('Enter');
    await expect(win.locator('.channel-message.user .message-body').last()).toContainText(
      '输入框仍然可用',
    );
  } finally {
    await app.close();
  }
});
