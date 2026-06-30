import { BrowserWindow, shell } from 'electron';
import { is } from '@electron-toolkit/utils';
import { join } from 'node:path';

export function createMainWindow(): BrowserWindow {
  const e2e = process.env['MORROW_E2E'] === '1';
  const isDarwin = process.platform === 'darwin';
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    // macOS：保留系统红绿灯，隐藏标题栏，悬浮在自绘顶栏左上。
    // Win/Linux：用 titleBarOverlay 让系统画最小/最大/关闭控件，避免两套 chrome 套娃。
    titleBarStyle: isDarwin ? 'hiddenInset' : 'hidden',
    trafficLightPosition: isDarwin ? { x: 14, y: 14 } : undefined,
    titleBarOverlay: isDarwin
      ? undefined
      : { color: '#0a0a0a', symbolColor: '#e5e5e5', height: 44 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // sandboxed 下 preload 读不到 process.env，改用 argv 传递 E2E 开关。
      additionalArguments: e2e ? ['--morrow-e2e'] : [],
    },
  });

  if (!e2e) {
    win.once('ready-to-show', () => {
      win.show();
    });
  }
  // E2E 模式：刻意不 show，窗口在 hidden 状态下仍正常渲染，Playwright 通过 CDP 驱动；
  // 配合 index.ts 里的 setActivationPolicy('accessory') + dock.hide()，跑测时不抢焦点、不进 Dock。

  win.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    void win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
