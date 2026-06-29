# streaming-and-latency — Spec

> 目标：让 Morrow 的 Codex 路径达到"和终端 codex / codex 桌面客户端一样"的体感：**字符级流式 + 暖进程 + 会话复用**。Claude 路径在此次顺手做渲染层优化（已经天然支持流式）。

---

## 1. 用户报告与诊断

用户原话：
> 1) 回复消息没有流式输出，而是一段话一段话的；
> 2) 整体就是慢，比不上终端 codex，也比不上 codex 桌面客户端。

经现场实测 + 阅码（`codex-cli 0.128.0`）确认根因：

### 1.1 流式消失：`codex exec --json` 的 schema 已不发字符级 delta

- 现状代码：`src/app/main/runtime-session.ts:54` 用 `codex exec --json --skip-git-repo-check -`。
- 实测输出（一次完整对话）：
  ```
  {"type":"thread.started", ...}
  {"type":"turn.started"}
  {"type":"item.completed","item":{"type":"agent_message","text":"<整段>"}}
  {"type":"turn.completed", ...}
  ```
  整段文本一次性到达。当模型把回答拆成多个 `item`（reasoning summary + final answer），就表现为"一段、一段"。
- `parseCodexLine` 的 `agent_message_delta` 分支（旧版兼容）在 0.128 永远命中不到。
- **结论**：只要继续用 `codex exec`，就拿不到字符级流式。这是 CLI 协议层的事实。

### 1.2 整体慢：每次冷启 + 不复用会话 + 渲染层放大

| 贡献因素 | 量级（实测/估算） | 现状代码 |
|---|---|---|
| 每次发送都 `spawn` 一次 `codex` 二进制（Rust 启动 + auth + git 扫） | ~1.5–3 s | `runtime-session.ts:177` |
| `exec` 模式无 thread 复用，模型侧每次重做系统 prompt 与上下文 | 首 token 多等 0.5–2 s | 同上 |
| `chunk` 来一次就深拷贝整棵 conversations 状态树 | 长回复时主线程明显卡顿 | `App.tsx:80-98` |
| `useStream` 的 listener 每次回调都跑全量 `setConversations` | 同上放大 | `lib/stream.ts:8-19` + `App.tsx:73-99` |

终端 `codex`（TUI）和 codex 桌面客户端的体验来自 **常驻 `app-server` 进程 + thread 复用 + 字符流**——这正是我们要补的能力面。

---

## 2. 业界最佳实践（已研究）

- **codex-cli 自带 `mcp-server` 子命令**（`codex mcp-server`），实测发以下事件流：
  - `item_started`（AgentMessage）
  - `agent_message_delta` / `agent_message_content_delta`（**token 级 delta**，与终端 TUI 一致）
  - `item_completed` / `turn.completed`
- **会话复用**：`tools/list` 暴露 `codex` + `codex-reply` 两个工具；前者建 thread，返回 `threadId`，后者带 `threadId` 续写。一次 spawn 可跑多轮。
- **MCP 是 codex-cli 对外的 stable surface**（与 `app-server` 的 experimental 标记不同）。VSCode 扩展、Cursor 等同类客户端走的都是 MCP 路径。
- 可行性已现场验证（worktree 里跑通 token-level streaming，证据见 commit 信息附录）。

Claude 那一侧不动协议：`claude -p ... --include-partial-messages` 已是字符级流，问题只在渲染层放大效应；同步修。

---

## 3. 方案

### 3.1 主进程：把 codex 路径切到 MCP

**新增模块** `src/app/main/codex-mcp.ts`：

- 进程模型：**每个 `cwd`（项目）对应一个常驻的 `codex mcp-server` 子进程**；首次发送时懒启动，闲置 5 分钟后自动回收。多 session 复用同一进程，多项目并存。
- IO：stdin/stdout 走 LSP 风格 JSON-RPC（行分隔 JSON，`Content-Length` 不必要——MCP stdio 用 NDJSON）。一个轻量行解析器，**复用现有 `createInterface`**。
- 协议封装：
  - `initialize` + `notifications/initialized`（一次）
  - `tools/call name=codex`（首轮，带 `prompt`、`cwd`、`sandbox: read-only`）→ 拿 `threadId`
  - `tools/call name=codex-reply`（续轮，带 `threadId`、`prompt`）
  - 监听 `codex/event` 通知，按 `_meta.requestId` 路由到对应 `sessionId`。
