# Summary · agent-runtime-mvp

## Outcome

把 `morrow-mvp.html` 静态原型升级为**可真实运行的 Electron MVP**。启动 Morrow 后会检测本机 `claude` / `codex` CLI，若至少一个可用即进入首页；键入 prompt 后通过直连 CLI 获取流式回复，支持 Esc 中止与返回首页。

9 个原子 commit 落地，共 25 个文件新增/修改；`pnpm pre-commit` 8 步全绿；18 条单元+契约测试 + 1 条 E2E 烟测通过。

## Delivered commits (feat/mvp)

| # | Commit | Scope |
| - | - | - |
| 1 | `feat(shared): define IPC contract types` | `src/shared/ipc.ts` 契约 + tsconfig include 扩容 |
| 2 | `feat(preload): expose MorrowApi bridge with 4 IPC methods` | preload 替换冻结空占位 → `contextBridge` 桥 |
| 3 | `feat(main): add runtime detect with timeout and version parse` | `runtime-detect.ts` + 4 场景契约测试 |
| 4 | `feat(main): add runtime session spawn stream abort with JSONL parsers` | `runtime-session.ts` + `parseClaudeLine` / `parseCodexLine` + 12 解析样本测试 |
| 5 | `feat(main): register IPC handlers and wire killAll on quit` | `ipc.ts` handler + `before-quit` cleanup |
| 6 | `feat(renderer): port MVP design tokens and screen styles` | `index.css` + `screens.css`（拆表满足 400 行闸门） |
| 7 | `feat(renderer): implement MVP screens and state machine` | 4 屏 + 2 组件 + `useStream` hook + 状态机 |
| 8 | `test(e2e): replace scaffold smoke with MVP flow + fix preload CJS` | `mvp-smoke.spec.ts` + preload CJS 输出修正 + argv 透传 E2E flag |
| 9 | `docs(changelog): record agent-runtime-mvp MVP scope` | `CHANGELOG.md [Unreleased]` 回填 |

## Architecture snapshot

```
┌──────────────────────────── Main (Node) ────────────────────────────┐
│  index.ts         createMainWindow → registerIpc(win)               │
│  ipc.ts           runtime:detect / send-prompt / abort handlers     │
│  runtime-detect   execFile --version + 3s timeout + semver parse    │
│  runtime-session  spawn CLI · readline JSONL · SIGTERM→2s→SIGKILL   │
└─────────────────────────┬───────────────────────────────────────────┘
                          │  ipcMain.handle / webContents.send
                          ▼
┌────────────────────── Preload (sandboxed CJS) ──────────────────────┐
│  index.ts         contextBridge.exposeInMainWorld('morrowApi', api) │
│                   argv[--morrow-e2e] → 切换内存态 mock（E2E 专用）  │
└─────────────────────────┬───────────────────────────────────────────┘
                          │  window.morrowApi
                          ▼
┌──────────────────── Renderer (React 18 + CSS) ──────────────────────┐
│  App.tsx          scene state machine + message reducer             │
│  screens/*        Splash / Install / Home / Chat                    │
│  components/*     Composer / RuntimeBadge                           │
│  lib/stream.ts    useStream() hook                                  │
└─────────────────────────────────────────────────────────────────────┘
```

## Key technical decisions

1. **Preload 必须 CJS**：sandboxed preload 无法解析 ESM `import`，`electron.vite.config.ts` 的 preload 段 `output.format = 'cjs'`，产物 `out/preload/index.js`。
2. **E2E mock 注入点**：sandboxed preload 读不到 `process.env`，主进程 `BrowserWindow.webPreferences.additionalArguments = ['--morrow-e2e']`，preload 判断 `process.argv.includes('--morrow-e2e')`。
3. **Stream 事件 owner**：ref 写入在反应式 reducer **外**进行（否则 React 批处理会让后到的 chunk reducer 看到被清空的 ref）。
4. **JSONL 解析策略**：Claude 走 `-p <prompt> --output-format stream-json --include-partial-messages --verbose`；Codex 走 `exec --json --skip-git-repo-check -`（prompt 从 stdin 入）；两端解析失败均 passthrough 原始行以保证最小可见。
5. **Abort 生命周期**：`SIGTERM → 2s → SIGKILL`；`app.before-quit` 调用 `killAll()` 清理所有 session。

## Validation

- `pnpm check`：TypeScript zero error（三进程 tsconfig 联邦通过）
- `pnpm test`：18 tests 通过（1 scaffold + 4 detect + 12 parse + 1 preload shape）
- `pnpm test:e2e`：1 test 通过（mvp-smoke，走通 splash → home → chat → chunk → done）
- `pnpm pre-commit`：8 闸门全绿（line-check / secret / naming / lint / format / type / test:staged / e2e:pre-commit）
- 手工 AC（§5.1）：需用户 `pnpm dev` 真机验证（CLI 真实调起、回复流式渲染、Esc 中止）

## Follow-ups (不阻塞本 SDD)

- 真实 CLI 集成的端到端稳定性（Claude 长上下文、Codex 多段 delta）——等 dog-food 期暴露问题
- Runtime badge 切换后的会话隔离（当前 `messages[]` 是全局列表，切 runtime 会串号）
- 错误态视觉（`.ai-body.error`）目前只是红字，缺重试按钮
- Chat 历史持久化（目前关闭窗口即丢失）
- `design-tokens-enforcement` SDD 落地后，现有硬编码内联样式（如 RuntimeBadge 下拉）需迁移到 CSS 类
