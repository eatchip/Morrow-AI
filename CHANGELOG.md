# Changelog

本文件记录 Morrow 仓库的所有**用户/贡献者可感知**变更。
格式遵循 [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)，版本号遵循 [SemVer](https://semver.org/)。

AI agent 与长期任务可把本文件视为**跨会话记忆**：记录已完成工作、已尝试失败的方案、已知限制。

---

## [Unreleased]

### Added
- 自动团队组建（Auto Team Compose）：在频道中 @Morrow 用自然语言描述期望角色，Morrow 通过 Codex 生成角色配置并展示内联确认卡片，用户确认后自动创建全局角色并加入当前频道。支持多轮逐个创建。

## [0.3.7] - 2026-06-29

### Fixed
- 隔离 Claude/Codex 子进程环境，避免从 Codex 等上层 agent shell 启动 `pnpm dev` 时继承父进程的 Anthropic/Codex token、base URL、sandbox 与 thread 控制变量，导致真实 runtime 使用错误账号或网络策略。

## [0.3.6] - 2026-06-29

### Changed
- 全量产品命名切换为 Morrow：应用名、包名、App ID、DMG 产物、preload bridge、E2E 开关、存储 key、默认角色 prompt、文档和 SDD 档案均改为 Morrow 命名。

### Added
- 新增 `pnpm brand-check`，用于阻止旧品牌拼写重新进入当前源码、文档、测试、脚本和 SDD 内容。

## [0.3.5] - 2026-05-26

### Performance
- 群聊频道长历史路径采用 FaMou 实验验证过的选择性 projection 策略，减少 `ChannelWorkspace`
  渲染时对 roles / runs / handoffs 的重复线性查找。

## [0.3.4] - 2026-05-26

### Added
- **SDD `runtime-performance-stability-harness`**：新增 `RuntimeRunSupervisor` 作为 Codex/Claude run 生命周期唯一 owner，统一处理 first-output / idle / hard deadline、取消、cleanup 与迟到事件忽略；preload/renderer 新增 `runtime:run-event` 与 `runtime:run-cancel` 契约。
- 新增聊天区运行状态面板：慢响应、超时或取消时提供取消、重试、重启 runtime 与折叠诊断入口，诊断信息不进入聊天正文。
- 新增 `pnpm perf:codex` / `pnpm perf:codex:real` 性能门禁脚本；真实模式比较 `codex exec --json` 基线与 Morrow Codex MCP friendly-lane 路径。

### Fixed
- 修复 renderer 自己判定“等待运行结果超时”的隐式 owner 问题；超时/取消现在由主进程 supervisor 结算并清理，旧 run 的 late chunk/done/error 不会复活 UI。
- 修复一个对话卡死时可能拖垮整体体验的问题：卡住的后台 run 会本地超时收口，新对话仍可继续发送并完成回复。

### Performance
- Codex 本机真实基线（2026-05-26）：`codex exec --json` 首正文 12358ms；Morrow MCP friendly-lane 首运行证据 261ms、首正文 7235ms、总耗时 7615ms，落在 parity budget 内。

## [0.3.3] - 2026-05-21

### Added
- 新增 `morrow-workspace-roadmap` 静态原型，用于梳理 Morrow 向 AI 同事工作空间演进的阶段性方向。

### Fixed
- 修复 macOS 26 上 E2E / dev 启动后偶发系统“Electron 意外退出”弹窗的问题：Electron 从 35.7.5 升级到 36.9.2，避开已停止支持版本缺失的 Tahoe AppKit/WindowServer 修复。

## [0.3.2] - 2026-05-21

### Added
- 群聊频道现在支持“解散群聊”：确认后会移除该群聊及其消息、交接记录和运行记录，AI 队友本身保留。

### Fixed
- 修复群聊频道侧栏条目在暗色主题下文字变黑的问题，避免按钮默认色覆盖频道名称。

## [0.3.1] - 2026-05-21

### Changed
- 更新 agent harness：用户明确授权合入/发布时，agent 必须自动完成 README/CHANGELOG、版本、验证、打包、合并 main、推送 GitHub、发布非 draft Release，并在最终回复给出一行可复制体验命令。

### Fixed
- 修复个人对话回复中的全局发送锁：一个会话正在回复时，可以切到/新建另一个会话并独立发送；同一会话仍需等当前回复完成后继续追问。
- 修复新对话未发送草稿切走后丢失的问题：草稿现在归属于对应 conversation，再次点回该对话会恢复输入框内容。
- 修复群聊频道长历史把底部输入框撑出可视区域的问题；消息区现在独立滚动，输入框保持可见并可继续发送。

## [0.3.0] - 2026-05-21

### Added
- **SDD `channel-role-chat-mvp`**：新增本地工作空间里的群聊频道与 AI 队友 MVP
  - 左侧信息架构收敛为「个人对话 / 群聊频道 / AI 队友」，保留单聊，同时支持新建群聊并绑定本地文件夹
  - 新增 AI 角色模型：角色包含显示名称、模型（Claude Code / Codex）、简介与可编辑的「指示」prompt；无频道时也可先创建角色
  - 新增频道消息模型、角色运行记录、角色上下文封装与受控 handoff proposal；renderer 只发 `channelId/roleId/projectId`，本地路径由 main 进程解析
  - 频道 Composer 仅在输入 `@` 时弹出当前频道成员选择器，不再常驻角色 chip；频道成员面板默认收起，可按需展开
  - 角色详情抽屉提供 Chat / Settings，Settings 可查看和修改简介、模型与指示
  - 测试覆盖：频道 Store / Orchestrator / IPC contract / mention menu / Sidebar DOM / Electron e2e 群聊主流程

### Fixed
- AI 队友支持删除：删除后会从 AI 队友列表和所有频道成员里移除，历史消息保留。
- 修复老版本/原型期 `channels.json` 中缺字段角色导致点击后界面空白的问题：加载时会补齐角色名、简介、指示和 runtime，并清理频道里的失效角色引用。
- 修复历史 `running` 角色运行在重启后继续显示“正在思考”的问题：加载时会把失去进程的旧运行标记为 failed。
- 修复角色 runtime 同步抛错或底层长期不返回 done/error 时一直 pending 的问题：运行会进入失败态，个人对话和群聊都能恢复输入。

## [0.2.1] - 2026-05-19

### Added
- **SDD `agent-provider-event-architecture`**：Codex/Claude 主对话统一回到结构化 provider event 模型
  - Chat timeline 只消费 `Conversation.messages + StreamEvent`，不再从 PTY/TUI bytes 解析 assistant 正文
  - 新增只读 `AgentTerminalLog` 作为诊断入口；旧 PTY transcript view 与 tool/status card 投影已移除
  - 回复中仍可在底部输入框编辑草稿，但发送被禁用，避免单一 stream owner 被后续消息覆盖
- **SDD `agent-ux-shield-acp`**：Codex PTY 链路外包一层 Morrow Agent 交互界面
  - Chat 默认显示 Morrow activity timeline，不再把 xterm/TUI 当作主对话界面；raw terminal 收进“查看终端日志”折叠面板作为 debug fallback
  - 新增 transcript adapter，把 PTY bytes 清理并投影为 assistant 文本、命令执行卡片、状态卡片和终端输出卡片；事件 shape 按 ACP-compatible 边界设计，后续可替换为真实 ACP transport
  - Codex approval/permission prompt 改为 Composer 上方的确认条，提供“允许本次 / 拒绝”，点击后向 PTY 写入 Enter / Escape；审批提示不再污染会话记录
  - `TerminalPane` 增加只读模式，禁用 stdin 并退出键盘焦点路径，确保下方 Composer 是主要输入入口
- **SDD `agent-terminal-parity`**：Codex 主链路切换为真实 PTY 终端体验
  - 主进程新增 `ptyHost` utility process，通过 `node-pty` 启动 interactive `codex [PROMPT]`；renderer 使用 xterm.js 渲染终端字节流，后续追问写入同一个 PTY session
  - 新增 `pty:*` IPC：start / write / resize / kill / snapshot / data / exit；主进程继续只接受 `projectId` 并解析 cwd，renderer 不直接传本地路径
  - `node-pty` native addon 限定在 host process 内加载；main 只做 supervisor，降低 native 崩溃影响面
  - 新增 `scripts/prepare-node-pty.mjs`，安装后自动修复 macOS `spawn-helper` 可执行位，避免真实 PTY 创建时报 `posix_spawnp failed`

### Fixed
- 修复长回复底部内容被 Composer 固定遮罩压暗的问题：聊天区底部留白与输入区高度对齐，
  回复结算时也触发滚动，项目标签使用实底色避免透出背后文本。
- 结构性修复 Codex TUI 噪声进入主对话的问题：`Update available`、`Starting MCP servers`、
  `no-project-cwd`、`q q`、placeholder prompt 和用户输入回显不再有进入 assistant 气泡的路径；
  Codex exec fallback 也忽略非 JSON stdout，避免诊断文本变成聊天内容。
- 修复 Codex PTY TUI 原始屏幕内容污染主对话的问题：update banner、cwd/status bar、
  queued message 提示、用户输入回显和未知 terminal 输出不再进入主 timeline，只保留在
  “查看终端日志”里；多轮 PTY 会话按 prompt echo 切成 turn，避免把后续用户消息统一堆到
  Agent 回复前面。
- 修复 worktree / dev 环境下 `node-pty` 的 macOS `spawn-helper` 失去可执行权限后报
  `posix_spawnp failed` 的问题：`pnpm dev` / `pnpm build` / `pnpm dist*` 前自动修复权限，PTY host
  运行时也会兜底修复；即使进入兼容 fallback，也不再把 `[terminal unavailable] ...`
  原始技术错误插入会话正文。
- Codex MCP fallback 兼容 codex-cli 0.130 的 `agent_message_content_delta`，并从 `structuredContent.content` / `content[].text` 兜底补输出；`isError: true` 不再被误判为成功空输出。
- Codex 的 model / reasoning effort 现在同时透传到 PTY 启动命令和 MCP fallback，避免 UI 选择与实际运行配置不一致。

### Performance
- Codex 主输出回到常驻 MCP / JSON event provider，继续复用 `liveTextStore` 的低重渲染流式路径；
  PTY parity 方案保留为诊断能力，不再作为正文速度优化手段。

### Changed
- Codex 的默认主链路从 PTY transcript projection 改为 Codex MCP / JSON event provider；
  PTY API 保留为诊断和显式终端能力，不再驱动主聊天记录。
- README macOS 安装说明覆盖两条小白路径：一行自动下载安装打开；Release 手动下载后遇到 Gatekeeper 拦截时一行临时放行并打开。

## [0.2.0] - 2026-05-13

### Performance
- **SDD `streaming-and-latency`**：恢复 Codex 逐 token 流式 + 首字节/长回复延迟大幅下降
  - 根因：`codex-cli 0.128+` 之后 `exec --json` 不再输出 `agent_message_delta`，整条消息一次性到达；渲染层只能看到 `done`，无中间帧。叠加每轮冷启 `spawn codex exec` + 渲染层对 `conversations` 深拷贝 → O(N²) 体感卡顿
  - 解决思路：主进程切换到 codex **MCP 协议**（LSP-style JSON-RPC over NDJSON），以 `codex mcp-server` 常驻子进程 + `tools/call codex` / `codex-reply` 多轮，按 `cwd` 做进程池，按 `cwd|conversationId` 缓存 `threadId`；MCP 仍通过 `codex/event` 通知流出 token-level `agent_message_delta`
  - 渲染层：新增 `liveTextStore`（`useSyncExternalStore` + rAF 合批），chunk 只写 store 不触发 `setConversations`，`done`/`error` 才一次性结算；`StreamingMessage` 独立订阅当前 `sessionId`，其他气泡 `React.memo`，流式中只有它重渲染；自动滚动改 rAF 合并
  - 兼容：MCP 工具缺失 / CLI 版本不支持时自动 fallback 到 `exec` 路径并 emit 一条提示 chunk；`parseCodexLine` 保留作 fallback，标注 fallback-only
  - 涉及文件：`src/app/main/codex-mcp.ts`（新）、`src/app/main/runtime-session.ts`、`src/app/main/ipc.ts`、`src/shared/ipc.ts`（`SendPromptArgs.conversationId`）、`src/app/renderer/src/lib/live-text-store.ts`（新）、`src/app/renderer/src/screens/Chat.tsx`、`src/app/renderer/src/App.tsx`
  - 测试：`tests/integration/codex-mcp.spec.ts`（握手 + deltas / tools 缺失 / 子进程崩溃）、`tests/unit/live-text-store.spec.ts`（rAF 合批、consume 清空、sessionId 隔离）、`tests/unit/chat-streaming-message.spec.tsx`（chunk 不影响静态气泡节点身份）

### Added
- **SDD `agent-model-picker`**：Composer 新增模型 / 智能档位选择器
  - codex：可切换 `gpt-5.5` / `gpt-5.4` / `gpt-5.4-mini` / `gpt-5.3-codex` / `gpt-5.3-codex-spark` / `gpt-5.2` 模型 + `minimal|low|medium|high|xhigh` 智能档位（对齐 codex-cli v0.130 ChatGPT 账号 TUI，非 API key 模式）；claude：可切换 `sonnet` / `opus` / `haiku`
  - 偏好持久化于 `localStorage['morrow:agent-prefs:v1']`，非法值静默回退默认
  - IPC 契约扩展：`SendPromptArgs` 新增 `model?` / `effort?`；主进程按 `MODEL_ID_REGEX` + `EFFORT_LEVELS` 白名单校验，违反即 `error` 事件并拒绝 spawn；`buildCmd` 按独立 argv 元素注入 CLI flag（无 `shell: true`，不可命令注入）
  - 默认：codex `gpt-5.5` + `medium`；claude `sonnet`；老会话未传字段时零回退
- **SDD `e2e-background-window`**：自动化测试不再打断当前窗口
  - `MORROW_E2E=1` 模式下主窗口不再调用 `win.show()`，macOS 额外用 `app.setActivationPolicy('accessory')` + `app.dock.hide()`，跑 `pnpm test:e2e` 时不抢焦点、不进 Dock / ⌘+Tab；Playwright 仍通过 CDP 驱动 renderer
  - 真实用户启动路径完全不受影响（`!e2e` 分支保持原 `show()` 行为）
- **SDD `conversation-lifecycle-cleanup`**：侧边栏对话生命周期收敛
  - 「新建对话」未发送任何消息就切走（点别的会话 / 又点新建 / 进入既有会话）时，自动从侧边栏移除该空对话；已发送过 user 消息的会话永不被自动回收
  - 侧边栏每条对话支持手动 × 删除；删除当前 active 会话时返回首页；删除 streaming 中的会话同步清空内部 streaming 引用，避免悬挂回调
- **SDD `project-scoped-chat`**：对话可绑定本地项目文件夹；CLI 子进程以该文件夹作为 `cwd` 启动
  - Sidebar 改为分组结构：「项目」区（可折叠、按 `lastUsedAt desc`）+「对话」区（未归属项目的会话）；Composer 上方新增 ProjectPicker（选中 / 搜索 / 退出 / 添加新项目）
  - 已发送过首条消息的会话 `projectId` 定版、picker 进入只读「退出项目」态；未发送时可自由切换
  - 持久化：`<userData>/projects.json`（schema v1，原子写 tmp→rename，损坏备份为 `.bak-<ts>`）
  - 路径安全：渲染层只传 `projectId`，主进程通过 `ProjectsStore.getAccessiblePath` 先 `fs.access` 再传 `cwd`，不可用时发出 `error` 事件并不起进程
  - 新增 IPC：`projects:list` / `projects:add`（弹系统目录选择框）/ `projects:remove`（仅从列表移除，不删文件夹）
  - 非目标：暂无跨设备同步、项目内文件扫描、CLI 参数二次配置

### Fixed
- **SDD `no-project-cwd-isolation`**：未选项目时不再继承 Electron 主进程 cwd（隐私 + UX 双重修复）
  - 主进程：`StartSessionArgs.cwd` 升级为必填 `string`，`spawn` 永远显式传入 cwd；`ipc.ts` 在 `projectId === null` 时注入 `<userData>/no-project-cwd/` 中性沙盒目录（首次启动 `mkdirSync recursive`），子进程不再读到 Morrow dev 仓库自身的 `AGENTS.md`、不再泄露开发者文件结构
  - 渲染层：ProjectPicker 在 `locked && activeProjectId === null` 时静态化 —— 触发器文案改为 "本对话未关联项目"、`aria-disabled=true`、点击 no-op、不再展开任何 panel；消除"显示一个点了没反应的'退出项目'按钮"的死交互
  - 测试：contract `runtime-session-cwd.spec.ts` 替换旧 "未传 cwd" 用例为 "无项目隔离目录"；unit `project-picker.spec.tsx` 新增 locked&&!active 静态化断言
- **SDD `codex-json-schema`**：恢复 Codex 对话输出（UI 此前持续显示 `(no output)`）
  - 根因：`codex-cli 0.128+` 变更 `exec --json` 事件 schema，从 `{"msg":{"type":"agent_message_delta",...}}` 改为顶层 `{"type":"item.completed","item":{"type":"agent_message","text":"..."}}`；`parseCodexLine` 仅识别旧 schema，所有新事件走 `return null`，渲染层只收到 `done`，无 `chunk`
  - 修复：`parseCodexLine` 同时识别新旧两种 schema 的并集，覆盖 `item.completed` 的 `agent_message` / `error` 子类型、`thread.started` / `turn.started` / `turn.completed` 生命周期静默、以及顶层 `type:"error"` 兜底；旧 `msg.type` 分支保留作向后兼容
  - 已知限制：新版 CLI 不再产出 `agent_message_delta`，整条消息一次性到达；Morrow 渲染层依然按整块拼接，首字节延迟等于总延迟。真流式体验依赖上游协议，本次不涉及
  - 测试：`tests/contract/runtime-parse.spec.ts` 新增 4 条用例覆盖新 schema 三条路径 + 顶层 error

### Changed
- `AGENTS.md §5 Commit 工具链`：并发写保护硬规则升级 —— 同一 workspace 有多个并发 AI 会话时，**必须**使用 `git worktree add` 给每个会话独立工作区；`git checkout -b` 仅在单会话/串行场景可用。起因是多个并发会话在主目录执行 `checkout -b` 会共享唯一的 HEAD / index / working tree，互相覆盖未提交文件

## [0.1.1] - 2026-05-12

### Fixed
- **SDD `gui-launch-path`**：修复从 Finder 双击 `.app` 启动时无法识别本机已装的 `claude` / `codex`
  - 根因：macOS launchd 给 GUI app 的 `PATH` 只有 `/usr/bin:/bin:/usr/sbin:/sbin`，用户 CLI 常在 `/opt/homebrew/bin` / `/usr/local/bin` / `~/.local/bin` 等 shell rc 添加的路径，GUI 继承不到
  - 主进程入口早期调用 `hydrateProcessPath()`：spawn `$SHELL -ilc 'echo $PATH'`（3s 超时）把登录 shell 的 PATH 接回来，并叠加 `/opt/homebrew/bin` 等 fallback 常量；从 terminal 启动（`TERM_PROGRAM` 存在）跳过；非 darwin 跳过
  - `detectRuntimes()` / `runtime-session` spawn 都受益，无需改契约
  - 单测 `tests/contract/shell-path.spec.ts` 覆盖 `mergePaths` 保序去重与 `hydrateProcessPath` 幂等 / 跳过分支

## [0.1.0] - 2026-05-12

首个公开 MVP 发布。macOS dmg（arm64 + x64），unsigned。

### Added
- **SDD `release-v0.1.0`**：公开发布基建
  - `electron-builder.yml`：macOS dmg 打包配置（arm64 + x64，unsigned，`asarUnpack: out/**/*`）
  - `package.json`：`version 0.1.0` / `license MIT` / `description` / `author` / `homepage` / `repository` / `dist` 与 `dist:mac` 脚本
  - `LICENSE`（MIT）
  - `resources/icon.png`（512×512 占位图，灰底白 D）
  - `.github/workflows/release.yml`：tag `v*` 触发，macos-latest 上打 dmg 并 draft Release
  - `README.md` 重写为面向终端用户的 What / Install / Requirements / Usage / Status / Development / License
- **SDD `frameless-chrome`**：消除 chrome 套娃 · 单层窗口
  - 主窗口 `BrowserWindow` 改为 `titleBarStyle: 'hiddenInset'`（macOS）+ `titleBarOverlay`（Win/Linux），系统红绿灯只渲染一组；顶栏高度保持 44px
  - Renderer 删除原型残留的伪红绿灯（`.traffic .dot*`）与重复的 `morrow` 标题；`.top` 整体 `-webkit-app-region: drag`，按钮 / pill / back-btn 显式 `no-drag`
  - 修复 `.window` 被 HTML 原型写死为 1100×720 圆角卡片的问题（全屏留黑根因）；改为 `width: 100%; height: 100vh`，清掉装饰阴影、body padding、背景渐变
- **SDD `mvp-ux-fixes`**：修复 MVP 试用后用户报告的 4 个阻塞可用性交互问题
  - Composer 键盘契约对齐行业默认：`Enter` 发送 / `Shift+Enter` 换行；`⌘/Ctrl+Enter` 保留为冗余发送；IME 合成期间（`isComposing || keyCode === 229`）一律不误发
  - Chat 页顶部新增可见的 `← 首页` 返回按钮（原先仅有 Esc 快捷键）；返回语义改为只切视图，后台流式继续（允许用户并行多会话）
  - Home/Chat 两屏新增 260px 左侧会话栏（`Sidebar.tsx`）：`+ 新建对话`、会话列表（首条用户消息派生标题，相对时间 `刚刚 / N 分钟前 / HH:mm / 昨天 / MM-DD`）、active 高亮、空态
  - `App.tsx` 状态模型从单会话 `messages: Msg[]` 重构为多会话 `conversations: Conversation[] + activeId`；`useStream` 事件按 `sessionId` 精准分发，跨会话流式并发由主进程已有 `runtime-session` 多 `sessionId` 支持
  - `.stream` 与 `.composer-wrap` 之间加视觉分割线；streaming hint 文案 `● streaming · Esc 中止`
  - `tests/e2e/mvp-smoke.spec.ts` 扩展断言：Sidebar 可见、Enter 键直接发送、会话标题派生、`← 首页` 按钮、新建对话
  - `tests/unit/sidebar-time.spec.ts` 覆盖 5 档相对时间文案
- **SDD `agent-runtime-mvp` 全量产物**：从 HTML 原型升级为可运行 Electron MVP
  - `src/shared/ipc.ts`：main/preload/renderer 共用 IPC 契约（`RuntimeId / DetectResult / StreamEvent / MorrowApi / IPC_CHANNELS`）
  - `src/app/preload/index.ts`：通过 `contextBridge.exposeInMainWorld('morrowApi', ...)` 暴露 4 方法桥（`detectRuntimes / sendPrompt / abortSession / onStream`），`MORROW_E2E=1` 下切换为内存态 mock
  - `src/app/main/runtime-detect.ts`：`execFile --version` + 3s 超时探测本机 `claude` / `codex`，失败安全 fallback 到 `installed:false`
  - `src/app/main/runtime-session.ts`：CLI spawn + stream + abort（`parseClaudeLine` / `parseCodexLine` 两个纯函数；SIGTERM → 2s → SIGKILL 兜底；env 剔除 `ELECTRON_RUN_AS_NODE`）
  - `src/app/main/ipc.ts`：注册 3 个 IPC handler + 入参形状校验；`app.before-quit` 触发 `killAll`
  - Renderer：`screens/` 四屏（Splash / Install / Home / Chat）+ `components/` 两件（Composer / RuntimeBadge）+ `lib/stream.ts` 的 `useStream` hook；`App.tsx` 主状态机
  - 设计 tokens 与四屏样式从 `morrow-mvp.html` 原型搬入 `src/app/renderer/src/{index,screens}.css`
  - 契约测试：`tests/contract/{preload-api-shape,runtime-detect,runtime-parse}.spec.ts` 覆盖 18 条断言
  - E2E 烟测：`tests/e2e/mvp-smoke.spec.ts` 走通 splash → home → chat，通过 `--morrow-e2e` argv 开关在 preload 层注入内存态 mock

### Changed
- `electron.vite.config.ts`：preload 产物改为 CJS（`index.js`），sandboxed preload 要求 CommonJS
- `src/app/main/window.ts`：`webPreferences.additionalArguments` 支持 `--morrow-e2e` 透传（sandboxed preload 无法读 `process.env`）
- 删除 `tests/e2e/scaffold-smoke.spec.ts`，由 `mvp-smoke.spec.ts` 取代

### Added
- Harness bootstrap：`AGENTS.md` / `DEVELOPMENT.md` / `CONTRIBUTING.md` / `CHANGELOG.md`
- 决策记录体系：`docs/decisions/` 含 README、模板与首批 3 条 ADR
- Playbook 体系：`docs/playbooks/` 覆盖 new-feature / bug-fix / refactor / research-method / spec-review
- GitHub 协作模板：PR 模板、Bug / Feature Issue 模板
- 基础卫生文件：`.editorconfig` / `.gitattributes` / `.gitignore`
- 兼容壳 `CLAUDE.md`（指向 `AGENTS.md`）
- 占位目录：`docs/architecture/`、`.comate/specs/`
- **ADR 0004**：技术栈正式选型（Electron + React + TS + electron-vite + pnpm + Vitest + Playwright + electron-builder + oxlint + prettier + husky + lint-staged）
- **`docs/architecture/ARCHITECTURE.md`**：DDD + Clean + Electron 三进程边界 + host process 故障隔离规则
- **`docs/development/DEBUGGING.md`**：失败首轮动作 / 测试层级选择 / E2E 稳定运行 / 状态污染排查 / 视觉调试原则
- `DEVELOPMENT.md § 测试分层与 E2E 策略`、`§ Electron 安全与 IPC 契约` 两个新章节
- **ADR 0005**：设计审美北极星（Linear 为骨架 / Arc 为血肉；每 6 个月复审机制）
- **`docs/design/DESIGN.md`**：设计系统 source of truth —— Philosophy / Anti-Patterns / Tokens 规约 / Motion Contract / Component Primitives / State Coverage / Density & Rhythm / 可验收标准总表 / 视觉稿前置闸门触发表
- **`docs/playbooks/design-review.md`**：视觉稿前置闸门（Phase 0）+ solo 合入前物理自检五步（Phase 1）
- **SDD `tech-stack-scaffold` 全量产物**：
  - `package.json` / `.npmrc` / `pnpm-lock.yaml`：锁定 Node ≥22.12 / pnpm 9.6，含 31 个脚本与 security overrides
  - `tsconfig.json` / `tsconfig.node.json` / `tsconfig.web.json`：三进程 tsconfig 联邦
  - `.oxlintrc.json` / `.prettierrc` / `.prettierignore` / `.secretlintrc.json`：质量基线
  - Electron 三进程骨架：`src/app/main/` / `src/app/preload/` / `src/app/renderer/`
  - `electron.vite.config.ts`：三端装配 + 产物到 `out/`
  - `vitest.config.ts` + `tests/unit/` + `tests/contract/` + `tests/setup/`：单元/契约冒烟绿
  - `playwright.config.ts` + `tests/e2e/scaffold-smoke.spec.ts` + `scripts/test-e2e-with-window-fallback.mjs`：E2E 冒烟绿
  - 6 个 pre-commit 闸门脚本 + `.husky/pre-commit`：`pnpm pre-commit` 8 步全绿
- **SDD `design-review-html-first`**：视觉评审载体规则调整
  - `scripts/serve-prototype.mjs` + `pnpm prototype:serve {feature}`：本地静态 server，默认 5178，内置路径穿越防护
  - `.comate/specs/design-review-html-first/prototype/v1/` 作为首个自证原型（Tailwind CDN + React 18 + Babel standalone，零 build）
  - 规范 HTML 原型产出规约：`.comate/specs/{feature}/prototype/v{n}/` 版本化目录 + `latest` 软链 + `latest.txt` 跨平台兜底

### Changed
- `README.md` 重写为纯导航入口
- **`DEVELOPMENT.md § Setup / § 项目结构 / § Pre-commit 闸门`** 从 TBD 回填为具体命令与规则
- **`AGENTS.md § 7 Setup & Commands`** 从 TBD 升级到具体命令清单 + ADR 0004 链接
- **`CONTRIBUTING.md § Getting started`** 补齐 Prerequisites / Setup / Verification
- **`AGENTS.md`** 新增 § 1.8 设计契约硬规则；§ 4 Workflow 增加"视觉稿前置闸门"段落；§ 7 增加"设计契约"指引段
- **`docs/playbooks/new-feature.md`** Step 2 Spec checklist 增加"视觉与交互设计"条目；Step 6 引用 design-review.md
- **`docs/playbooks/spec-review.md`** B/D/E 节增加视觉评审项（benchmark 对齐 / 四态完整性 / 触发档位 / 视觉确认状态 / token 使用声明）
- **`.github/pull_request_template.md`** 将 Screenshots 段扩展为 Visual Review（触发档位 / 视觉稿链接 / 四态 / North Star 并排 / 自检五步）
- **SDD `design-review-html-first`** 调整视觉稿载体规则：
  - `docs/design/DESIGN.md §9` 载体优先级改为 "HTML 可交互原型 / Figma 文件" 并列首选；移除 "从 Figma 降级需在 Spec 留痕" 要求
  - `docs/playbooks/design-review.md Phase 0 Step 0.1` 同步调整；新增 "AI 产出 HTML 原型规约" 子节（路径 / 版本化 / 技术栈 / 运行方式 / 每轮流程）
  - `Step 0.4` 用户确认记录改为 "已确认 · v{n}" 形式，Spec 引用版本号

### Notes
- 项目处于 **Scaffold Landed** 阶段；`pnpm install / dev / build / test / test:e2e / pre-commit` 均可真实执行
- 延后 SDD 清单（均不阻塞当前可用性）：
  - `design-tokens-enforcement`：硬编码色值/字号/间距的 lint 强制（目前由 code review 把关）
  - `naming-rules`：`scripts/check-naming-staged.mjs` 当前为占位 `exit 0`，待命名规范 ADR 落地后补齐
  - E2E 窗口降级链（offscreen → hidden → inactive）：当前仅 offscreen 一档
  - `figma-mcp-integration`：Figma MCP 正式接入（目前 HTML 原型已足够，Figma 作为未来可选载体并列存在）
- 已完成 SDD：`tech-stack-scaffold` —— 详见 `.comate/specs/tech-stack-scaffold/summary.md`
- 已完成 SDD：`design-review-html-first` —— 详见 `.comate/specs/design-review-html-first/summary.md`
- 在 `design-tokens-enforcement` 落地前，AGENTS.md §1.8 Design token 硬规则仍由 code review 把关
