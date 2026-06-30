# Spec — multi-session-draft-recovery

> 修复两个同源会话状态 bug：后台回复时不能开启/发送另一会话；新对话草稿切走后无法找回。

## 1. Triage

- **规模**：Large。
- **原因**：涉及 renderer 会话状态归属、流式事件路由、异步生命周期和用户可见输入状态；命中 AGENTS.md 的并发/生命周期风险触发器。
- **执行前提**：本任务按用户要求在独立 worktree `/Users/songhuiyu/Morrow-multi-session-draft` 和分支 `codex/fix/multi-session-draft` 内执行。

## 2. Context

当前代码有两处全局化状态：

1. `App.tsx` 的 `streamingRef` 是单例 `{ convId, aiId, sid } | null`。只要任一会话在回复：
   - `useSendMessage` 直接 `return`，拒绝所有新发送。
   - `Home` 使用 `streamingAny` 禁用输入框发送按钮。
   - `useStream` 只消费当前单例，无法并行路由多个 `sessionId`。
2. `Composer` 的草稿是组件本地 `useState`。当用户切到其它会话/频道时，当前空会话会被 `evictEmptyOnLeave` 清理；即使未清理，Composer 卸载后本地草稿也丢失。

既有 `.comate/specs/agent-provider-event-architecture/doc.md` 已明确记录后续方向："多会话并发 streaming 需要把 `streamingRef` 扩展为 `sessionId -> target message` map"。本次正是落地该后续项。

## 3. Research

| 参考 | 可迁移模式 | 本任务采用 |
| --- | --- | --- |
| React 官方 `Preserving and Resetting State` | 被卸载组件的本地 state 会销毁；聊天草稿常见做法是把每个 recipient 的 pending message 提升到父级保存 | 草稿从 `Composer` 本地 state 提升到 `Conversation.draft` |
| React 官方 `<textarea>` 文档 | 受控 textarea 必须用 `value` + 同步 `onChange`，且 value 始终为 string | `Composer` 改为受控组件，父层同步写入会话草稿 |
| Morrow 既有 `agent-provider-event-architecture` SDD | 主时间线由 `Conversation.messages` 持有，流式临时态由 `liveTextStore` 投影；单例 streaming 是已知限制 | streaming owner 改成 `sessionId -> { convId, aiId, sid }` |

资料：
- https://react.dev/learn/preserving-and-resetting-state
- https://react.dev/reference/react-dom/components/textarea

## 4. Requirements

### 4.1 多会话并行发送

- 当会话 A 正在回复时，用户可以新建/切换到会话 B，并发送 B 的第一条或后续消息。
- 同一会话已有 AI 回复 streaming 时，仍禁止在该会话继续发送，维持现有"完成后可继续发送"语义。
- 每个 stream event 必须按 `sessionId` 路由到正确的 conversation/message，不能覆盖其它会话。
- 删除某会话时，只清理属于该会话的 streaming entry，不影响其它会话。

### 4.2 草稿可找回

- 新对话中输入但未发送的内容属于用户意图，应保留在该 conversation 上。
- 切到其它地方后，带草稿的空 conversation 不应被自动清理。
- 再次选择该 conversation 时，Composer 显示原草稿。
- 草稿发送成功后清空，并把 conversation 物化为正常消息历史。
- 完全空白、无消息、无草稿的 conversation 仍可被 `evictEmptyOnLeave` 清理，避免侧边栏污染。

### 4.3 Out of Scope

- 不做磁盘持久化；本仓当前 conversation 仍是内存态，应用重启后恢复另起 SDD。
- 不引入取消/abort 多 stream UI。
- 不改变 IPC `SendPromptArgs` / `StreamEvent` 契约。
- 不新增依赖、不改主进程 provider 协议。

## 5. State Ownership

| 状态 | Owner | 迁移 |
| --- | --- | --- |
| `Conversation.messages` | `App.tsx` | send 时追加 user + streaming ai；done/error 时结算 |
| `Conversation.draft` | `App.tsx` | Composer onChange 同步更新；send 接受后清空 |
| streaming registry | `App.tsx` ref | send 时按 `sid` 添加；done/error/timeout/delete 时删除对应 entry |
| `liveTextStore` | renderer lib | chunk 临时投影；done/error 后 consume |
| `Composer` | 受控展示组件 | 不再拥有草稿，只发出 onChange/onSubmit |

## 6. Invariants

1. 一个 conversation 同一时刻最多有一个 `status === 'streaming'` 的 AI 消息。
2. 一个 stream event 只允许更新 `sessionId` 对应的目标 message；未知 `sessionId` 事件必须忽略。
3. `evictEmptyOnLeave` 只回收 `messages.length === 0 && draft.trim() === ''` 的 conversation。

## 7. Boundaries & Lifecycle

- **边界输入**：`sendPrompt` IPC 入参校验保持在 main `ipc-validate.ts`；renderer 仅改变 conversationId/sessionId 归属，不扩大边界。
- **异步 gap**：send 会先注册 streaming entry，再调用 `window.morrowApi.sendPrompt`；timeout 和 catch 只清理自身 `sid`。
- **并发竞态**：done/error 按 `sessionId` 查 registry，不能用"当前 active conversation"判断。
- **资源释放**：delete conversation 时移除该 conversation 的所有 registry entries，并 kill 既有 PTY 诊断 session（保持现状）。
- **合规**：不触碰隐私数据、线上数据、凭证、第三方 API 条款或许可证。

## 8. Visual Gate

- 档位：🟢 已有组件局部行为修改。
- 不新增页面、flow、原语组件、颜色、字号、间距或动效；无需前置视觉稿，验证以截图/手工路径为准。

## 9. Acceptance Criteria

- A 会话回复中，点击「新建对话」输入并发送，B 会话可产生独立 user + AI streaming 消息。
- A/B 的 chunk/done/error 互不串线，后台回复完成后回到对应会话能看到完整结果。
- A 会话回复中，A 自己的 Composer 仍显示"正在回复"，发送按钮禁用。
- 新对话输入草稿后切到其它会话/频道，再点回该对话，输入框仍有原内容。
- 无消息且无草稿的空会话切走仍会自动清理。
- 回归测试覆盖以上核心路径，`pnpm pre-commit` 通过。

## 10. Expected Verification

- Unit:
  - `conversation-lifecycle.test.ts`：草稿 conversation 不被 evict；空白草稿仍可 evict。
  - `composer-send-disabled.spec.tsx`：受控 Composer 在 disabled 时保留草稿，不提交。
  - 新增发送 hook 测试：已有其它会话 streaming 时仍允许当前会话发送；同一会话 streaming 时禁止。
- E2E/手工：
  - 走用户截图路径验证多会话发送和草稿恢复。
- Gate:
  - `pnpm pre-commit`。
