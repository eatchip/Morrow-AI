# Tasks — conversation-lifecycle-cleanup

> 让空对话不污染侧边栏；让侧边栏对话像项目一样可手动移除。

- [x] Task 1: 抽取纯函数与单测（TDD red→green）
    - 1.1: 新建 `src/app/renderer/src/lib/conversations.ts`，导出 `evictEmptyOnLeave(convs, prevId, nextId)` 与 `deleteConversation(convs, id)` 两个纯函数
    - 1.2: 新建 `tests/unit/conversation-lifecycle.test.ts`，覆盖 doc.md §8 列出的 5 类用例（先红）
    - 1.3: 实现纯函数让单测变绿
    - 1.4: `pnpm test` 通过

- [x] Task 2: App.tsx 接入 eviction
    - 2.1: 引入 `evictEmptyOnLeave`，新增 `setActiveIdWithEviction` 包装
    - 2.2: 替换 `createConversation` / `selectConversation` / `send` 中的 `setActiveId` 调用
    - 2.3: 验证 `back()` 仍只切 scene、不触发 eviction
    - 2.4: 手动跑 `pnpm dev`，按 doc.md §8 步骤 1/2/3 自测

- [x] Task 3: 对话删除入口
    - 3.1: `App.tsx` 新增 `handleDeleteConversation`，处理 streamingRef 清空 + activeId/scene 回退
    - 3.2: `Sidebar` props 新增 `onDeleteConversation`，向下传至 `ConvItem`
    - 3.3: `ConvItem` 渲染 × 元素（沿用 `sidebar-project-remove` 交互模式：role=button、tabIndex=0、Enter/Space、stopPropagation）
    - 3.4: `sidebar.css` 增加 `.sidebar-item-remove` 样式（hover 浮现，复用既有 token）
    - 3.5: 手动自测 doc.md §8 步骤 4/5

- [x] Task 4: 文档 & 闸门收尾
    - 4.1: `CHANGELOG.md` `[Unreleased]` 增补两条 feat 记录
    - 4.2: `pnpm pre-commit` 全绿
    - 4.3: 生成 `summary.md`，附 hover/删除截图说明（PR 附图）
