# Summary · project-scoped-chat

## 目标

让对话可绑定到本地文件夹：用户在 Sidebar/Composer 处选择项目，随后会话及其 CLI 子进程 cwd
都归属该项目；不选则保持 MVP 的"无项目"行为。

## 产物

### IPC 契约（`src/shared/ipc.ts`）
- 新增 `Project { id, name, path, createdAt, lastUsedAt, invalid? }`
- `SendPromptArgs.projectId?: string | null`
- 新 channel：`projectsList / projectsAdd / projectsRemove`
- `MorrowApi` 扩展 `listProjects / addProject / removeProject`（共 7 方法）

### 主进程
- `src/app/main/projects-store.ts`（新）
  - JSON 存储于 `<userData>/projects.json`，原子写（tmp→rename）
  - 加载失败自动备份 `.bak-<ts>` 并以空列表恢复
  - `getAccessiblePath(id)`：`fs.access` 校验 + 返回绝对路径，源头级 fallback
- `src/app/main/ipc.ts`
  - 3 个 handler；`add` 通过 `dialog.showOpenDialog({ properties: ['openDirectory'] })`
  - `sendPrompt` 接收 `projectId` 时在主进程解析为 cwd，不接受 renderer 直传路径
- `src/app/main/runtime-session.ts`
  - `startSession` 签名加 `cwd?: string | null`；若存在则注入 `spawn` 的 options.cwd
  - 未传时保留原有行为（继承主进程 cwd）

### 渲染层
- `src/app/renderer/src/App.tsx`
  - 新增 `projects / activeProjectId`；启动 `listProjects()`
  - `send()` 首次用户消息时把 `activeProjectId` 定版到 `conversation.projectId`
  - 切换会话 → `activeProjectId` 同步为该会话的 `projectId`
  - `pickerLocked` 派生自"会话是否已有 user 消息"
- `src/app/renderer/src/components/ProjectPicker.tsx`（新原语）
  - 默认 / 搜索 / 选中 / 已锁定 四态；选中即调用 `addProject` 或 `onSelect`
- `src/app/renderer/src/components/Sidebar.tsx`
  - 两段分组：项目（按 `lastUsedAt desc`，可折叠；含 active 会话时强制展开）+ 对话（`projectId===null`）
  - 项目不可访问时打 `invalid` 标记与 ❗ 徽标
  - 样式全部走 `index.css` tokens（无新增硬编码）
- `screens/Home.tsx` / `screens/Chat.tsx` 挂载 `ProjectPicker`

### 测试
- 契约：`tests/contract/preload-api-shape.spec.ts`（7 方法签名）
- 契约：`tests/contract/runtime-session-cwd.spec.ts`（node 环境 + `vi.mock('node:child_process')` 劫持 spawn，断言 cwd 透传/缺省）
- 集成：`tests/integration/projects-store.spec.ts`（7 个用例：load/add 去重/remove/损坏恢复/访问校验）
- DOM：`tests/unit/sidebar-dom.spec.tsx`、`tests/unit/project-picker.spec.tsx`
- E2E：`tests/e2e/project-scoped.spec.ts`（preload mock 驱动：add → pick → send → nested → locked）

### 文档
- `CHANGELOG.md` `[Unreleased]`：用户可感知变更描述
- 本 spec 下：`doc.md` / `tasks.md` / `design/visual-spec.md` / `summary.md`

## 验收

- ✅ `pnpm pre-commit` 全绿（Node 22 环境）：9 vitest 文件 / 64 case；2 playwright 用例通过
- ⏳ 手动用例（Task 9.2）：Codex 发 `pwd` 应输出项目 path —— 由人工在真实环境执行

## 关键设计权衡

- **项目所有权归主进程**：`projects.json` 只在主进程读写；renderer 永远只拿快照。
  防止 renderer 绕过 `fs.access` 直接把非授权路径当 cwd。
- **项目 id vs path 作为 IPC 参数**：选 id，主进程负责 resolve。这样 renderer 永远
  接触不到绝对路径的验证责任，符合 AGENTS.md 的"边界校验，内部信任"。
- **会话 projectId 定版点**：在首次用户消息时，而非创建会话时。这样让用户在发送前
  还能自由切换 picker；发送之后锁死，避免"一个会话横跨多个项目"的语义漂移。
- **ProjectBranch 展开状态**：`expanded = userExpanded || hasActive`。当用户先添加项目
  再发送第一条消息时，新会话会自动挂到项目分支下并展开；不依赖 useEffect 副作用。
- **child_process mock 策略**：vitest 默认 happy-dom 环境会破坏 `node:child_process`
  的 stream 行为；cwd 契约测试单独标 `@vitest-environment node`，并用 `vi.hoisted` +
  `vi.mock` 注入 spawn 桩（`importOriginal` 保留其它导出）。

## 后续

- 项目名编辑、排序策略（按 lastUsedAt vs 字典序切换）未纳入本轮。
- "最近项目" top-N 折叠 / pinned 后续在独立 SDD 处理。
- Task 9.2 的 `pwd` 手验在集成到真实 codex-cli 时执行；结果更新到 CHANGELOG
  或独立的手动验证记录。
