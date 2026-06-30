# Spec — E2E Background Window（自动化测试不抢焦点）

> 分支：`feat/background-automation`
> 任务定级：**Large**（跨模块 + 运行时窗口生命周期变更）
> 视觉稿前置闸门：⚪ **不适用**（不影响真实用户 UI；只改 E2E 模式行为）

---

## 1. 背景与问题

当前 `pnpm test:e2e` 通过 `_electron.launch` 启动真·Electron 进程，主进程在 `ready-to-show` 时调用 `win.show()`（见 `src/app/main/window.ts:31`），导致：

- 测试窗口在 macOS 上**抢占前台焦点**，正在使用的编辑器/浏览器被切走；
- App 出现在 Dock 与 ⌘+Tab 切换列表中，干扰当前工作流；
- `playwright.config.ts:11` 注释里写的"默认 offscreen / 不抢焦点"目前**只是文档承诺，没有实现**。

期望：E2E 跑测时窗口在"背后"运行，不打断当前活动应用。

---

## 2. 业界最佳实践参考

调研了几条主流方案（详见 `docs/playbooks/research-method.md` 流程）：

| 方案 | 思路 | 评估 |
|---|---|---|
| Xvfb（Linux only） | 虚拟 X11 显示 | macOS 不适用，PASS |
| `BrowserWindow.show: false` + 不调 `show()` | 窗口对象存在、渲染照常，但不上屏 | ✅ 简单、跨平台、Playwright `firstWindow()` 仍能拿到 |
| `webPreferences.offscreen: true` | 真·offscreen 渲染（CEF OSR） | 与 Chromium 渲染路径不一致，已知 IPC / DOM 行为差异，PASS |
| `app.setActivationPolicy('accessory')` (macOS) | 应用以菜单栏附属身份运行，不进 Dock、不抢焦点 | ✅ 与"不 show" 配合 |
| `app.dock.hide()` (macOS) | 立即移出 Dock | ✅ 与上面叠加，覆盖 `ready-to-show` 之前的瞬间 |
| `win.showInactive()` | 显示但不激活 | ⚠️ 仍会在屏幕上出现窗口；不符合"完全在背后"诉求 |
| `win.setFocusable(false)` | 禁止获取焦点 | ⚠️ 不阻止上屏；部分平台兼容性差 |

> 注：用户提到的"opencove 方案"未能定位到原始来源；采用 macOS Electron 社区共识：**「don't show + accessory policy + dock.hide」三件套**。该组合在 sst/opencode、Raycast 风格的菜单栏类应用中均有先例。

**结论**：采用 `show: false` + 不调 `show()` + `setActivationPolicy('accessory')` + `dock.hide()`，全部由 `MORROW_E2E=1` 触发，互斥于真实用户启动路径。

---

## 3. 状态所有权 / 不变量 / 边界

### 状态所有权
- **E2E 模式判定**：`MORROW_E2E=1` 环境变量（已通过 `tests/e2e/mvp-smoke.spec.ts:8` 注入）。主进程在 `index.ts` / `window.ts` 内读 `process.env`；preload 仍走现有 `--morrow-e2e` argv 通道。
- **窗口可见性**：在 E2E 模式下，`window.ts` 不调用 `win.show()`；Playwright 通过 CDP 直接 attach。
- **App 激活策略**：在 E2E 模式下，主进程在 `app.whenReady()` 之前/之中调用 `setActivationPolicy('accessory')` + `dock.hide?.()`。

### 不变量
1. **真实用户路径零影响**：`MORROW_E2E !== '1'` 时窗口、Dock、激活策略与今天完全一致（show + regular policy）。
2. **Playwright 仍能驱动 renderer**：即便窗口不 show，`firstWindow()` 与 DOM 交互必须工作（Electron 在 hidden 状态下默认仍渲染；如需保险加 `paintWhenInitiallyHidden: true`，该选项默认 true）。
3. **不抢焦点 = 当前活动窗口在测试期间不失焦**：验证手段见 §6。

### 边界
- 仅修改 main 进程入口（`src/app/main/window.ts` + `src/app/main/index.ts`）与文档注释。
- 不改 preload、renderer、IPC、E2E 测试用例本身。
- macOS 专属 API（`dock`、`setActivationPolicy`）必须做平台守卫；Linux/Windows 走 `show:false` 单挡即可（Windows 上 `show:false` 已不上 taskbar，Linux 同理）。

---

## 4. 受影响文件

| 文件 | 修改类型 | 影响函数 |
|---|---|---|
| `src/app/main/window.ts` | 编辑 | `createMainWindow()` —— 在 `e2e === true` 分支跳过 `win.once('ready-to-show', ...)` 中的 `win.show()` |
| `src/app/main/index.ts` | 编辑 | 文件顶层 + `app.whenReady()` 回调 —— E2E 模式下调用 `app.setActivationPolicy('accessory')`（macOS）与 `app.dock?.hide?.()` |
| `playwright.config.ts` | 编辑（注释） | 把"窗口模式 offscreen"的过期注释更新为"hidden + accessory policy" |
| `scripts/test-e2e-with-window-fallback.mjs` | 编辑（注释） | 移除"hidden → offscreen → inactive 降级 TODO"，改为说明已实装 hidden 模式 |
| `docs/development/DEBUGGING.md` | 编辑 | 更新 §窗口模式相关段落（行 47-48, 98） |
| `DEVELOPMENT.md` | 编辑 | 更新行 251-252 关于窗口模式的描述 |
| `CHANGELOG.md` | 追加 `[Unreleased]` | 用户可感知：跑测试不再打断当前窗口 |

