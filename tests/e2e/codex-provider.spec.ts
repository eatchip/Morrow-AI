import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const mainBundle = resolve(process.cwd(), 'out/main/index.js');

const env: Record<string, string> = { MORROW_E2E: '1' };
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') {
    env[k] = v;
  }
}

test('codex main timeline is driven by structured provider events', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    await win.locator('.rt-card[data-rt="codex"]').click();
    const ta = win.locator('.composer textarea').first();
    const prompt = Array.from({ length: 36 }, (_, i) => `介绍这个项目 ${i + 1}`).join('\n');
    await ta.fill(prompt);
    await ta.press('Enter');

    await expect(win.locator('.msg-user')).toContainText('介绍这个项目 1');
    await expect(win.locator('.ai-body')).toContainText('结构化回复：介绍这个项目');
    await expect(win.locator('[data-testid="agent-transcript"]')).toHaveCount(0);
    await expect(win.locator('[data-testid="terminal-log-toggle"]')).toHaveCount(0);
    await expect(win.locator('[data-testid="terminal-pane"]')).toHaveCount(0);

    const transcriptText = await win.locator('.stream-inner').innerText();
    expect(transcriptText).not.toContain('Update available');
    expect(transcriptText).not.toContain('Starting MCP servers');
    expect(transcriptText).not.toContain('no-project-cwd');
    expect(transcriptText).not.toContain('Improve documentation in @filename');
    expect(transcriptText).not.toContain('q q');

    await win.waitForFunction(() => {
      const aiBodies = Array.from(document.querySelectorAll<HTMLElement>('.ai-body'));
      const lastAi = aiBodies.at(-1);
      const composer = document.querySelector<HTMLElement>('.composer-wrap');
      if (!lastAi || !composer) return false;
      const clearance = Math.round(
        composer.getBoundingClientRect().top - lastAi.getBoundingClientRect().bottom,
      );
      return clearance > 16;
    });
  } finally {
    await app.close();
  }
});
