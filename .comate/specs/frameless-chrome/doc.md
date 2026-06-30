# frameless-chrome — 无边框窗口 · 消除 chrome 套娃

## 0. 背景与问题

当前 `BrowserWindow` 使用 macOS 默认 frame（真实标题栏"Morrow" + 系统红绿灯），而 renderer 内部又画了一套「伪 chrome」：`.traffic` 里三个 CSS 圆点 + `.title "morrow"`。用户截图（2026-05-12）显示两层套娃，严重违反视觉契约（ADR 0005：Linear 骨架 + Arc 血肉，目标是像 Linear / Arc 那样单层、克制的 chrome）。

## 1. 业界参考

- **Linear（macOS）**：frameless + `hiddenInset` 样式；系统红绿灯悬浮在自定义顶栏左上；顶栏承担 breadcrumb / 视图切换。
- **Arc**：完全隐藏系统 chrome，在 renderer 内自绘 tab bar 与地址栏；窗口通过 `-webkit-app-region: drag` 区域拖拽。
- **VS Code / Cursor**：Windows 用 `titleBarStyle: 'hidden'` + `titleBarOverlay`（原生控件叠加）；macOS 用 `hiddenInset`；Linux 走自绘全套。
- **Electron 官方推荐**：`titleBarStyle: 'hiddenInset'`（macOS）+ `titleBarOverlay`（Win/Linux），配合 CSS `app-region: drag|no-drag` 管理拖拽命中。

结论：macOS `hiddenInset` + 让出 78px 左侧宽度给真红绿灯；Win/Linux 暂用 `titleBarOverlay` 兜底。本轮只要 macOS 跑通即可（目前唯一运行目标），但代码结构不得写死 darwin。

## 2. 需求与验收

### 2.1 场景
1. 启动应用 → 窗口**只有一层 chrome**：系统红绿灯 + 自定义顶栏（包含返回按钮、标题 `morrow`、runtime 药丸）。
2. macOS 上：红绿灯由系统渲染，位于左上角；顶栏左侧留出 78px 避让空间。
3. 顶栏空白区域可拖拽窗口；按钮、药丸、可交互控件不触发拖拽。
4. Win/Linux 上：使用 `titleBarOverlay`（暂简化，保持现有视觉，不画假按钮）。

### 2.2 验收标准
- 视觉：一层 chrome，不再有 `.traffic .dot` 的伪红绿灯圆点。
- 功能：窗口可通过顶栏空白区拖拽；runtime pill / 返回按钮正常点击。
- 回归：所有现有 e2e、单元测试绿；`pnpm pre-commit` 通过。
- 跨平台：Windows/Linux 启动不崩，视觉可接受（不做像素对齐要求）。

## 3. 状态所有权与不变量

- **窗口样式所有权**：`src/app/main/window.ts::createMainWindow` 唯一决定 `titleBarStyle` 与 `titleBarOverlay`。
- **拖拽区所有权**：renderer 的 `.top` 默认 `-webkit-app-region: drag`；内部交互元素（button / pill / back-btn）显式 `no-drag`。
- **不变量**：
  1. 渲染进程**不再绘制**伪红绿灯；所有 window chrome 控件来自系统。
  2. 顶栏高度保持 44px，与当前布局不变（避免联动 body 高度计算）。
  3. macOS 顶栏左侧 padding ≥ 78px（系统红绿灯占位）。

## 4. 受影响文件

| 文件 | 动作 | 理由 |
|---|---|---|
| `src/app/main/window.ts` | 修改 | 加 `titleBarStyle` / `trafficLightPosition` / `titleBarOverlay` |
| `src/app/renderer/src/App.tsx` | 修改 | 删 `.traffic + .dot` JSX；保留 back-btn、title、rt-badge |
| `src/app/renderer/src/index.css` | 修改 | 删 `.traffic` / `.dot*` 规则；`.top` 加 `app-region: drag` + 跨平台左 padding；交互元素加 `no-drag` |

E2E / 单元测试不引用 `.traffic` / `.dot` 选择器（已 grep 验证），无需改。

## 5. 实现要点

### 5.1 main/window.ts
```ts
const win = new BrowserWindow({
  width: 1280,
  height: 800,
  show: false,
  autoHideMenuBar: true,
  titleBarStyle: 'hiddenInset',     // macOS: 保留系统红绿灯，隐藏标题栏
  trafficLightPosition: { x: 14, y: 14 },
  titleBarOverlay: process.platform === 'darwin'
    ? undefined
    : { color: '#0a0a0a', symbolColor: '#e5e5e5', height: 44 }, // Win/Linux 兜底
  webPreferences: { ... },
});
```

### 5.2 App.tsx
删除：
```tsx
<div className="traffic">
  <span className="dot r" />
  <span className="dot y" />
  <span className="dot g" />
</div>
```
保留 `.top` 容器（承担拖拽区）、back-btn、title、rt-badge。

### 5.3 index.css
```css
.top {
  height: 44px;
  /* macOS 给系统红绿灯让位；其他平台走 titleBarOverlay 不需要 */
  padding: 0 14px 0 88px;
  -webkit-app-region: drag;
}
.top .back-btn,
.top .rt-badge,
.top button {
  -webkit-app-region: no-drag;
}
/* 删除 .traffic / .dot.r / .dot.y / .dot.g 规则 */
```

> 跨平台 padding：Windows/Linux 的 `titleBarOverlay` 会自动预留右侧控件空间，本轮统一用 88px 左 padding 是「macOS 优先、其他平台可接受偏移」的取舍。若后续上 Win，由独立 SDD 优化。

## 6. 风险与边界

- **拖拽区捕获输入**：`.top` 设置为 drag 后，按钮若未 `no-drag` 会点击失效 → 通过子选择器显式放行。
- **runtime pill 菜单**：RuntimeBadge 是 `<button>`，已被 `button` 选择器兜底。
- **E2E 稳定性**：Playwright 的 `getByRole('button', {name: ...})` 不受 drag 区影响；但若测试用坐标点击标题栏空白区会拖动窗口 — 当前测试没这么做。
- **Windows titleBarOverlay 颜色**：暂写死深色，后续跟主题切换一起走。

## 7. 预期验证

- `pnpm dev` 启动 → 肉眼确认单层 chrome + 红绿灯只在左上出现一次。
- 拖动顶栏空白区 → 窗口移动；点击返回按钮 / runtime pill → 窗口不移动。
- `pnpm pre-commit` 全绿。
- 在 `CHANGELOG.md [Unreleased]` 记录视觉一致性修复。

## 8. 补丁：`.window` / body 原型残留（2026-05-12 追加）

实测发现，即便去掉了伪红绿灯，仍有「外框套内框」且全屏后四周留黑，根因不在窗口 chrome，而在 renderer 最外层：

- `.window`：硬编码 `width: 1100px` / `height: 720px` / `margin: 0 auto` + 圆角边框 + 三层阴影（浏览器模型卡样式）
- `body`：`padding: 28px 0 40px` + 径向渐变装饰背景

这是从静态原型 HTML 直接迁过来的"mockup 卡片"，在真实 Electron 窗口里会变成第二层 chrome，全屏也不会跟随拉伸。

修正：
- `.window` 改为 `width: 100%; height: 100vh`，去圆角、去边框、去阴影。
- `body` 去掉 padding 和渐变，改为扁平 bg。

这一步仍落在 Task 2（renderer chrome 清理）范围内，不再另起任务。

