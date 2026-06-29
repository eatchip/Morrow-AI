# initial-load-perf-ux — Spec

> 目标：缩短首屏**可感知时延**，并在任何时刻都给出**可见进度**，消除「dock 弹跳 → 长时间黑屏」的体验。

---

## 1. 现象与根因

### 现象
用户下载 DMG 安装 Morrow 后双击启动，**首次打开**表现为：

1. Dock 图标弹跳数秒，**无任何窗口出现**；
2. 窗口最终出现时，第一帧是完全空白，稍后才切到 splash「Detecting local AI runtimes…」；
3. 整个过程没有可见的加载进度（只有右上角系统菜单栏告诉你"App 在跑"）。

### 根因拆解（按延迟贡献由大到小）

| # | 现象 | 根因 | 代码位置 |
|---|---|---|---|
| R1 | 主进程 `app.whenReady()` 前卡 1–3s | `hydrateProcessPath()` 在顶层同步调用 `spawnSync($SHELL, ['-ilc', 'echo $PATH'])`，timeout `3000ms`。冷启动下 zsh 加载 `.zshrc`（oh-my-zsh / nvm / pyenv…）经常耗时 1–3 秒，**阻塞 Node 主线程**，也阻塞窗口创建 | `src/app/main/index.ts:9`、`src/app/main/shell-path.ts:50` |
| R2 | 窗口延迟出现 | `createMainWindow` 用 `show: false` + `ready-to-show`，窗口只在**渲染进程解析完 HTML/CSS/JS + React 挂载完**后才第一次 `show()`。加上 macOS 首次启动的 Gatekeeper 验签 + 代码签名缓存冷、v8 snapshot 冷页，第一帧额外多几百 ms 到 1s | `src/app/main/window.ts:11,30` |
| R3 | 可见进度缺失 | HTML 里 `<div id="root"></div>` 是空壳；在 React bundle 解析执行前**屏幕是纯黑**。Splash 组件本身才是 React 组件，真正可见是在 `ready-to-show` 之后 | `src/app/renderer/index.html:13`、`src/app/renderer/src/screens/Splash.tsx` |
| R4 | detect 进一步增加 splash 停留 | `detectRuntimes()` 并行 `claude --version` / `codex --version`，各 timeout 3s。首次执行还要走 Node/Python 冷启动，实测常见 500ms–2s。此时 splash 只有一个"checking…"旋转图标，无确定度 | `src/app/main/runtime-detect.ts:3,55` |

R1+R2+R3 组合起来，冷启动下用户**先看 2–5 秒黑屏**，是最刺眼的体验损失。

### 不变量
1. **任何时刻屏幕上必须有 Morrow 品牌可见元素或进度反馈**（进度条 / 脉冲动画 / 文字），不得出现「窗口可见但完全空白」的中间态；
2. **路径 hydration、runtime 探测、窗口显示**三件事解耦：其中任何一件慢/失败，都不得阻塞另外两件的可见反馈；
3. 冷启动黑屏窗口时间（launch → first paint）**不超过 800ms**（M2 Mac、本地 dev build 基线，非严格 SLA，用于回归对比）。

---

## 2. 业界最佳实践参考

- **VS Code** 与 **Electron Fiddle**：用 `backgroundColor` 设成品牌色，允许窗口在 renderer 就绪前就 `show`，首帧显示的是窗口底色而不是白屏。（`BrowserWindow.backgroundColor` 官方推荐用法）
- **Figma Desktop / Slack / Linear**：在 `index.html` **内联**一个 CSS-only 的 splash（logo + indeterminate progress bar），renderer JS 挂载后以 React splash 平滑覆盖，消除"HTML 到 JS"的白屏断档。
- **Electron 官方文档 · Performance Checklist**：明确禁止在 `app.ready` 之前做同步 I/O（含 `spawnSync`）；推荐将 shell 探测异步化或放到 ready 之后并行做。
- **`fix-path` / `shell-path` 库**：给出了"缓存 PATH 到 `userData`、下次启动先用缓存、后台异步刷新"的双缓冲实现模板。
- **Determinate vs Indeterminate Progress**：Nielsen Norman 研究：任务 > 1s 必须有进度指示，> 10s 必须有可估算进度或可取消操作。我们这里 detect 是有限步骤（claude、codex 两项），天然适合**determinate 进度条**（0/2 → 1/2 → 2/2）。

