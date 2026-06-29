# frameless-chrome — 收尾总结

**Commit**: `0c26536` on `feat/mvp`
**SDD**: `.comate/specs/frameless-chrome/{doc.md, tasks.md, summary.md}`
**耗时**: 单次会话

## 交付内容

1. **消除 chrome 套娃** — 主窗口改 `hiddenInset`（macOS）/ `titleBarOverlay`（Win/Linux），系统红绿灯唯一一组。
2. **启用原生拖拽** — `.top` 整块 `-webkit-app-region: drag`；按钮、pill、back-btn 显式 `no-drag`。
3. **修复全屏留黑** — `.window` 原型残留 1100×720 圆角卡片改为 `100%×100vh`，清 body padding / 渐变 / 装饰阴影。
4. **清干净** — 删 `.traffic .dot*` JSX 与 CSS 规则、删中央 `morrow` 重复标题。

## 变更面

| 文件 | Δ |
|---|---|
| `src/app/main/window.ts` | +8 / -0（hiddenInset + overlay） |
| `src/app/renderer/src/App.tsx` | +1 / -6（删伪 chrome JSX） |
| `src/app/renderer/src/index.css` | +14 / -37（`.window` 铺满 + 拖拽区 + 删 dot 规则） |
| `CHANGELOG.md` | +4 |

## 验证

- `pnpm pre-commit` 全绿：lint 0 / format ok / typecheck ok / unit 0 related / e2e 1/1 passed。
- 肉眼：红绿灯只剩系统一组，顶栏单层，全屏真·铺满。

## 根因回顾

两层套娃由两个独立根因叠加：
1. **窗口 chrome 双画**：renderer 画了 `.traffic` 伪红绿灯 + `morrow` 标题，而 BrowserWindow 用默认 frame。→ Task 1/2 解决。
2. **`.window` 是原型卡片**：原静态 HTML 里 `.window` 被当作「浏览器模型」装饰（1100×720 + shadow + radius + body padding），搬到 Electron 后变成第二层可视外框，全屏也不跟随。→ doc.md §8 追加、Task 2 顺带修。

## 遗留 / 后续

- Win/Linux `titleBarOverlay` 颜色当前写死深色，主题切换时需跟进。
- 顶栏当前只留 back-btn + spacer + rt-badge；后续若引入搜索或 breadcrumb，布局重排时顺便重评。
- E2E 未新增用例（无选择器变更），视觉回归暂由人工 + mvp-smoke 兜底。