> **不新增任何文件**。所有改动落在已有文件。

---

## 5. 实现细节

### 5.1 `src/app/main/window.ts`

```ts
export function createMainWindow(): BrowserWindow {
  const e2e = process.env['MORROW_E2E'] === '1';
  // ... 现有 BrowserWindow 构造保持不变（已经 show: false）

  if (!e2e) {
    win.once('ready-to-show', () => {
      win.show();
    });
  }
  // E2E 模式：不主动 show，Playwright 通过 CDP 驱动；窗口在 hidden 状态下仍正常渲染。

  // 其余 webContents.setWindowOpenHandler / loadURL / loadFile 不变
  return win;
}
```

### 5.2 `src/app/main/index.ts`

```ts
import { app, BrowserWindow } from 'electron';
// ...

const e2e = process.env['MORROW_E2E'] === '1';

// hydrateProcessPath() 保持原位

if (e2e && process.platform === 'darwin') {
  // 必须在 app ready 之前设置，避免 Dock 出现一瞬间。
  app.setActivationPolicy?.('accessory');
}

void app.whenReady().then(() => {
  if (e2e && process.platform === 'darwin') {
    app.dock?.hide?.();
  }
  // 其余逻辑不变
});
```

> 注：`setActivationPolicy` 在 Electron 32+ 已稳定（`app.setActivationPolicy(policy)` macOS only）。`app.dock` 在非 macOS 上为 undefined，可选链已守卫。

### 5.3 文档同步

只动文字，不再赘述（详细 diff 在 tasks 阶段给出）。

---

## 6. 验证方式

### 6.1 自动验证（必须通过）
- `pnpm test:e2e` 跑 `tests/e2e/mvp-smoke.spec.ts` 通过——证明窗口虽不 show 但 renderer 仍工作、IPC mock 仍生效；
- `pnpm test`（Vitest）不受影响（本改动不动 unit/contract 路径）。

### 6.2 人工验证（手动复现"不抢焦点"）
在 macOS：
1. 把焦点放在一个文本编辑器窗口（光标在输入框中）；
2. 在另一个 terminal 跑 `pnpm test:e2e`；
3. 期望：
   - **当前编辑器始终保持焦点**（光标不消失、不闪烁）；
   - Dock 中**不**出现 Morrow / Electron 图标；
   - ⌘+Tab 切换列表中**不**出现 Electron；
   - Playwright 测试通过、生成报告。
4. 跑常规 `pnpm dev` 时上述行为应**完全恢复正常**（窗口可见、Dock 有图标、可被聚焦）—— 防回归。

### 6.3 闸门
- `pnpm pre-commit` 全绿（含 lint / typecheck / vitest / e2e 子集）。

---

## 7. 风险与回退

| 风险 | 缓解 |
|---|---|
| 某些 macOS 版本 `setActivationPolicy` 调用时机不对仍会闪 Dock | 在 `app.whenReady` 之前同步调；同时 `dock.hide()` 兜底 |
| 隐藏窗口下 Chromium 暂停渲染（`backgroundThrottling` / `paintWhenInitiallyHidden`） | `BrowserWindow` 默认 `paintWhenInitiallyHidden: true`；当前 webPreferences 未关闭 throttling，必要时显式 `backgroundThrottling: false` 但**先不加**（YAGNI；mvp-smoke 通过即可证明无需） |
| 未来 CI 上 Linux 跑 E2E 仍需 Xvfb | 与本任务正交；CI 决策见 ADR 0004，不在此 spec 范围 |

回退：单 commit，必要时直接 `git revert`。

---

## 8. 预期产出

- 一次（或最多两次）符合 §5 Commit Hygiene 的提交：
  1. `feat(main): hide window and use accessory policy in E2E mode · stop test runs from stealing focus`
  2.（可选）`docs: update e2e window mode notes · align with hidden+accessory implementation`
- `CHANGELOG.md` `[Unreleased]` 段落新增一条 user-visible 变更说明。
- `pnpm pre-commit` 通过。

---

## 9. Out of Scope（未做的事，若需要请新开 SDD）

- 真正的 offscreen 渲染（CEF OSR）方案；
- Linux CI 的 Xvfb / xvfb-run 集成；
- E2E 窗口模式降级链（`hidden → offscreen → inactive`）—— 当前一档 hidden 已能满足"不抢焦点"需求，多档降级是性能/稳定性优化，应由独立 SDD `e2e-window-fallback` 推进。