---

## 3. 业务逻辑与方案

整体策略：**让"可见反馈"先于"数据就绪"**。三层独立启动链路 + 一条进度事件流。

### 3.1 启动链路改造

**主进程**
1. 将 `hydrateProcessPath()` 从模块顶层**挪进 `app.whenReady()`**，并改为**非阻塞**执行（wrapper 保留同步导出给已写单测使用，但启动链路用 `hydrateProcessPathAsync()`）。
2. 引入 **PATH 缓存**：首次成功读到 login shell PATH 后写入 `app.getPath('userData')/shell-path.json`；之后每次启动**先用缓存**同步 hydrate（读 JSON 是 μs 级），然后后台异步刷新并覆盖缓存。冷启动第 2 次及以后几乎零延迟。
3. `createMainWindow` 改为：
   - 添加 `backgroundColor: '#0b0b0d'`（与 `--bg` token 相同）；
   - 改为 `show: true`（或保留 `show: false` 但**监听 `'did-start-loading'` 时 `show()`**），让用户立即看到品牌色窗口骨架；
   - `loadFile` / `loadURL` 不变。
4. Splash 进度事件：新增 IPC 频道 `splash:event`（主 → 渲），在主进程广播阶段状态 `{ stage: 'path-hydrate' | 'detect' , step, total, detail }`。

**预加载**
- 暴露 `morrowApi.onSplashEvent(cb)`，内部 `ipcRenderer.on`。

**渲染进程**
1. `index.html` 内联 CSS-only splash：在 `<body>` 里渲染 `morrow` wordmark + indeterminate progress（仅用 `@keyframes`），`#root` 之外独立 DOM；React 挂载后检测并淡出移除（可复用一个 data-attribute 钩子）。
2. `Splash.tsx` 改为消费 `splash:event` 流，把 indeterminate spinner 升级为**确定度进度条**（0/N → N/N），并在 detect 期间显示当前正在 check 的 runtime name。

### 3.2 受影响文件（全部为编辑，无新建文件）

| 文件 | 修改类型 | 影响函数/区域 |
|---|---|---|
| `src/app/main/index.ts` | 改 | 顶层 `hydrateProcessPath()` 调用挪进 `whenReady`；新增 splash 事件广播钩子 |
| `src/app/main/shell-path.ts` | 改 | 新增 `hydrateProcessPathAsync()`、`loadShellPathCache()`、`saveShellPathCache()`；`spawnSync` 改走 `execFile`（Promise 化） |
| `src/app/main/window.ts` | 改 | `backgroundColor` 设为品牌色；`show: true`（或在 `did-start-loading` 即 show） |
| `src/app/main/runtime-detect.ts` | 改 | `detectRuntimes()` 接受一个可选 `onProgress(step, total, detail)` 回调，在每个 probe 开始/结束时回调 |
| `src/app/main/ipc.ts` | 改 | `detectRuntimes` handler 接回 progress 回调，通过 `win.webContents.send('splash:event', ...)` 广播 |
| `src/shared/ipc.ts` | 改 | 新增 `SplashEvent` 类型 |
| `src/app/preload/index.ts`、`src/app/preload/index.d.ts` | 改 | 暴露 `onSplashEvent(cb)` |
| `src/app/renderer/index.html` | 改 | 内联 CSS-only boot splash（与 React splash 视觉同构，便于平滑过渡） |
| `src/app/renderer/src/screens/Splash.tsx` | 改 | 增加 `progress: { step, total, detail }` props；用进度条组件替代 indeterminate spinner |
| `src/app/renderer/src/App.tsx` | 改 | 订阅 `splash:event`；React 挂载后通过 DOM 操作（一次性）隐藏 `index.html` 内联的 boot splash，避免闪烁 |
| `src/app/renderer/src/index.css` | 改 | 新增进度条原语样式（用 DESIGN.md token，不硬编码） |
| `tests/unit/shell-path.test.ts` | 改/补 | 覆盖缓存读写、异步版本、缓存 miss fallback |
| `tests/unit/splash.test.tsx`（若存在，否则新增在现有目录） | 补 | 渲染不同 progress 状态 |
| `CHANGELOG.md` | 改 | `[Unreleased]` 记录 perf + UX |

