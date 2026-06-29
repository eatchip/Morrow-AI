import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const mainBundle = resolve(process.cwd(), 'out/main/index.js');

const env: Record<string, string> = { MORROW_E2E: '1' };
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') {
    env[k] = v;
  }
}

test('runtime stability: a stuck run times out without blocking another chat', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    await win.locator('.rt-card[data-rt="codex"]').click();
    await win.locator('.composer textarea').first().fill('[stuck] background');
    await win.locator('.composer textarea').first().press('Enter');

    await expect(win.locator('.msg-user')).toHaveText('[stuck] background');
    await expect(win.locator('[data-testid="run-status"]')).toContainText('Codex 正在运行');
    await expect(win.locator('[data-testid="run-status"]')).toContainText('还没有收到可见输出', {
      timeout: 1500,
    });

    await win.locator('.back-btn').click();
    await win.locator('[data-testid="sidebar-new"]').click();
    await win.locator('.composer textarea').first().fill('next can send');
    await win.locator('.composer textarea').first().press('Enter');

    await expect(win.locator('.msg-user')).toHaveText('next can send');
    await expect(win.locator('.ai-body')).toContainText('结构化回复：next can send');

    await win.locator('.back-btn').click();
    await win
      .locator('.sidebar-item', { hasText: '[stuck] background' })
      .locator('.sidebar-item-body')
      .click();

    await expect(win.locator('.msg-user')).toHaveText('[stuck] background');
    await expect(win.locator('.ai-body')).toContainText('等待运行结果超时', {
      timeout: 3000,
    });
    await expect(win.locator('[data-testid="run-status"]')).toContainText('本次运行已停止');
    await win.getByRole('button', { name: '诊断' }).click();
    await expect(win.locator('.run-status-log')).toContainText('deadline first-output');
    await expect(win.locator('.ai-body')).not.toContainText('deadline first-output');
    await expect(win.locator('.composer textarea').first()).toBeEnabled();
  } finally {
    await app.close();
  }
});

test('runtime stability: twenty sequential turns complete in one chat', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    await win.locator('.rt-card[data-rt="codex"]').click();
    const composer = win.locator('.composer textarea').first();

    /* oxlint-disable no-await-in-loop -- this test intentionally verifies sequential turns. */
    for (let i = 1; i <= 20; i += 1) {
      const text = `turn ${i}`;
      await composer.fill(text);
      await composer.press('Enter');
      await expect(win.locator('.msg-user')).toHaveCount(i);
      await expect(win.locator('.ai-body').nth(i - 1)).toContainText(`结构化回复：${text}`);
    }
    /* oxlint-enable no-await-in-loop */

    await expect(win.locator('[data-testid="run-status"]')).toHaveCount(0);
    await expect(composer).toBeEnabled();
  } finally {
    await app.close();
  }
});