- 事件→`StreamEvent` 映射：
  - `agent_message_delta.delta` → `{kind:'chunk', text}`
  - `error` / 顶层 JSON-RPC error → `{kind:'error'}`
  - `turn.completed`（且当前 request 已结算）→ `{kind:'done'}`
  - 其他类型（`item_started`、reasoning、tool 调用）此版本静默；后续按需开放。
- 中止：发送 `notifications/cancel`（MCP 标准），同时本地解绑该 sessionId 的 listener。
- 鲁棒性：子进程崩溃 → 标记进程为 dead，下一次发送自动重启；当前在飞 session 收到 `error` 事件。

**改动 `runtime-session.ts`**：
- `runtime === 'codex'` 路径委托给 `codex-mcp.ts` 的 `startCodexSession`；删除 `parseCodexLine` 旧逻辑（删干净，不留兼容垫片，§ 1 Golden Rule 6）。
- `runtime === 'claude'` 路径不动。
- `killAll` 改为 `closeAll`：终止所有项目对应的 mcp-server 子进程。

**`ipc.ts` / `shared/ipc.ts` 不变**：IPC 边界保持 `SendPromptArgs`/`StreamEvent` 现状。这是个内部重构，不影响契约。

### 3.2 渲染层：流式无损放大优化

- **拆分组件**：把"流式中的 AI 消息体"独立为 `StreamingMessage`，订阅 `streamingRef.current.aiId` 对应的局部文本（用一个轻 store / `useSyncExternalStore`）。其他消息走 `React.memo`。
- **rAF coalesce**：`useStream` 把同一 `sessionId` 的 chunk 在 requestAnimationFrame 内合并，单帧只触发一次 setState。
- **状态分层**：
  - `conversations`（持久 + 历史） — 仍在 `App.tsx`，但 chunk 阶段**只更新 streaming 消息引用，不深拷贝整棵列表**。最终 `done` / `error` 时再做一次结算式 commit。
  - `liveText` map（`sessionId → string`） — 由独立 store 管理，订阅者只有 `StreamingMessage`。
- 自动滚动：`scrollTop = scrollHeight` 移到 rAF 内、用户上滑时禁用（避免长回复打断阅读）。

### 3.3 受影响文件清单

| 路径 | 类型 | 关键变更 |
|---|---|---|
| `src/app/main/codex-mcp.ts` | 新增 | MCP 客户端 + 进程池 |
| `src/app/main/runtime-session.ts` | 改 | codex 路径委托 MCP；删 `parseCodexLine`、旧 schema 测试同步删 |
| `src/app/main/ipc.ts` | 改（小） | `cleanup` 改用 MCP 池 close |
| `src/app/renderer/src/lib/stream.ts` | 改 | 增加 rAF coalesce；保留兼容 hook 出口 |
| `src/app/renderer/src/lib/live-text-store.ts` | 新增 | sessionId → 流式文本，`useSyncExternalStore` 订阅 |
| `src/app/renderer/src/screens/Chat.tsx` | 改 | 流式 AI 消息独立组件 |
| `src/app/renderer/src/App.tsx` | 改 | `useStream` 改为只在 `done`/`error` 写 conversations，chunk 走 store |
| `tests/unit/runtime-session.test.ts`（如存在） | 改 | 删旧 codex parser 用例，新增 MCP 客户端单测 |
| `tests/integration/codex-mcp.spec.ts` | 新增 | mock 子进程 stdio，验证事件 → StreamEvent 映射、cancel、崩溃恢复 |
| `CHANGELOG.md` | 改 | `[Unreleased]` 增 perf 项 |

`docs/decisions/` 不新增 ADR：MCP 走的是已选技术栈内部决策，不属于 ADR 触发条件（与 ADR 0004 一致）。如需，由用户单独要求。

### 3.4 边界与不变量

**不变量**：
1. **Streaming 单一所有权**：渲染层任意时刻只有一个 streaming session 写入 `liveText`；done/error 后该 entry 必须被清掉。
2. **MCP 进程与 cwd 一一对应**：同一 cwd 不重复 spawn；不同 cwd 互不污染（防止跨项目串 thread）。
3. **`StreamEvent` 契约不变**：renderer 看到的事件序列形态与现在等价（chunk* → done | error），便于回归测试不重写。