### 3.3 数据流

```
launch
 ├─ main: whenReady fires (几乎零等待)
 │   ├─ createMainWindow(backgroundColor=#0b0b0d, show=true)
 │   │     → 用户**立即**看到深色窗口 + <index.html 内联 boot splash>（wordmark + indeterminate bar）
 │   ├─ hydrateProcessPathSyncFromCache()   // μs 级，第 2+ 次启动命中
 │   ├─ hydrateProcessPathAsync() (后台，不 await)
 │   │     └─ done → 写缓存 + emit 'splash:event' { stage: 'path-hydrate', done: true }
 │   ├─ registerIpc(win)
 │   └─ (renderer 请求) detectRuntimes(onProgress)
 │         ├─ emit { stage: 'detect', step: 0, total: 2, detail: 'claude' }
 │         ├─ probe claude → emit { step: 1, total: 2, detail: 'codex' }
 │         └─ probe codex → emit { step: 2, total: 2, done: true }
 └─ renderer:
     ├─ boot splash (HTML) 立即可见
     ├─ React mounts → Splash.tsx 接管（同样的视觉骨架 + 现在是 determinate bar）
     ├─ 订阅 splash:event, 驱动进度条从 0/2 → 2/2
     └─ detect 完成 → 切 home/install
```

### 3.4 边界与异常

- **PATH 缓存读失败 / JSON 损坏** → 直接忽略，走完整 hydrate。不向用户暴露错误。
- **login shell 超时** → 维持现有行为（`getShellPathFromLogin` 返回 `null`，走 fallback dirs）。异步版仍受 3s timeout 约束，不会无限等待。
- **renderer 先请求 detect 而 main 还没注册 ipc** → 目前 `registerIpc(win)` 已经在 `createMainWindow` 之后立即调用，保持此顺序即可；progress 事件如果早于 renderer 订阅，**最新一次事件需要缓存并在订阅时回放**（主进程内维护 `lastSplashEvent`，订阅时先 send 一次 snapshot）。
- **splash 闪烁**：boot splash 与 React splash 必须视觉同构（字号、wordmark 位置、背景色一致），避免 hand-off 时 layout shift。实现上让 React splash 一挂载就把 `<body data-splash="react">`，CSS 规则自动隐藏 `.boot-splash`。
- **多窗口（activate 新建）**：splash 只与主窗口关联；第二次 `createMainWindow` 的窗口不订阅 splash 事件，直接进 detect（复用缓存的 runtimes）。
- **E2E mock（`MORROW_E2E=1`）**：hydrate 已跳过，splash event 仍然发送但 detect 是 mock 快速返回，不影响测试时序。

### 3.5 视觉/交互契约

设计档位判定（参考 `docs/design/DESIGN.md § 9` 与 [ADR 0005]）：

| 变更 | 档位 | 处理 |
|---|---|---|
| `index.html` 内联 boot splash（wordmark + 进度条） | 🟢 已有 splash 局部修改 + 🟡 新过渡 | PR 放截图 + 录屏；token 严格复用 `--bg / --accent / --muted` |
| 确定度进度条原语 | 🟡 新原语（但极小） | 沿用 DESIGN.md 现有 tokens，不新增新 token；组件就地写在 Splash.tsx，**不新建 `components/Progress.tsx`**（遵循「能编辑不新建」） |
| 窗口从黑屏 → 背景色品牌色骨架 | 🟢 | 截图 PR |

不触发 🔴，**不需要先出视觉稿再开工**，但 Plan 里会包含「自检截图 + 录屏」任务。

---

## 4. 状态所有权与不变量（Pre-Coding Check）

