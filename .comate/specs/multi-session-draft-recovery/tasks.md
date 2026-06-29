# Tasks — multi-session-draft-recovery

- [x] Task 1: 建立 SDD 与定位根因
  - [x] 创建独立 worktree/分支。
  - [x] 阅读 AGENTS.md、DEVELOPMENT.md、bug-fix playbook、相关 ADR/SDD。
  - [x] 定位 `streamingRef` 单例与 `Composer` 本地草稿两个根因。

- [x] Task 2: 回归测试先行
  - [x] 更新 `conversation-lifecycle.test.ts`，覆盖带草稿空会话保留、空白草稿回收。
  - [x] 更新 `composer-send-disabled.spec.tsx`，适配受控 Composer 并确认禁用时草稿仍保留。
  - [x] 为 `useSendMessage` 增加单元测试，覆盖跨会话并行发送和同会话发送锁。

- [x] Task 3: 实现按会话归属的草稿
  - [x] `Conversation` 增加 `draft` 字段。
  - [x] `Composer` 改为受控组件。
  - [x] `Home` / `Chat` 透传 `draft` 和 `onDraftChange`。
  - [x] `App.tsx` 负责创建/更新/清空 active conversation 草稿。

- [x] Task 4: 实现多 streaming registry
  - [x] 把 `streamingRef` 从单例改为 `sid -> target` registry。
  - [x] `useStream` 按 `event.sessionId` 路由 chunk/done/error。
  - [x] `useSendMessage` 只阻止同一 conversation 的并发发送，不阻止其它 conversation。
  - [x] 删除 conversation 时只清理该 conversation 对应 registry entry。

- [x] Task 5: 文档与验证
  - [x] 更新 `CHANGELOG.md [Unreleased]`。
  - [x] 跑定向测试。
  - [x] 跑 `pnpm pre-commit`。
  - [x] 完成 `summary.md`。
