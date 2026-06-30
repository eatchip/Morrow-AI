# Tasks

- [x] 梳理 PTY/TUI 泄漏路径与状态 owner。
- [x] 写 SDD：结构性方案、状态不变量、验收标准。
- [x] 让 Codex 发送走统一 `sendPrompt` provider 通道。
- [x] 主 `Chat` timeline 只渲染 `Conversation.messages`。
- [x] 把 PTY 展示降级为可选诊断日志组件。
- [x] 阻止回复中继续提交，避免单一 stream owner 被覆盖。
- [x] 收紧 Codex exec fallback：忽略非 JSON stdout，去掉 fallback notice chunk。
- [x] 更新 E2E / contract / unit 测试覆盖结构性不变量。
- [x] 跑定向验证：`pnpm check`、`pnpm test -- --run`、`pnpm build`、`pnpm test:e2e`。
- [x] 跑 staged 全量闸门：`pnpm pre-commit`。
- [ ] 提交并推送。
