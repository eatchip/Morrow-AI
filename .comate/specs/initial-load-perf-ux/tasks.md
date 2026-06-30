# initial-load-perf-ux — Tasks

> 顺序设计原则：每个 Task 独立可验证、可单独提交；先做不影响 UI 的主进程内核层，再做 IPC 契约，最后做可见层，尾部补测试与收尾。

- [x] Task 1: 引入 PATH 缓存 + 异步 hydrate（纯主进程，无 UI 变更）
    - 1.1: 在 `src/app/main/shell-path.ts` 新增 `hydrateProcessPathAsync()`（使用 `execFile` Promise 化 `$SHELL -ilc 'echo $PATH'`，保持 3s timeout）
    - 1.2: 新增 `loadShellPathCache()` / `saveShellPathCache()`（读写 `app.getPath('userData')/shell-path.json`；JSON 损坏或不存在时返回 null，不抛）
    - 1.3: 新增 `hydrateProcessPathFromCache()`：同步读缓存，命中即 merge 进 `process.env.PATH`；保留现有 `hydrateProcessPath()` 的纯同步语义与跳过条件，避免破坏单测
    - 1.4: `tests/unit/shell-path.test.ts` 扩展：缓存 miss / hit / 损坏、异步版 resolve/timeout、并发写入幂等

- [ ] Task 2: 调整主进程启动链路，让 hydrate 退出关键路径
    - 2.1: `src/app/main/index.ts` 移除顶层 `hydrateProcessPath()` 调用；改为 `whenReady` 内先调 `hydrateProcessPathFromCache()`（μs 级）
    - 2.2: 在 `whenReady` 中 fire-and-forget 调用 `hydrateProcessPathAsync()`，完成后写回缓存并通过 `win.webContents.send('splash:event', ...)` 广播完成
    - 2.3: 手测：`pnpm dev` 两次启动确认首次有 login shell spawn、二次命中缓存（通过临时日志或断点确认）

- [ ] Task 3: 定义 `splash:event` 契约并打通 IPC 管线
    - 3.1: `src/shared/ipc.ts` 新增 `SplashEvent` 联合类型 + channel 常量
    - 3.2: `src/app/preload/index.ts` 暴露 `onSplashEvent(cb)`；`index.d.ts` 同步类型
    - 3.3: `src/app/main/ipc.ts` 新增主进程缓存 `lastSplashEvent` + 订阅时 snapshot 回放能力（renderer 通过一次性 IPC 请求拉取）
    - 3.4: 契约/单测：`tests/contract/` 或 `tests/unit/` 补 `SplashEvent` shape 断言

- [ ] Task 4: `detectRuntimes` 支持 progress 回调并广播事件
    - 4.1: `src/app/main/runtime-detect.ts` 为 `detectRuntimes` 增加可选 `onProgress(step, total, detail)` 形参；在每个 probe 开始/结束时回调（保持并行执行，progress 以完成计数递增）
    - 4.2: `ipc.ts` 的 detect handler 接上 `onProgress`，翻译成 `splash:event` 并更新 `lastSplashEvent`
    - 4.3: 单测：mock probe，断言回调触发次数与最终 total=N

- [ ] Task 5: 窗口首帧即可见——backgroundColor + 提前 show
    - 5.1: `src/app/main/window.ts` 添加 `backgroundColor: '#0b0b0d'`（与 `--bg` 一致）
    - 5.2: 改 `show: false` + `ready-to-show` 为：保留 hidden 初始，但在 `did-start-loading` 即 `win.show()`（实测 macOS/win 均可用；若该事件触发过晚再 fallback 至构造后立即 `show()`）
    - 5.3: 手测：冷启动录屏确认无黑屏间隙；现有 e2e spec 不破

- [ ] Task 6: `index.html` 内联 boot splash（CSS-only）
    - 6.1: 在 `src/app/renderer/index.html` `<body>` 内增加 `.boot-splash` DOM（wordmark + indeterminate bar），**引用 `var(--bg)` / `var(--accent)`**，不硬编码色值
    - 6.2: 在 `<head>` 内联最小关键 CSS（只含 boot splash 所需变量与 keyframes），保证 JS 解析前可渲
    - 6.3: `App.tsx` 挂载后在一个 `useEffect` 内为 `<body>` 打 `data-splash="react"`，用 `index.css` 规则让 `.boot-splash { display: none }` 以平滑移除
    - 6.4: 视觉同构自检：截图对比 boot splash 与 React Splash 首帧，无 layout shift

- [ ] Task 7: React Splash 升级为 determinate progress
    - 7.1: `src/app/renderer/src/screens/Splash.tsx` 新增 `progress?: { step: number; total: number; detail?: string }` prop；replace 顶部 indeterminate spinner 为进度条（就地在 `Splash.tsx` 写小组件，不新建文件）
    - 7.2: `src/app/renderer/src/index.css` 加进度条样式，严格使用 `--accent / --line / --muted` tokens
    - 7.3: `App.tsx` 订阅 `morrowApi.onSplashEvent`，将事件聚合为 `progress` state 注入 Splash
    - 7.4: 单测（renderer）覆盖三种 progress 状态（pending / in-progress / done）

- [ ] Task 8: 回归测试 + e2e 断言
    - 8.1: 运行 `pnpm test` 全量单测
    - 8.2: 新增/更新 Playwright e2e：断言 wordmark 在 1s 内出现、progress 达到 100% 后进入 home/install
    - 8.3: `pnpm test:e2e` 绿

- [ ] Task 9: 收尾与提交
    - 9.1: 更新 `CHANGELOG.md` `[Unreleased]` 两条（perf / UX）
    - 9.2: `pnpm pre-commit` 闸门通过
    - 9.3: 按仓库约定用原生 `git commit` 分多个 meaningful unit 提交（至少拆分：shell-path 缓存、启动链路、splash 事件契约、window backgroundColor、boot splash、progress UI、测试收尾）
    - 9.4: 生成 `.comate/specs/initial-load-perf-ux/summary.md`
