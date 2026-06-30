# Summary · channel-role-chat-mvp

## Done

- 新增频道/角色领域模型：`Channel`、`RoleProfile`、`ChannelEvent`、`RoleRun`、`HandoffProposal`。
- 新增 `ChannelsStore` 本地持久化，文件归主进程所有，renderer 只通过 IPC 读写 snapshot。
- 新增 `ChannelOrchestrator`，负责组装角色上下文、解析频道绑定文件夹、启动 Claude Code / Codex runtime，并把 chunk/snapshot 推回 UI。
- 新增受控 handoff：角色回复中提到频道内其他角色时只创建 proposal，必须由用户确认后才启动目标角色。
- 改造 renderer：
  - 左侧收敛为个人对话、群聊频道、AI 队友。
  - 群聊频道支持绑定本地文件夹、添加成员、成员栏折叠。
  - Composer 只在输入 `@` 时显示当前频道角色选择器。
  - 角色创建支持 name / model / intro / instruction，且无频道时也能创建。
  - 角色详情抽屉支持 Chat / Settings，Settings 可编辑指示。

## Validation

- `pnpm check`
- `pnpm lint`
- `pnpm test -- --run`
- `pnpm build`
- `pnpm test:e2e`（沙盒外 Electron，5/5 passed）

## Notes

- 本次没有引入新顶层依赖。
- 当前角色运行仍复用已有 Claude/Codex runtime 能力；角色私聊只是详情入口，未单独做持久化私信线程。
- `.comate/specs/morrow-workspace-roadmap/` 是已有未跟踪原型目录，本次未处理。
