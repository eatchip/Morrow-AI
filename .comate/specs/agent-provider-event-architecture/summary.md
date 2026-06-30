# Summary

## Done

- Codex 主对话不再启动/写入 PTY session，而是与 Claude 一样统一走 `sendPrompt` 结构化 provider 通道。
- `Chat` 永远渲染 `Conversation.messages`；PTY 只保留为 `AgentTerminalLog` 诊断入口和 approval 辅助状态。
- 删除旧 `AgentTranscriptView` 与 assistant/tool/status PTY 投影，避免终端 TUI 再被当作聊天协议。
- Codex exec fallback 忽略非 JSON stdout，并去掉 fallback notice chunk，防止 update banner / 诊断提示进入正文。
- 回复中输入框保持焦点和草稿，但发送被禁用，避免单一 stream owner 被下一条消息覆盖。

## Verification

- `pnpm check`
- `pnpm test -- --run`（23 files / 134 tests）
- `pnpm build`
- `pnpm test:e2e`（4 tests）
- `pnpm pre-commit`（staged gate；10 related test files / 48 tests + 4 E2E）