**边界**：
- 输入校验（IPC sendPrompt）原样保留在 `ipc.ts`。
- MCP 子进程 stdout 单行 > 1MB 直接丢弃（沿用现有 MAX_LINE_BYTES，搬到 mcp 客户端）。
- stderr 仅取尾 10KB 用作错误诊断。
- 跨平台：`spawn('codex', ...)` 在 Windows 下是 `codex.cmd`，沿用现有 `runtime-detect` 已解决；新文件不引入新 PATH 假设。

### 3.5 风险与回滚

- **协议变化风险**：MCP 工具 schema 由 codex-cli 维护。锁版本验证：在启动后第一次 `tools/list` 校验存在 `codex` + `codex-reply`，不存在则 fallback 到旧 `codex exec --json` 路径并 emit error chunk 提示用户升级 codex。**不删除 `parseCodexLine` 的兜底**——这是有据的兼容，不算坟墓。
- **进程泄漏**：`app.on('before-quit')` + `BrowserWindow` 销毁时调用 `closeAll`；闲置 GC 用单 `setInterval(60s)`。
- **回滚**：单 commit 内可整体 revert（不写 schema 迁移）。

---

## 4. 验收标准

1. **流式可见**：从用户按下 Enter 到第一个字符出现 ≤ 1.5 s（暖路径）/ ≤ 4 s（冷路径，首次发到该 cwd），逐 token 增长。
2. **续轮加速**：同一 conversation 第二轮起，首字节 ≤ 1 s。
3. **长回复不卡**：5KB 回复期间 DevTools Performance 主线程 long task < 50ms / 帧。
4. **中止可用**：流式中按 Esc 或切走，子进程不留挂起、UI 立即响应。
5. **多项目并存**：在两个项目间切换发送，互不串线。
6. **回归**：现有 e2e（`tests/e2e`）全过；Claude 路径未受影响。

验证手段：单测（mock stdio）+ 集成测试（真启 `codex mcp-server`，跳过条件：CI 无 codex 时）+ 手动 e2e checklist。

---

## 5. 数据流（Codex 路径，新版）

```
Renderer (App.tsx send)
   └─▶ ipcRenderer 'send-prompt' { runtime:'codex', prompt, sessionId, projectId }
           └─▶ Main ipc.ts (validate + 解析 cwd)
                   └─▶ codex-mcp.startCodexSession({ cwd, sessionId, prompt })
                           ├─ ensureProcess(cwd)  (lazy spawn + initialize)
                           ├─ tools/call codex 或 codex-reply (with threadId)
                           └─ on codex/event:
                                ├ agent_message_delta → emit {kind:'chunk', text}
                                ├ error               → emit {kind:'error', message}
                                └ turn.completed      → emit {kind:'done'}
                                       │
                                       ▼
                       Main ipc.ts → win.webContents.send('stream', event)
                                       │
                                       ▼
                   Renderer useStream → rAF coalesce → liveTextStore.append
                                       │
                                       ▼
              StreamingMessage useSyncExternalStore → 只重渲一段文字
```

---

## 6. 不做的事（边界声明）

- 不动 IPC 协议形状（`SendPromptArgs` / `StreamEvent` 不变）。
- 不引入新 npm 依赖（MCP 客户端就 ~150 行 NDJSON + 状态机）。
- 不动设计 token / 视觉（流式光标 `.typing` 已存在）。
- 不做 reasoning / tool-call 可视化（留给后续 SDD）。
- 不写 ADR（不属于 § 4 触发条件）。

---

## 7. 业务逻辑要点（再次列明）

- 渲染层每次 `send` 仍生成新 `sessionId`；MCP 客户端在内部用 `sessionId ⇄ requestId ⇄ threadId` 三向映射，**首次** request 后把 `threadId` 缓存到 conversation（落到内存即可，不持久化），续轮自动用 `codex-reply`。
- 跨 conversation 不复用 thread；同一 conversation 内多轮自动走 reply，是体感加速的关键。
- 用户切换项目即切换 cwd → 会话所属进程不同，threadId 也独立。
