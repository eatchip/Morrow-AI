# Tasks: MVP UX Fixes

按 doc.md 的范围拆成 7 个独立可验证的 top-level 任务。顺序经过设计：先最小独立改动（Enter 键、返回按钮、视觉分隔）快速验证，再做较大的状态重构（多会话 + 侧边栏），最后补测试与收尾。每个顶层任务完成后提交一次 commit，保证小步可回滚。

- [x] Task 1: Composer Enter 发送契约切换（问题 4）
    - 1.1: `Composer.tsx` keydown 改为 Enter 发送 / Shift+Enter 换行 / ⌘⏎ 保留冗余
    - 1.2: 处理 IME 合成（`isComposing` + `keyCode === 229` 双兜底）
    - 1.3: 更新 placeholder / hint / button title 文案为 `⏎ 发送 · Shift⏎ 换行`
    - 1.4: 同步 `Chat.tsx` / `Home.tsx` 传入的 hint 默认文案
    - 1.5: 本地 `pnpm typecheck && pnpm lint` 绿

- [x] Task 2: Chat 顶部返回按钮 + 视觉分隔（问题 1、2）
    - 2.1: `App.tsx` 在 `.top` 左侧加 `← 首页` 按钮，仅 `scene==='chat'` 时渲染
    - 2.2: 点击按钮调 `back()`；保留现有 `Esc` 键绑定
    - 2.3: CSS 给 `.stream` 与 `.composer-wrap` 之间加 1px 分割线 + 渐隐底色
    - 2.4: `.msg-ai` 增加 `margin-bottom: var(--space-6)`
    - 2.5: `Chat.tsx` 的 streaming hint 文案改为 `● streaming · Esc 中止`
    - 2.6: 按 docs/design/DESIGN.md 只用 tokens，不写裸色值 / 裸间距

- [x] Task 3: 状态模型重构（App.tsx 单会话 → 多会话）
    - 3.1: 在 `App.tsx` 定义 `Conversation` 类型与 `conversations` / `activeId` state
    - 3.2: 保留 `useStream` 单订阅；`streamingRef` 升级为 `{ convId, aiId } | null`
    - 3.3: `send()` 改为：若无 activeId 先 `createConversation()`；消息写入对应 conversation；`updatedAt` 更新
    - 3.4: 首条 user 消息发送后派生 title（前 24 字符）
    - 3.5: `back()` 改为只切视图不 abort；Esc 同语义
    - 3.6: 旧的 `messages` state 完全删除（不留兼容层）
    - 3.7: `pnpm typecheck` 绿

- [x] Task 4: 新增 Sidebar 组件
    - 4.1: 新建 `src/app/renderer/src/components/Sidebar.tsx`，props: `conversations, activeId, onSelect, onCreate`
    - 4.2: 顶部"+ 新建对话"按钮（整行）
    - 4.3: 列表项：标题（单行省略）+ 相对时间
    - 4.4: 内部 `formatRelativeTime(ts, now)` 纯函数（刚刚 / N 分钟前 / HH:mm / 昨天 / MM-DD）
    - 4.5: active 项高亮，使用现有 design tokens
    - 4.6: 空态"还没有对话"
    - 4.7: 独立 `overflow-y: auto`

- [x] Task 5: 布局接线（App + Home + Chat）
    - 5.1: `App.tsx` 在 `scene in {home, chat}` 时渲染 Sidebar + body 两列布局
    - 5.2: Splash / Install 保持现有全宽居中布局不变
    - 5.3: Sidebar 的 `onCreate` 调 `createConversation()` 并 `setScene('home')`
    - 5.4: Sidebar 的 `onSelect(id)` → 若 conversation 有消息 `setScene('chat')`；否则 `setScene('home')`
    - 5.5: `Home.tsx` 去除可能重复的会话相关 UI，只保留欢迎/空态 + Composer
    - 5.6: `index.css` / `screens.css` 新增 `.layout` / `.sidebar` / `.sidebar-item` / `.sidebar-new` 等样式
    - 5.7: css-line-check 保持单文件 ≤ 600 行（必要时拆到 `sidebar.css` 独立文件）

- [x] Task 6: E2E 与测试更新
    - 6.1: `tests/e2e/mvp-flow.spec.ts` 断言 Sidebar 的"+ 新建对话"按钮可见
    - 6.2: 断言 Enter 直接发送（mock runtime 下）
    - 6.3: 断言 Chat 页 `← 首页` 按钮可见且点击回到 Home
    - 6.4: 断言点击新建对话后回到 Home 且输入框 focus
    - 6.5: 如有 Composer 单测，补 IME 合成期间不发送的用例
    - 6.6: `pnpm test` / `pnpm test:e2e` 全绿

- [x] Task 7: 收尾 · CHANGELOG · pre-commit · 提交
    - 7.1: `CHANGELOG.md` `[Unreleased]` 追加用户可感知变更（Enter 发送 / 返回按钮 / 侧边栏 / 多会话）
    - 7.2: 运行 `pnpm pre-commit`，所有闸门绿
    - 7.3: 按 AGENTS.md §5 的 commit 规范分 3~4 次提交：
      - `feat(renderer): enter to send, shift+enter newline · 对齐行业默认`
      - `feat(renderer): visible back button + chat visual separator · MVP 可用性`
      - `feat(renderer): multi-conversation sidebar · MVP 核心缺口`
      - `test(e2e): cover sidebar + enter-send + back button · 回归保护`
