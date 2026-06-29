import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const mainBundle = resolve(process.cwd(), 'out/main/index.js');

// 继承环境但剔除 ELECTRON_RUN_AS_NODE；注入 MORROW_E2E=1（preload mock，两 runtime 均 installed）。
const env: Record<string, string> = { MORROW_E2E: '1' };
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') {
    env[k] = v;
  }
}

const STORAGE_KEY = 'morrow:agent-prefs:v1';

/**
 * ModelPicker 烟测：
 *  - Composer 内可见 picker 触发器
 *  - 打开面板 → 切换 claude 模型 → 触发器文案更新
 *  - 切到 codex → 切换智能档位 → 触发器含档位分段
 *  - 偏好写入 localStorage；reload 后仍然生效
 */
test('model picker: open, switch model/effort, persist across reload', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');

    // detect 完成后进入 home；preload mock 下默认 current=claude
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    // 清理任何历史偏好，保证初始状态确定
    await win.evaluate((key) => {
      window.localStorage.removeItem(key);
    }, STORAGE_KEY);
    await win.reload();
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    // ---- claude 分支：默认模型 sonnet ----
    const trigger = win.locator('.model-picker-trigger');
    await expect(trigger).toBeVisible();
    await expect(trigger).toContainText('sonnet');

    // 打开面板，切到 opus
    await trigger.click();
    const panel = win.locator('.model-picker-panel');
    await expect(panel).toBeVisible();
    await panel.locator('.model-picker-item', { hasText: /^opus$/ }).click();
    await expect(trigger).toContainText('opus');

    // 点击外部关闭
    await win.locator('.hero').click();
    await expect(panel).toHaveCount(0);

    // ---- 切到 codex：触发器应出现 "模型 · 档位" 形态 ----
    await win.locator('.rt-card[data-rt="codex"]').click();
    await expect(trigger).toContainText('gpt-5.5');
    await expect(trigger).toContainText('·');

    // 打开面板，切换智能档位到 high
    await trigger.click();
    await expect(panel).toBeVisible();
    await panel.getByRole('option', { name: '高 high', exact: true }).click();
    await expect(trigger).toContainText('高');

    // ---- 持久化：reload 后仍然命中 high ----
    const stored = await win.evaluate((key) => window.localStorage.getItem(key), STORAGE_KEY);
    expect(stored).toBeTruthy();
    const parsed = JSON.parse(stored as string);
    expect(parsed.codex.effort).toBe('high');
    expect(parsed.claude.model).toBe('opus');

    await win.reload();
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });
    // reload 后默认仍是 claude（App 的 current 派生逻辑），先切回 codex 复核
    await win.locator('.rt-card[data-rt="codex"]').click();
    await expect(win.locator('.model-picker-trigger')).toContainText('高');
    // 再切回 claude 复核模型
    await win.locator('.rt-card[data-rt="claude"]').click();
    await expect(win.locator('.model-picker-trigger')).toContainText('opus');
  } finally {
    await app.close();
  }
});
