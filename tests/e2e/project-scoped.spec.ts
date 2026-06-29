import { _electron as electron, expect, test } from '@playwright/test';
import { resolve } from 'node:path';

const mainBundle = resolve(process.cwd(), 'out/main/index.js');

const env: Record<string, string> = { MORROW_E2E: '1' };
for (const [k, v] of Object.entries(process.env)) {
  if (v !== undefined && k !== 'ELECTRON_RUN_AS_NODE') {
    env[k] = v;
  }
}

/**
 * project-scoped-chat 烟测：
 *  - 通过 ProjectPicker 添加本地文件夹
 *  - Composer 上方 ProjectPicker 显示项目名
 *  - 发送消息 → conversation 保持个人对话，同时项目选择进入 locked 态
 * 使用 MORROW_E2E mock：addProject 生成 /tmp/mock-N 伪项目，不触系统 dialog。
 */
test('project-scoped: add project → pick → send → conversation locks project context', async () => {
  const app = await electron.launch({ args: [mainBundle], env });
  try {
    const win = await app.firstWindow();
    await win.waitForLoadState('domcontentloaded');
    await expect(win.locator('.hero')).toBeVisible({ timeout: 10_000 });

    // 初始：个人工作台没有单独的「项目」导航分组。
    await expect(win.locator('[data-testid="sidebar-projects-empty"]')).toHaveCount(0);

    // 通过 Composer 上方 ProjectPicker 添加项目。
    await win.locator('.project-picker-trigger').first().click();
    await win.locator('.project-picker-add').click();

    // ProjectPicker 自动选中新增项目（Home 下方 picker）
    await expect(win.locator('.project-picker-trigger.has-project')).toBeVisible();

    // 发送消息
    const ta = win.locator('.composer textarea').first();
    await ta.fill('hello project');
    await ta.press('Enter');
    await expect(win.locator('.msg-user')).toHaveText('hello project');

    // 侧边栏：conversation 留在个人对话下，不再嵌套项目分支。
    await expect(win.locator('.sidebar-item').first()).toContainText('hello project');

    // Chat 视图的 picker 进入 locked 态（无 caret，无 panel 可开）
    const trigger = win.locator('.project-picker-trigger.locked');
    await expect(trigger).toBeVisible();
  } finally {
    await app.close();
  }
});
