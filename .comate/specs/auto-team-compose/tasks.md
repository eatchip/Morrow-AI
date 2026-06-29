# Tasks · auto-team-compose

> 基于 `doc.md` 拆分的独立可验证任务。执行顺序自顶向下；每个任务完成后留一次 commit。
> 工作目录：`/Users/songhuiyu/Morrow/`

- [ ] Task 1: Domain 层 — 类型扩展 + Morrow 系统角色 seed
    - 1.1: `src/shared/channel-ipc.ts` 新增 `TeamProposal` 接口、`team_proposal_posted` / `team_proposal_confirmed` 事件类型、`ConfirmTeamProposalArgs` / `DismissTeamProposalArgs`、ChannelsApi 增量
    - 1.2: `src/shared/ipc.ts` 新增 IPC_CHANNELS 条目
    - 1.3: `src/contexts/channels/infrastructure/channels-file.ts` 新增 Morrow seed 角色 + ChannelsFile.teamProposals 字段 + normalize 逻辑
    - 1.4: 验证：`pnpm typecheck` 通过

- [ ] Task 2: Store 层 — TeamProposal CRUD + 系统角色保护
    - 2.1: `channels-store.ts` 新增 `createTeamProposal()`、`confirmTeamProposal()`、`dismissTeamProposal()`
    - 2.2: `channels-store.ts` 的 `deleteRole()` 拒绝 `role-morrow`
    - 2.3: `getSnapshot()` 返回 teamProposals
    - 2.4: 验证：`pnpm test` 通过

- [ ] Task 3: Orchestrator 层 — Morrow run 输出解析
    - 3.1: `channel-orchestrator.ts` 在 `completeRoleRun` 回调后检测 roleId === 'role-morrow'
    - 3.2: 提取 JSON（支持 ```json 包裹），解析为 TeamProposal，调 store.createTeamProposal
    - 3.3: 解析失败则不做任何额外处理（保持 role_message_posted 原样展示）
    - 3.4: 验证：`pnpm test` 通过

- [ ] Task 4: IPC 层 — 注册 confirm/dismiss handler + validate
    - 4.1: `ipc-validate.ts` 新增 `validateConfirmTeamProposalArgs` / `validateDismissTeamProposalArgs`
    - 4.2: `ipc.ts` 注册 `channels:confirm-team-proposal` / `channels:dismiss-team-proposal` handler
    - 4.3: `preload/index.ts` bridge 增量
    - 4.4: 验证：`pnpm typecheck` 通过

- [ ] Task 5: Renderer 层 — TeamProposalCard 组件 + 渲染
    - 5.1: `ChannelWorkspace.tsx` 新增 TeamProposalCard（复用 handoff-card 样式）
    - 5.2: `ChannelTimelineItem` 识别 `team_proposal_posted` 事件并渲染卡片
    - 5.3: 确认/忽略按钮调用 IPC
    - 5.4: `channel-workspace.css` 新增必要样式（尽量复用 .handoff-card）
    - 5.5: 验证：`pnpm build` 通过

- [ ] Task 6: 全量闸门 + CHANGELOG
    - 6.1: `pnpm pre-commit` 全量通过
    - 6.2: 更新 `CHANGELOG.md` [Unreleased]
