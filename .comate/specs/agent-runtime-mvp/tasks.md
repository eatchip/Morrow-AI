# Tasks · agent-runtime-mvp

把 `morrow-mvp.html` 原型接进 Electron 三进程，真实调起本机 `claude` / `codex`。
每个顶层 Task = 1 次原子提交，遵循 `<type>(<scope>): <what> · <why>`。

- [x] Task 1: 定义共享 IPC 契约与类型
    - 1.1: 新建 `src/shared/ipc.ts`，导出 `RuntimeId / RuntimeInfo / DetectResult / SendPromptArgs / StreamEvent / MorrowApi`
    - 1.2: `tsconfig.json` 的 path 别名或 include 确保 main/preload/renderer 三端都能 import `src/shared/*`
    - 1.3: 跑 `pnpm type-check` 确认零报错

- [x] Task 2: Preload 暴露 window.morrowApi
    - 2.1: 重写 `src/app/preload/index.ts` 走 `contextBridge.exposeInMainWorld('morrowApi', api)`
    - 2.2: 更新 `src/app/preload/index.d.ts`，声明 `window.morrowApi: MorrowApi`（保留对 globalThis 的 augment）
    - 2.3: 改写 `tests/contract/preload-api-shape.spec.ts`，断言 MorrowApi 的 4 个方法名存在且类型为 function（通过解析 preload 源文件静态断言，沿用原有"不启动 Electron"策略）
    - 2.4: `pnpm test` 通过

- [x] Task 3: Main 侧 runtime 检测
    - 3.1: 新建 `src/app/main/runtime-detect.ts`，导出 `detectRuntimes(): Promise<DetectResult>`
    - 3.2: 使用 `execFile` + 3s 超时；PATH 不通时返回 `installed:false` + error 信息
    - 3.3: 版本号正则 `/\b(\d+\.\d+\.\d+)\b/` 提取
    - 3.4: 新建 `tests/unit/runtime-detect.spec.ts` 用 `vi.mock('node:child_process')` 覆盖 4 种场景（两个都在/一个在/都没/超时）

- [x] Task 4: Main 侧 runtime 会话（spawn + stream + abort）
    - 4.1: 新建 `src/app/main/runtime-session.ts`，导出 `startSession / abortSession / killAll`
    - 4.2: 实现 `parseClaudeLine` / `parseCodexLine` 两个纯函数（§3.3）
    - 4.3: spawn 时剔除 `ELECTRON_RUN_AS_NODE`，stdio 全 pipe，prompt 走 stdin
    - 4.4: `readline` 按行推；SIGTERM → 2s 超时 → SIGKILL 兜底
    - 4.5: 新建 `tests/unit/runtime-parse.spec.ts`，给 parseClaudeLine/parseCodexLine 各 5+ 条真实样本行（包括 system/assistant/result/agent_message_delta/error/裸文本）

- [x] Task 5: Main 侧 IPC 注册
    - 5.1: 新建 `src/app/main/ipc.ts`，注册 `runtime:detect / runtime:send-prompt / runtime:abort` handler
    - 5.2: 修改 `src/app/main/index.ts`，在 `createMainWindow()` 后 `registerIpc(win)`，`app.before-quit` 触发 `killAll`
    - 5.3: 入参 zod-less 手写校验（runtime 枚举 / prompt 非空 / sessionId 形状）

- [x] Task 6: Renderer 样式与字体
    - 6.1: 把 `morrow-mvp.html` 的 `:root` tokens 与 4 屏样式搬到 `src/app/renderer/src/index.css`（删 Debug bar 相关）
    - 6.2: `src/app/renderer/index.html` 引入 Google Fonts（Inter / JetBrains Mono / Noto Sans SC），title 改为 "Morrow"
    - 6.3: 确认 `pnpm build` 能产出 renderer bundle

- [x] Task 7: Renderer 组件与屏幕
    - 7.1: 新建 `src/app/renderer/src/lib/stream.ts` 暴露 `useStream()` hook
    - 7.2: 新建 `components/Composer.tsx`（textarea + 发送按钮 + ⌘⏎ 快捷键）
    - 7.3: 新建 `components/RuntimeBadge.tsx`（顶栏右上，含 popover 切换）
    - 7.4: 新建 `screens/Splash.tsx`（检测动画，两行 detect-row）
    - 7.5: 新建 `screens/Install.tsx`（两张安装卡 + 重新检测）
    - 7.6: 新建 `screens/Home.tsx`（hero + Composer + runtime strip）
    - 7.7: 新建 `screens/Chat.tsx`（消息流 + 底部 Composer + Esc 返回）
    - 7.8: 重写 `App.tsx` 主状态机（scene/runtimes/current/messages/streaming）

- [x] Task 8: E2E 烟测
    - 8.1: 新建 `tests/e2e/mvp-smoke.spec.ts`：在 `window.load` 前 mock `window.morrowApi`，模拟 detect → home → send → chunk → done 全流程
    - 8.2: 替换/保留 `tests/e2e/scaffold-smoke.spec.ts` 的占位（若其 selector 失效则删除并在 CHANGELOG 里说明替换）
    - 8.3: `pnpm test:e2e` 通过

- [x] Task 9: CHANGELOG + pre-commit 全闸门
    - 9.1: 更新 `CHANGELOG.md` 的 `[Unreleased] § Added`：列出 MVP 功能（4 屏、detect、CLI spawn、abort）
    - 9.2: `pnpm pre-commit` 8 步绿灯
    - 9.3: 人工启动 `pnpm dev` 在本机跑一遍 AC §5.1 的功能验收
