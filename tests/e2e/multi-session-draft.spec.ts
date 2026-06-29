import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const mainBundle = resolve(process.cwd(), 'out/main/index.js');

const env: Record<string, string> = { MORROW_E2E: '1' };
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') {
    env[k] = v;
  }
}

test('personal chats: background reply does not block a new chat, and draft is recoverable', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    await win.locator('.rt-card[data-rt="codex"]').click();
    const composer = win.locator('.composer textarea').first();
    await composer.fill('[slow] background');
    await composer.press('Enter');
    await expect(win.locator('.msg-user')).toHaveText('[slow] background');

    await win.locator('.back-btn').click();
    await expect(win.locator('.hero')).toBeVisible();
    await win.locator('[data-testid="sidebar-new"]').click();
    await expect(win.locator('.composer textarea').first()).toHaveValue('');

    await win.locator('.composer textarea').first().fill('现在就能发了');
    await expect(win.getByRole('button', { name: '发送' })).toBeEnabled();
    await win.locator('.composer textarea').first().press('Enter');
    await expect(win.locator('.msg-user')).toHaveText('现在就能发了');
    await expect(win.locator('.ai-body')).toContainText('结构化回复：现在就能发了');

    await win.locator('.back-btn').click();
    await win.locator('[data-testid="sidebar-new"]').click();
    await win.locator('.composer textarea').first().fill('为什么这个会报错');
    await expect(win.locator('.sidebar-item', { hasText: '为什么这个会报错' })).toBeVisible();

    await win
      .locator('.sidebar-item', { hasText: '现在就能发了' })
      .locator('.sidebar-item-body')
      .click();
    await expect(win.locator('.msg-user')).toHaveText('现在就能发了');

    await win
      .locator('.sidebar-item', { hasText: '为什么这个会报错' })
      .locator('.sidebar-item-body')
      .click();
    await expect(win.locator('.hero')).toBeVisible();
    await expect(win.locator('.composer textarea').first()).toHaveValue('为什么这个会报错');
  } finally {
    await app.close();
  }
});
