# Tasks · project-scoped-chat

> 对齐 `doc.md`。每个顶层 Task 为独立可验证的最小单元；先视觉稿闸门，再契约，再主进程，再渲染层，最后 E2E 与收尾。
> Pre-commit 闸门：每完成一个顶层 Task 必须 `pnpm pre-commit` 绿；禁止 `--no-verify`。

- [x] Task 1: 产出视觉稿并对齐（🔴 闸门：未确认前不得进入 Task 3+）
    - 1.1: 按 `docs/playbooks/design-review.md` 产出 Sidebar 分组（空态 / 折叠 / 展开 / active）4 态稿
    - 1.2: 产出 ProjectPicker（默认 / 打开 / 搜索中 / 已选中）4 态稿
    - 1.3: 标注所有 tokens 来源（`--line`、`--panel`、`--accent`、间距、字号、圆角）
    - 1.4: 用户确认后将稿件（或链接）登记到本 spec 目录 `design/` 下

- [x] Task 2: 扩展 IPC 契约（shared + preload + 类型）
    - 2.1: `src/shared/ipc.ts` 新增 `Project` 类型、3 个 channel、`SendPromptArgs.projectId?`、`MorrowApi` 新增 `listProjects/addProject/removeProject`
    - 2.2: `src/app/preload/index.ts` 暴露新方法；更新 `index.d.ts`
    - 2.3: `tests/contract/` 对应用例补 3 个方法签名断言
    - 2.4: `pnpm typecheck` 全绿

- [x] Task 3: 主进程项目存储层
    - 3.1: 新建 `src/app/main/projects-store.ts`：load/save/add/remove/getPath，原子写 + 损坏回退
    - 3.2: 单测 `tests/unit/projects-store.spec.ts`：add 幂等、重复 path 去重、损坏 JSON 回退、备份文件命名
    - 3.3: 绝对路径 normalize + 存在性校验

- [x] Task 4: 主进程 IPC 注册 + cwd 注入
    - 4.1: `src/app/main/ipc.ts` 注册 `projects:list/add/remove`；`add` 调 `dialog.showOpenDialog({ properties: ['openDirectory'] })`
    - 4.2: `sendPrompt` 校验 `projectId`（如有）→ `getProjectPath` → `fs.access` → 传 `cwd`；不接受 renderer 直接传 path
    - 4.3: `src/app/main/runtime-session.ts` `startSession` 增加 `cwd?: string` 参数并透传 `spawn`
    - 4.4: 单测覆盖 cwd 透传与无效 projectId 的 error 路径

- [x] Task 5: Renderer 状态与 App 串联
    - 5.1: `App.tsx` 新增 `projects / activeProjectId` 状态；启动时 `listProjects()` 拉取
    - 5.2: `createConversation` 时把 `activeProjectId` 写入 `conversation.projectId`；`send()` 带上 `projectId`
    - 5.3: 打开既有会话时把 `activeProjectId` 同步为该会话的 `projectId`（只读语义）
    - 5.4: 单测：`Conversation.projectId` 首次定版后不可变

- [x] Task 6: ProjectPicker 组件（新原语）
    - 6.1: 新建 `src/app/renderer/src/components/ProjectPicker.tsx`（按视觉稿）
    - 6.2: 支持：搜索、选中、退出项目、添加新项目（调 `addProject`）
    - 6.3: 已绑定会话下切换为只读+「退出项目」模式
    - 6.4: 单测：搜索过滤、事件回调

- [x] Task 7: Sidebar 分组改造
    - 7.1: `Sidebar.tsx` 按 `projectId` 分组渲染：项目区（可折叠，按 `lastUsedAt desc`）+ 对话区
    - 7.2: 项目 header 展示名称、折叠箭头；尾部「＋ 添加项目」按钮
    - 7.3: 路径不可用项目标记「❗ 不可用」（tooltip 显示完整 path）
    - 7.4: `sidebar.css` 更新（仅使用 tokens）
    - 7.5: 单测：给定数据集的 DOM 结构断言

- [x] Task 8: Home / Chat 挂载 ProjectPicker
    - 8.1: `screens/Home.tsx` 在 Composer 上方挂载 `ProjectPicker`
    - 8.2: `screens/Chat.tsx` 同步挂载（只读态）
    - 8.3: 视觉回归：人工截图对齐 Task 1 视觉稿

- [x] Task 9: E2E 与文档收尾
    - 9.1: `tests/e2e/project-scoped.spec.ts` 新增：添加项目（mock）→ sidebar 项目分支 → 发送 → 会话嵌套 → Chat picker locked；`mvp-smoke.spec.ts` 同步扩展到 7 方法断言
    - 9.2: 手动用 Codex 发 `pwd` 验证输出 = 项目 path（待人工执行）
    - 9.3: `CHANGELOG.md` `[Unreleased]` 追加用户可感知变更
    - 9.4: `pnpm pre-commit` 全绿（**需在 Node ≥ 22 环境下执行**）；`summary.md` 已生成
