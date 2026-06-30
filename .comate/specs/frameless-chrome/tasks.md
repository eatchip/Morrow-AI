# frameless-chrome 任务计划

- [x] Task 1: 主进程窗口改 frameless + 跨平台 chrome 策略
    - 1.1: `src/app/main/window.ts` 加 `titleBarStyle: 'hiddenInset'`、`trafficLightPosition`
    - 1.2: Win/Linux 分支加 `titleBarOverlay`（深色兜底）
    - 1.3: `pnpm build` 验证主进程 bundle 可生成

- [x] Task 2: Renderer 删除伪 chrome + 启用拖拽区
    - 2.1: `App.tsx` 删除 `.traffic` 三圆点 JSX
    - 2.2: `index.css` 删除 `.traffic` / `.dot*` 规则
    - 2.3: `index.css` 给 `.top` 加 `-webkit-app-region: drag` + macOS 左 padding 88px
    - 2.4: 给 `.back-btn` / `.rt-badge` / `button` 加 `no-drag`

- [x] Task 3: 自验 + 回归
    - 3.1: `pnpm dev` 肉眼确认单层 chrome、红绿灯只出现一次
    - 3.2: 拖拽顶栏空白 → 窗口移动；点返回 / pill → 不拖动
    - 3.3: `pnpm pre-commit` 全绿

- [x] Task 4: 文档与提交
    - 4.1: `CHANGELOG.md [Unreleased]` 加一行视觉修复说明
    - 4.2: 按 AGENTS.md §5 格式提交（单 commit：`fix(main,renderer): frameless chrome ...`）
