# Summary: MVP UX Fixes

## 目标回顾

MVP（`agent-runtime-mvp`）跑通后用户试用，报告 4 个阻塞可用性问题：

1. Chat 页 AI 响应与 Composer 视觉混淆
2. 进入 Chat 后无可视"返回"入口
3. 没有会话侧边栏 / 多会话 / 新建入口
4. Enter 键不发送，只能点击按钮

本 SDD 按 `doc.md` → `tasks.md` → 执行 → `summary.md` 走完整流程。

## 交付物

### 代码
- `src/app/renderer/src/components/Composer.tsx` — Enter 发送契约 + IME 兜底
- `src/app/renderer/src/components/Sidebar.tsx` — **新增** 260px 会话栏 + `formatRelativeTime` 纯函数
- `src/app/renderer/src/App.tsx` — 状态模型从 `messages[]` 重构为 `conversations[] + activeId + streamingRef{convId,aiId,sid}`；`back()` 语义改为只切视图；顶部返回按钮
- `src/app/renderer/src/screens/Chat.tsx` — streaming hint 文案调整
- `src/app/renderer/src/screens/Home.tsx` — hint 文案调整
- `src/app/renderer/src/index.css` — 返回按钮样式
- `src/app/renderer/src/screens.css` — 两列布局 + Sidebar 样式 + composer 分割线

### 测试
- `tests/e2e/mvp-smoke.spec.ts` — 扩展断言覆盖新 UX（Sidebar 可见 / Enter 发送 / 会话标题派生 / `← 首页` / 新建对话）
- `tests/unit/sidebar-time.spec.ts` — **新增** `formatRelativeTime` 5 档场景

### 文档
- `CHANGELOG.md` — `[Unreleased]` 追加用户可感知变更
- `.comate/specs/mvp-ux-fixes/{doc.md, tasks.md, summary.md}`

## 关键决策

1. **返回首页不打断流式** — 允许用户在后台流式运行期间切出管理多会话；符合 ChatGPT/Claude 的行业实践
2. **跨会话流式允许并发，单会话内串行** — `runtime-session` 主进程本就按 `sessionId` 管子进程；前端 `streamingRef` 只锁定当前 aiId
3. **`toSorted` 受 tsconfig `ES2022` 目标限制** — 改用 `[...arr].sort` + oxlint 抑制，避免为一个语法糖升 lib target
4. **不持久化会话** — 明确划入后续独立 SDD `conversation-persistence`；本轮内存态即可验证 UX
5. **Composer IME 兜底** — `isComposing || keyCode === 229` 双条件，覆盖部分输入法只报 229 的历史行为

## 验证

| 闸门 | 结果 |
|---|---|
| `pnpm line-check:staged` | ✅ |
| `pnpm secret-check:staged` | ✅ |
| `pnpm naming-check:staged` | ✅ (规则 TBD) |
| `pnpm lint:fix` (oxlint) | ✅ 0 warning / 0 error |
| `pnpm format-check:staged` | ✅ |
| `pnpm check` (tsc) | ✅ |
| `pnpm test` (vitest) | ✅ 23/23 |
| `pnpm test:e2e` (Playwright) | ✅ 1/1 · 5.8s |
| `pnpm build` | ✅ main/preload/renderer 全部产出 |

## 风险与后续

- **已知限制**：会话关闭 app 后丢失（内存态）
- **未开放**：会话重命名 / 删除 / 搜索 / Sidebar 折叠 / 持久化
- **下一个推荐 SDD**：`conversation-persistence`（落盘 `~/.morrow/conversations.json` + 读写封装 + 迁移策略）

## 交互问题闭环

| 用户报告 | 解决位置 |
|---|---|
| ① Chat 视觉混淆 | `screens.css` composer-wrap::before 分割线 + hint 文案 `● streaming · Esc 中止` |
| ② 返回入口缺失 | `App.tsx` `.top` 左侧 `← 首页` 按钮 + `back-btn` 样式 |
| ③ 侧边栏 / 多会话 / 新建 | `Sidebar.tsx` + `App.tsx` 状态重构 |
| ④ Enter 不发送 | `Composer.tsx` keydown 契约切换 |
