# Summary — conversation-lifecycle-cleanup

## 目标
让"新建对话"在用户切走且未发送消息时自动从侧边栏消失；同时让侧边栏每条对话支持手动 × 删除。

## 改动
- `src/app/renderer/src/lib/conversations.ts`（新增）— 提取两个纯函数 `evictEmptyOnLeave` / `deleteConversation`，便于单测。
- `src/app/renderer/src/App.tsx` — 新增 `setActiveIdWithEviction` 包装、`handleDeleteConversation`；将 `createConversation` / `selectConversation` / `send` 的 `setActiveId` 调用改走 wrapper。删除目标对话同步清空 `streamingRef`，必要时把 scene 拉回 home。
- `src/app/renderer/src/components/Sidebar.tsx` — `Sidebar` props 增加 `onDeleteConversation`；`ConvItem` 改为外层 `<div>` + 内层主体 `<button>` + 兄弟 × 节点（避免 button 嵌套），交互沿用 `.sidebar-project-remove` 模式。
- `src/app/renderer/src/sidebar.css` — 重构 `.sidebar-item` 为 flex 容器，新增 `.sidebar-item-body` / `.sidebar-item-remove`；hover 出现 ×。
- `tests/unit/conversation-lifecycle.test.ts`（新增）— 7 条单测覆盖 eviction 与 delete。
- `tests/unit/sidebar-dom.spec.tsx` — 适配新 prop；新增"× 触发删除且不选中"用例。
- `CHANGELOG.md` — `[Unreleased]` 增补一条 SDD 摘要。

## 验证
- `pnpm check`：通过（tsc 无错）。
- `pnpm vitest run`：11 个 test files / 70 个用例全过。
- `pnpm lint`：0 warning / 0 error（48 files / 138 rules）。
- `pnpm format`：全文件格式一致。
- 手动验证（dev）：
  1. 进入 chat 后切到另一对话 → 旧空对话从侧边栏消失。
  2. 连续点两次「新建对话」→ 列表只剩 1 条空对话。
  3. 已发消息的对话 → 切走仍保留。
  4. ConvItem hover → × 浮现，点击删除；删除 active 对话回首页。
  5. 流式中删除 → `streamingRef` 同步清空，无悬挂回调。

## 不变量
- I1：任意时刻最多存在一条空对话，且其 `id === activeId`。
- I2：一旦 `messages` 非空，永不被自动回收。
- I3：自动回收仅作用于"刚离开的旧 activeId"，不扫全表。

## 不在本次范围
- 持久化（重启保留对话）— 当前仍为内存态。
- Undo / Toast。
- 后台 IPC 流的真正 abort。

## 风险与回滚
本次改动均为渲染层局部行为变化，回滚仅需 revert 单 commit。无 IPC schema 变更。
