# agent-terminal-parity — Spec

## 1. Task Scale

Large.

原因：本任务改变 Codex 主运行时架构，引入 native PTY 依赖，跨 main / preload /
renderer / tests / packaging 边界，并直接影响用户可见对话体验。

用户目标不是“修复一次 no output”，而是：

- Morrow 中启动 Codex Agent 后，应像 terminal 中运行 `codex` 一样快；
- Codex CLI 上游事件 schema 变化不能再次导致 UI 空输出；
- 对话主链路必须长期稳定，MCP/JSON 解析只能作为增强或 fallback。

## 2. Research

### Reference: OpenCove

用户提供参考仓库 `eatchip/opencove`。只读分析结论：

- `package.json` 使用 `node-pty` + `@xterm/xterm` + xterm addons。
- `src/platform/process/ptyHost/entry.ts` 用 `node-pty.spawn(...)` 启动真实 PTY。
- `src/platform/process/ptyHost/supervisor.ts` 用独立 host process 隔离 native addon。
- `src/contexts/agent/infrastructure/cli/AgentCommandFactory.ts` 直接构造
  `codex ... <prompt>` / `codex resume ...` 命令。
- `docs/terminal/MULTI_CLIENT_ARCHITECTURE.md` 明确主链路为：
  `PTY / Agent CLI output -> worker owns runtime -> clients render locally`。

可迁移原则：

1. Terminal parity 的主链路必须是 PTY，不是手写协议 parser。
2. native PTY 必须隔离到 host process，main 只做 supervisor。
3. Renderer 使用 xterm.js 本地渲染；输出只做批量转发，不解释 Codex 私有事件。
4. 结构化会话状态、最后回答、状态 watcher 可以是增强层，不能阻断用户对话。

### Current Morrow Problem

Morrow 当前 Codex 主链路：

```text
Renderer Chat
  -> IPC sendPrompt
  -> main codex-mcp
  -> parse codex/event
  -> StreamEvent chunk
  -> Chat bubble
```

`codex-cli 0.130.0` 成功回答时发 `agent_message_content_delta`，而当前
`codex-mcp.ts` 只监听 `agent_message_delta`。结果是 tools/call 成功返回 `done`，
但 UI 没有任何 chunk，最终显示 `(no output)`。

这说明 MCP parser 不应继续作为 Codex 主体验的可靠性根基。

## 3. Decision

Morrow 改为 **PTY-first, MCP-second**。

主链路：

```text
Renderer TerminalPane
  -> preload pty API
  -> main PtySupervisor
  -> ptyHost utility process
  -> node-pty
  -> codex interactive CLI
  -> xterm.js local rendering
```

增强链路：

```text
codex MCP / exec parser
  -> only fallback / structured projection
  -> never blocks terminal output
```

## 4. Business Logic And Acceptance Criteria

### AC-1: Codex PTY Agent 可用

用户发送首条消息时，Morrow 创建一个 Codex PTY session，界面显示真实 Codex terminal
输出。Codex 在 terminal 中能显示的内容，Morrow 也必须显示。

### AC-2: Terminal parity

Codex 输出不依赖 MCP event schema；上游把 `agent_message_delta` 改名时，主体验不受影响。

### AC-3: Long-lived Session

同一 conversation 只启动一个 PTY session；后续追问写入同一个 PTY，而不是每次冷启动。

### AC-4: Configuration parity

Renderer 的 model / effort 偏好必须进入 Codex 启动命令或 MCP fallback，避免 UI 显示与实际运行不一致。

### AC-5: Fast Feedback

PTY 创建后首屏输出应立即进入 xterm；不等模型完整回答后再显示。

### AC-6: Failure Transparency

Codex 启动失败、PTY host 崩溃、MCP fallback 失败，都必须显示结构化错误，不允许静默 `(no output)`。

### AC-7: Regression Assets

本 bug 必须留下可复用资产：

- MCP 0.130 event schema tests；
- PTY host contract/integration tests；
- renderer terminal session tests；
- CHANGELOG 记录用户可感知修复。

## 5. Ownership

| State | Class | Owner | Notes |
| --- | --- | --- | --- |
| conversation list/title/project | Durable/UI fact | renderer App state | 当前版本仍为内存态 |
| PTY process lifecycle | Runtime observation | main `PtySupervisor` | host process 可崩溃恢复 |
| PTY native sessions | Runtime observation | `pty-host` process | `node-pty` 只在 host 内加载 |
| terminal bytes | Runtime stream | main `PtySessionManager` | seq + replay buffer |
| terminal screen | UI projection | renderer xterm.js | 可丢弃重建 |
| model/effort preference | User intent | renderer localStorage + IPC payload | 主进程边界校验 |
| MCP structured output | Enhancement | main `codex-mcp` | 不再是主输出来源 |

## 6. Invariants

1. 对任一 Codex conversation，若存在 PTY session，用户输入只写入该 session；不得再为同一轮创建 `codex exec` 冷进程。
2. PTY 输出只以 bytes/seq 形式跨 IPC；renderer 不解析 Codex 私有协议即可显示主体验。
3. `node-pty` 不得加载进 Electron main；native addon 故障只能影响 PTY host，不得崩溃整个 app。
4. MCP/exec fallback 成功或失败都不能覆盖 PTY session 的主输出事实。

## 7. Boundaries

### IPC

新增一组 `pty:*` channel：

- `pty:spawn`
- `pty:write`
- `pty:resize`
- `pty:kill`
- `pty:snapshot`
- `pty:data`
- `pty:exit`

所有 payload 由 main/preload 边界校验。renderer 不传任意 cwd，仍通过 `projectId`
由主进程解析。

### Dependencies

必须引入：

- `node-pty`：真实 PTY；
- `@xterm/xterm`：终端渲染；
- `@xterm/addon-fit`：按容器计算 cols/rows。

这是用户明确批准的架构重构范围内的必要依赖。

### Packaging

`electron.vite.config.ts` 增加 `ptyHost` main entry。`node-pty` 作为 external dependency，
由 electron-builder install app deps 构建 native addon。

## 8. Risks

1. `node-pty` native addon 安装/打包失败。
   - 验证：`pnpm install`、`pnpm build`。
2. xterm renderer 与当前 Chat UI 交互冲突。
   - 控制：第一版仅在 Chat 主区域嵌入一个 terminal panel，不做复杂 canvas。
3. PTY 输入时机问题：Codex TUI 初始启动时可能未 ready。
   - 控制：首条 prompt 作为 argv 传入，后续输入写入 PTY。
4. Windows batch resolution。
   - 控制：第一版保留 `spawn('codex', args)`；Windows 专门适配后续跟进，当前 macOS 为主验收。

## 9. Non-goals

- 不复刻 OpenCove 的 infinite canvas。
- 不实现多客户端 Web UI。
- 不持久化完整 terminal recovery；本轮保留内存会话。
- 不删除 MCP fallback；先降级为备用输出路径。

