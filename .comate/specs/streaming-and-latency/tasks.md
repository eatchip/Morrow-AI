# streaming-and-latency — Tasks

把 doc.md 拆成 8 个独立可验证的 task。每个 task 完成即可单独 commit、各自有验证手段；中途中断不留半截品。

- [x] Task 1：搭建 codex MCP 客户端骨架 (`src/app/main/codex-mcp.ts`)
    - 1.1：定义 NDJSON 行解析器（复用 `readline.createInterface`，单行 1MB 上限）
    - 1.2：JSON-RPC 请求/响应路由（`id` 单调递增、Promise 注册表、超时与孤儿清理）
    - 1.3：`McpClient` 类：`spawn('codex', ['mcp-server'])`、`initialize` 握手、`notifications/initialized`、错误/退出生命周期
    - 1.4：`tools/list` 校验工具存在 `codex` + `codex-reply`，缺失则抛特定 error 供上层 fallback
    - 1.5：单测 `tests/unit/codex-mcp-client.test.ts`：mock stdio（用内存 Duplex），覆盖 initialize 成功 / tools/list 缺失 / 子进程崩溃

- [x] Task 2：MCP 进程池（按 cwd 复用 + 闲置回收）
    - 2.1：`McpPool` 类，`getOrCreate(cwd)` 懒启动，`closeAll()` 退出清理
    - 2.2：每个进程关联 `lastUsedAt`，单一 `setInterval(60s)` 扫描，闲置 5 分钟 SIGTERM
    - 2.3：进程退出（崩溃/被杀）→ 从池中移除；下次 `getOrCreate` 重启
    - 2.4：`app.on('before-quit')` 与 `BrowserWindow` `closed` 都调用 `closeAll`
    - 2.5：单测：闲置回收触发、崩溃后下次 ensure 重启、并发 ensure 单实例化

- [x] Task 3：Session → Thread 映射 + 流式事件桥接
    - 3.1：`startCodexSession(args, emit)` 入参形 `{ cwd, sessionId, prompt }`，与现有 `StartSessionArgs` 兼容
    - 3.2：内存 map：`conversationKey → threadId`（key 由调用方决定；本期用 `cwd + 首次 sessionId` 暂代，后续 Task 4 串通真实 conversationId）
    - 3.3：首轮 `tools/call codex`，后续 `codex-reply`；监听 `codex/event` 通知按 `_meta.requestId` 路由
    - 3.4：事件→`StreamEvent` 映射：`agent_message_delta` → chunk；JSON-RPC error / `error` 事件 → error；`turn.completed` → done（仅当本 request 已结算）
    - 3.5：`abortSession(sessionId)` 发送 MCP `notifications/cancel` 并解绑本地 listener
    - 3.6：单测：完整 turn、cancel 中途、error 提前结束三路径

- [x] Task 4：把 `runtime-session.ts` 切到 MCP（codex 路径）+ threadId 落到 conversation
    - 4.1：`runtime === 'codex'` 分支委托 `codex-mcp.startCodexSession`；保留旧 `parseCodexLine` 仅作 fallback（Task 1.4 工具缺失时启用），并加 TODO 标注下个版本删除
    - 4.2：扩展 `SendPromptArgs`（`shared/ipc.ts`）增加可选 `conversationId: string`，用于跨轮关联 thread；renderer 端在 `App.tsx` 的 `send` 里把 `activeId` 透传
    - 4.3：`ipc.ts` 把 `conversationId` 传给 mcp 客户端；threadId 缓存 key 改为 `cwd + conversationId`
    - 4.4：`killAll` → `closeAll`；renderer 的 claude 路径走原 spawn，不变
    - 4.5：契约测试 `tests/contract/`：MCP 不可用时 fallback 到 exec，并 emit 一条警告 chunk

- [x] Task 5：渲染层 liveText store + rAF coalesce
    - 5.1：新增 `src/app/renderer/src/lib/live-text-store.ts`，`useSyncExternalStore` 订阅，`append(sessionId, text)` / `commit(sessionId)` / `read(sessionId)`
    - 5.2：改造 `lib/stream.ts`：chunk 在 rAF 内合并写 store；`done`/`error` 立刻派发，不合并
    - 5.3：`App.tsx` 的 `useStream` 监听器改为：chunk 路径只调 `liveTextStore.append`，`done`/`error` 才 `setConversations` 一次结算（把 store 文本 commit 到该 ai message 的 `text`，并清 store entry）
    - 5.4：单测：append 频繁不引发 setConversations、done 时一次性 commit

- [x] Task 6：StreamingMessage 组件 + 滚动策略
    - 6.1：`Chat.tsx` 抽出 `StreamingMessage`（订阅当前流式 sessionId 的 store 文本），其他消息 `React.memo`
    - 6.2：自动滚动放到 rAF；用户向上滚动时禁用直到下一次发送
    - 6.3：`.typing` 光标位置不变；流式中渲染只重绘 `StreamingMessage` 一个节点
    - 6.4：组件单测（vitest + RTL）：长文本渲染期间，非流式消息组件 render 次数为 1

- [x] Task 7：清理与回归
    - 7.1：旧 `parseCodexLine` 仅保留为 fallback（带 doc 注释指明用途），其相关测试用例同步精简
    - 7.2：更新 `CHANGELOG.md` `[Unreleased]` 增加 perf 段：流式恢复 + 会话复用 + 渲染层批合并
    - 7.3：`pnpm pre-commit` 全绿；e2e `tests/e2e` 全过

- [ ] Task 8：手动 e2e checklist 与最终验证
    - 8.1：冷启动 → 首次发送，首字符 ≤ 4s；逐 token 增长
    - 8.2：同 conversation 第二轮起首字节 ≤ 1s
    - 8.3：5KB 回复期间 DevTools Performance 帧内 long task < 50ms
    - 8.4：流式中 Esc / 切走 → 子进程立即终止、UI 即时响应
    - 8.5：两项目并行各一对话不串线
    - 8.6：codex 不存在 → 走 fallback exec 路径并提示
