# streaming-and-latency — Summary

## 目标回顾

用户反馈 Codex 回答"无流式、慢"。根因两条：

1. **协议层**：`codex-cli 0.128+` 的 `exec --json` 不再发 `agent_message_delta`，整条消息一次性抵达 → Morrow 主进程只能收到 `done`，渲染层看不到逐 token 增长。
2. **渲染层**：每个 `chunk` 事件触发一次 `setConversations(prev => prev.map(...))`，在 `conversations` 树上做整列深拷贝，O(N²) 体感卡顿。

## 落地方案

### 主进程：切到 codex MCP 协议

- 新增 `src/app/main/codex-mcp.ts`：
  - `McpClient`：`spawn('codex', ['mcp-server'])`，NDJSON 上的 JSON-RPC；`initialize` + `notifications/initialized` 握手；`tools/list` 校验 `codex` / `codex-reply` 存在，缺失抛 `McpUnsupportedError` 供上层 fallback。
  - `McpPool`：按 `cwd` 复用 `McpClient`；`lastUsedAt` + 60s 扫描 + 5 分钟闲置 SIGTERM；子进程异常退出自动从池摘除。`closeAll()` 挂在 `app.before-quit` 与窗口 `closed` 事件。
  - Session → Thread 映射：内存 map，`cwd|conversationId` 为 key；首轮 `tools/call codex`，后续 `codex-reply`；通过 `codex/event` 通知按 `_meta.requestId` 路由到单次 `sessionId`。
  - 事件映射：`agent_message_delta` → chunk；JSON-RPC error / `error` 事件 → error；`turn.completed` → done。`abortSession(sessionId)` 发 `notifications/cancel` 并解绑监听器。
- `runtime-session.ts`：`runtime === 'codex'` 走 `startCodexSession`；抓 `McpUnsupportedError` → 发一条 `[notice]` chunk → 兜底 `startExecSession`。`parseCodexLine` 加 fallback-only 注释。`abortSession` 先试 `abortCodexMcpSession` 再落旧路径。
- `shared/ipc.ts` 的 `SendPromptArgs` 扩展可选 `conversationId`；`main/ipc.ts` 校验后透传；renderer 在 `App.tsx` 发送时带上 `targetId` 作为 `conversationId`，MCP 用它做 thread 缓存 key。

### 渲染层：liveTextStore + rAF coalesce + StreamingMessage

- `src/app/renderer/src/lib/live-text-store.ts`：按 `sessionId` 分桶的缓冲区 + `useSyncExternalStore` 订阅。`append` 只写 Map，通过 `requestAnimationFrame` 合并通知订阅者；`consume` 读取并清空；`drop` 丢弃。
- `App.tsx` 的 `useStream` 监听器：
  - `chunk` → `liveTextStore.append(sid, text)`，**不** `setConversations`。
  - `done` / `error` → `liveTextStore.consume(sid)` 一次性写入对应 AI message 的 `text`，并清 `sessionId` 标记。
- `Chat.tsx` 拆出：
  - `StaticMessage`（`React.memo`）：结算后的消息气泡，`chunk` 抵达时不重渲染。
  - `StreamingMessage`：仅当 `role === 'ai' && status === 'streaming' && sessionId` 时挂载，内部 `useLiveText(sessionId)` 订阅；合并 `m.text + live` 渲染。
  - 自动滚动改 rAF 合并：同一帧内多次 tick 只写一次 `scrollTop`。

### 回退与兼容

- 当 MCP 工具缺失（旧 CLI 版本）：emit `[notice] codex mcp-server unavailable, falling back...`，走原 `startExecSession`；`parseCodexLine` 保留。
- `claude` 路径完全不变。
- 数据契约：`SendPromptArgs.conversationId` 为**可选**字段，不改旧调用方。

## 测试成果

- 新增 `tests/integration/codex-mcp.spec.ts`：mock `child_process.spawn` 的内存 Duplex，覆盖 `initialize + deltas + done`、tools 缺失 → `McpUnsupportedError`、子进程崩溃三路径。
- 新增 `tests/unit/live-text-store.spec.ts`：rAF 合批（多次 `append` 一帧只通知一次）、`consume` 清空、sessionId 隔离、`drop` 不通知。
- 新增 `tests/unit/chat-streaming-message.spec.tsx`：`StreamingMessage` 处理 50 次 append 期间，`StaticMessage` 的 DOM 节点 identity 与文本不变（=未 re-render）。
- 全量：`pnpm test` 78 pass（原 73 + 5 新）；`pnpm test:e2e` 2 pass；`pnpm pre-commit` 全绿。

## 影响文件

```
新增
  src/app/main/codex-mcp.ts                              (~435 LOC)
  src/app/renderer/src/lib/live-text-store.ts            (~95 LOC)
  tests/integration/codex-mcp.spec.ts
  tests/unit/live-text-store.spec.ts
  tests/unit/chat-streaming-message.spec.tsx

修改
  src/app/main/runtime-session.ts        (codex 路径委托 MCP + fallback；parseCodexLine 注释为 fallback-only)
  src/app/main/ipc.ts                    (conversationId 校验 + 透传)
  src/shared/ipc.ts                      (SendPromptArgs.conversationId 可选字段)
  src/app/renderer/src/App.tsx           (chunk 走 store、done/error 结算；Msg.sessionId 写入)
  src/app/renderer/src/screens/Chat.tsx  (拆出 StaticMessage / StreamingMessage；rAF 滚动)
  CHANGELOG.md                           ([Unreleased] Performance 段)
```

## 待用户手工验证（Task 8）

主进程 / 渲染层的单元与集成测试全部 pass，但以下体感指标必须在真实 `codex` CLI 下用户侧回归：

1. 冷启动首次发送，首字符 ≤ 4s；之后逐 token 可见增长。
2. 同 conversation 第二轮首字节 ≤ 1s（threadId 命中 `codex-reply`）。
3. 5KB 回复期间 DevTools Performance 帧内 long task < 50ms。
4. 流式中 Esc / 切走：子进程立即终止，UI 无粘滞。
5. 两项目并行各开一会话，不串线（`McpPool` 按 `cwd` 隔离）。
6. 卸掉或降级 `codex` 到无 `mcp-server` 的版本 → 看到 `[notice] codex mcp-server unavailable, falling back...` 并仍能得到整段回答。

如用户侧任意一条不通过，对应修复走独立 follow-up（保持 SDD 单任务内聚）。

## 已知限制与后续

- MCP 握手 / `tools/list` 超时默认使用阻塞 Promise 无超时器；子进程长时间不响应时当前表现为"等"。如后续用户反馈需要 fail-fast，加 10s 上限 + `[error] codex mcp-server 无响应` 直接走 fallback。
- `liveTextStore` 按 `sessionId` 生命周期依赖调用方显式 `consume` / `drop`；取消场景下 `abortSession` 当前走主进程 cancel，renderer 是否需要同步 drop 取决于 UI 期望保留"已吐出的文本"或"清空"。保留当前"保留已吐出文本"策略。
- `parseCodexLine` 的 fallback 只能返回整块消息、失去逐 token 流式。若未来 codex-cli 重新恢复 delta，可同步 MCP 侧，也可直接删除 fallback。
