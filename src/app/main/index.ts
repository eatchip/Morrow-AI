import { app, BrowserWindow } from 'electron';
import { electronApp, optimizer } from '@electron-toolkit/utils';
import { createMainWindow } from './window';
import { registerIpc } from './ipc';
import { killAll } from './runtime-session';
import { hydrateProcessPath } from './shell-path';

let cleanupRuntime: (() => void) | null = null;

// GUI 启动时 macOS launchd 只给最小 PATH；在任何 detect/spawn 之前把登录 shell 的 PATH 接回来。
hydrateProcessPath();

// E2E 模式：以 macOS "accessory" 身份启动，避免抢焦点 / 进 Dock / 进 ⌘+Tab。
// 必须在 app ready 之前同步调一次，避免 Dock 出现一瞬间。
const e2e = process.env['MORROW_E2E'] === '1';
if (e2e && process.platform === 'darwin') {
  app.setActivationPolicy?.('accessory');
}

void app.whenReady().then(() => {
  electronApp.setAppUserModelId('dev.morrow');

  if (e2e && process.platform === 'darwin') {
    // 兜底：即使 setActivationPolicy 时机错过，dock.hide 也能立即移出 Dock。
    app.dock?.hide?.();
  }

  app.on('browser-window-created', (_event, window) => {
    optimizer.watchWindowShortcuts(window);
  });

  const win = createMainWindow();
  cleanupRuntime = registerIpc(win).cleanup;

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  if (cleanupRuntime) {
    cleanupRuntime();
    cleanupRuntime = null;
    return;
  }
  killAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
