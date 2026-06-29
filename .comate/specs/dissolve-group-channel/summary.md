# Summary: 解散群聊频道

## 做了什么

- 新增 `channels:delete-channel` IPC 契约和 `deleteChannel` API，renderer 只能通过受控命令解散群聊。
- Store 删除群聊时同步移除该群聊的 events、runs、handoffs，保留 AI 队友角色。
- Orchestrator 会 abort 目标群聊内仍在 running 的 role run，并在 runtime late callback 时保持 no-op。
- Sidebar 群聊条目新增“解散群聊”入口，确认弹层使用“确认解散 / 解散中…”文案，并说明操作无法撤销。
- 当前打开的群聊被解散后，频道工作区回到“选择或新建一个群聊”的空态。

## 验证

- `pnpm test -- --run tests/contract/channels-validate.spec.ts tests/contract/preload-api-shape.spec.ts`
- `pnpm test -- --run tests/integration/channels-store.spec.ts tests/integration/channel-orchestrator.spec.ts`
- `pnpm test -- --run tests/unit/sidebar-dom.spec.tsx`
- `pnpm check`
- `pnpm build`
- `pnpm test:e2e tests/e2e/channel-role-mvp.spec.ts`
- `pnpm pre-commit`

## 已知限制

- 本次只做“解散”，不做归档/恢复。
- 解散后不保留频道历史；这是本次确认文案里的明确语义。