- **所有权**：`splash:event` 的唯一 owner 是**主进程**（事件源 = hydrate + detect）；renderer 是只读订阅者。PATH 缓存的 owner 是 `shell-path.ts` 模块，持久化到 `userData/shell-path.json`。
- **生命周期**：hydrate async promise 的生命周期到"写完缓存"为止，无订阅依赖；进程退出时若未完成——丢弃结果无副作用。
- **并发**：第二次启动命中缓存时 `process.env.PATH` 会被同步写一次、异步写一次。用「只在值不同于缓存时写入」保证幂等，避免 R->W 竞争。
- **合规**：PATH 属于系统环境信息，不涉及用户凭证；缓存文件放在 `userData` 内，不需要加密。

---

## 5. 验收标准（Definition of Done）

**性能**（M2 Mac + production build 打包后，first run 与 subsequent run 分开测）：
- [ ] launch → 窗口首帧可见 < 300ms（subsequent），< 1s（first run）
- [ ] launch → splash determinate progress 出现 < 500ms（subsequent），< 1.2s（first run）
- [ ] subsequent launch 下 `hydrateProcessPath` 走缓存，主线程同步耗时 < 5ms
- [ ] detect 耗时不变（主进程现有实现已优化），但 UI 期间持续有进度反馈

**可见反馈**：
- [ ] 任何时刻屏幕非纯黑/纯白：窗口 backgroundColor 已就位
- [ ] boot splash → React splash 过渡无明显闪烁（录屏逐帧检查无 layout shift）
- [ ] progress bar 最终从 0/2 走到 2/2，正确切到 home/install

**质量**：
- [ ] `pnpm pre-commit` 通过（lint + typecheck + vitest related + contract + e2e subset）
- [ ] 新增 unit test 覆盖缓存读写、异步 hydrate、progress 事件序列化
- [ ] e2e spec 断言 boot splash wordmark 可见 + progress 出现
- [ ] CHANGELOG `[Unreleased]` 写明 perf + UX 两条

**回归**：
- [ ] 现有 `tests/unit/shell-path.test.ts` 同步 API 行为不变
- [ ] `gui-launch-path` SDD 的"GUI 启动下能探测到 CLI"场景仍成立（回归覆盖）
- [ ] 失败路径（shell 超时、detect 全 miss）仍正确落到 Install 页

---

## 6. 主要风险

1. **show 早的副作用**：某些 macOS 版本对 `show: true` 且 `loadFile` 未完成时可能出现"窗口存在但无内容"的中间态。缓解：先 `show()` 再 `loadFile`，配合 `backgroundColor`，即便中间态也只是深色空窗。
2. **PATH 缓存过期**：用户 `.zshrc` 改了之后缓存里仍是旧 PATH 可能导致 detect miss。缓解：每次启动都异步刷新，最坏 1 次启动不准，第二次就对；另外 Install 页已提供 "Re-check" 入口。
3. **IPC 事件丢失**：renderer 订阅晚于事件发出 → 用 `lastSplashEvent` 快照回放。
4. **设计 drift**：boot splash 用的是 HTML 内联 CSS，未经 React 渲染，容易和 token 实时脱节。缓解：CSS 变量在 `:root` 定义，HTML 内联样式直接引用 `var(--bg)` 等，不复制字面值。

---

## 7. 预期验证方式

- **单测**：`tests/unit/shell-path.test.ts` 新增缓存读写 / 异步 hydrate；`tests/unit/splash.test.tsx` 覆盖 progress 渲染分支。
- **契约测试**：`tests/contract/` 若已有 IPC schema 断言，扩展 `splash:event` shape。
- **e2e**：Playwright 模拟冷启动（清缓存），断言 wordmark + progress 在 1s 内出现。
- **手测**：录屏 3 种情境——1) 首次启动（冷缓存）、2) 二次启动（热缓存）、3) 两个 CLI 都缺失（走 Install）——逐帧观察。

---

## 8. 超出范围（非目标）

- **不**优化 `electron-builder` 打包体积或启动冷页问题（那是 `release-v0.1.0` 后续的独立话题）。
- **不**重构 Splash 外观（保持 wordmark + runtime list 的整体版面），只在局部加进度原语。
- **不**把 detect 结果做全局缓存（runtime 版本变化时正确性优先于速度）。
- **不**升级为 lint 强制 design token（仍归属 `design-tokens-enforcement`）。
