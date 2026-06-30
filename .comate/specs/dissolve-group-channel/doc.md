# Spec: 解散群聊频道

## 1. 需求背景与约束

- 当前群聊频道只能新建，不能解散，侧边栏会累积无用频道。
- 用户要求新开 worktree 和分支执行；当前 worktree 为 `/Users/songhuiyu/Morrow-dissolve-group-channel`，分支 `codex/dissolve-group-channel`。
- 这是用户可见的新操作路径，涉及持久化删除、IPC 契约、运行中角色任务生命周期，按 Large 处理。
- 不引入新依赖，不修改 CI / 发布配置，不改变角色删除语义。

## 2. 行业参考与取舍

| 参考 | 模式 | 对 Morrow 的启发 |
|---|---|---|
| [Slack: Archive or delete a channel](https://slack.com/intl/en-gb/help/articles/213185307-Archive-or-delete-a-channel) | 删除频道是破坏性操作，删除前强调永久移除和消息历史影响，并要求显式确认。 | Morrow 目前没有归档能力，本次只做“解散”，必须说明消息和运行记录会移除。 |
| [Discord: How do I delete a channel?](https://support.discord.com/hc/en-us/articles/206343258?page=1) | 入口靠近频道设置，删除前用强警告确认不可恢复。 | 入口放在频道条目附近，确认弹层使用“无法撤销”的直接文案。 |

Adapt:
- Morrow 是本地个人工作空间，当前没有 workspace owner/admin 权限模型，因此不增加权限分层。
- 本次不做“归档”，避免在持久化层引入半删除状态和恢复入口。
- 可见文案采用“解散群聊”，不用“删除频道”作为主文案，贴合当前产品语言。

## 3. 业务逻辑与验收标准

用户可以从群聊列表对单个群聊执行“解散群聊”。确认后：

- 该群聊从侧边栏移除。
- 如果当前正在查看这个群聊，主区域回到“选择或新建一个群聊”的空态。
- 该群聊的消息、系统事件、角色运行记录、交接记录一并从持久化快照移除。
- AI 队友角色本身保留，其他群聊成员关系不受影响。
- 该群聊里正在运行的角色任务被取消或忽略后续回写，不再把输出写回已解散群聊。

验收:
- 新建群聊后能解散；刷新快照后不再出现。
- 解散包含历史消息和 handoff 的群聊时，相关记录不残留。
- 解散包含运行中 role run 的群聊时，后续 runtime done/error 不会抛错或恢复频道。
- 文案不使用“删除频道”作为按钮主语；危险确认按钮为“确认解散”。

## 4. 状态所有权、不变量、边界

状态所有权:
- 群聊 durable truth 由 `src/contexts/channels/infrastructure/channels-store.ts` 拥有，文件承载是 `channels.json`。
- Renderer 里的 `activeChannelId` 是 UI projection，只能跟随 snapshot 调整，不能定义删除语义。
- Runtime session 是运行时观察值，由 main/runtime owner 管理；群聊删除只传递需要 abort 的 run id。

不变量:
- `ChannelSnapshot.channels` 中不存在已解散群聊。
- `events/runs/handoffs` 不引用已解散群聊。
- 角色列表不因解散群聊而减少。

边界:
- Renderer 只能调用 `window.morrowApi.channels.deleteChannel({ channelId })`。
- Preload 只做白名单桥接。
- Main IPC 对 payload 做 runtime validate，再调用 application/usecase。
- Store 层校验 channel 是否存在，并负责原子持久化。

## 5. 架构与技术思路

新增共享契约:
- `DeleteChannelArgs { channelId: string }`
- `ChannelsApi.deleteChannel(args): Promise<ChannelSnapshot>`
- IPC channel `channels:delete-channel`

新增应用语义:
- `ChannelsStore.deleteChannel(args)` 返回 `{ snapshot, runIdsToAbort }`。
- `ChannelOrchestrator.deleteChannel(args)` 调 store，逐个 abort 运行中 run，再 emit snapshot。
- `completeRoleRun` / `failRoleRun` 对已不存在的 run 做 no-op，覆盖“删除后 runtime 才回调”的异步 gap。

持久化删除策略:
- 从 `channels` 移除目标 channel。
- 从 `events/runs/handoffs` 移除目标 channelId 相关记录。
- 删除前收集目标 channel 中 `status === 'running'` 的 run id，交给 runtime abort。

## 6. 受影响文件清单

| 路径 | 操作 | 影响点 |
|---|---|---|
| `src/shared/channel-ipc.ts` | 修改 | 新增 DeleteChannelArgs 和 API 方法 |
| `src/shared/ipc.ts` | 修改 | 导出类型并增加 IPC channel |
| `src/app/preload/index.ts` | 修改 | real/mock API 增加 deleteChannel |
| `src/app/main/ipc-validate.ts` | 修改 | 新增 delete channel payload 校验 |
| `src/app/main/ipc.ts` | 修改 | 注册 `channels:delete-channel` handler |
| `src/contexts/channels/application/*` | 修改 | usecase 负责 abort 运行中 run |
| `src/contexts/channels/infrastructure/channels-store.ts` | 修改 | 删除群聊及关联数据 |
| `src/app/renderer/src/lib/use-channel-workspace.ts` | 修改 | 调用 deleteChannel 并清理 activeChannelId |
| `src/app/renderer/src/components/Sidebar.tsx` | 修改 | 群聊行增加解散入口 |
| `src/app/renderer/src/components/WorkspaceDialogs.tsx` | 修改 | 增加解散确认弹层 |
| `src/app/renderer/src/App.tsx` | 修改 | 串接 delete handler 和确认弹层 |
| `src/app/renderer/src/*.css` | 修改 | 复用现有按钮/弹层样式，补最小布局 |
| `tests/**` | 修改 | contract / integration / unit / e2e 覆盖 |
| `CHANGELOG.md` | 修改 | 用户可见变更记录 |

## 7. 视觉与交互设计

档位判定:
- 新增“解散群聊”确认路径，按 `DESIGN.md §9` 视作新 Flow，🔴 需要前置视觉稿。

视觉稿:
- v1 HTML 原型：`.comate/specs/dissolve-group-channel/prototype/v1/index.html`
- 当前指针：`.comate/specs/dissolve-group-channel/prototype/latest.txt`
- 用户视觉确认：[x] 已确认 · v1

入口:
- 群聊条目 hover/focus 时显示一个小型危险操作，文案和 aria 为“解散群聊 {name}”。
- 点击主行仍然选择群聊，点击解散入口不触发选择。

确认弹层文案:
- 标题：`解散 #general？`
- 正文：`这个群聊会从侧边栏移除，群聊消息、交接记录和运行记录会一并删除。AI 队友本身不会删除。此操作无法撤销。`
- 次按钮：`取消`
- 危险按钮：`确认解散`
- 提交中：`解散中…`

四态:
- Default：群聊列表中每个条目可选择，hover/focus 暴露“解散群聊”入口。
- Empty：没有群聊时仍显示“还没有群聊”，无解散入口。
- Loading：确认后危险按钮显示“解散中…”，按钮禁用，避免重复提交。
- Error：如果 IPC/store 抛错，弹层保留，并展示“解散失败，请稍后重试。”。

极端态:
- 超长群聊名继续 ellipsis，确认弹层标题允许换行。
- 成员数 0 的群聊也可解散。
- 1000+ 群聊沿用现有滚动列表，本次不引入虚拟化。

键盘:
- Tab 可聚焦群聊主按钮和解散按钮。
- Enter/Space 触发解散按钮。
- 弹层内 Escape/取消关闭，确认按钮可键盘触发。

动效:
- 只使用现有 hover/focus 过渡，目的为状态转换。
- 不新增动效 token。

## 8. 风险与合规

- Async Gap Safety：删除运行中群聊后，runtime late callback 需要 no-op，不能恢复已删除数据。
- Concurrency & Race：重复点击通过提交中禁用处理；store 删除未知 channel 抛错。
- Restart / Recovery：持久化使用现有 tmp+rename 原子写；重启后不存在已解散群聊及关联记录。
- IPC Security：新增 payload 校验，只接受非空 string channelId。
- Resource Lifecycle：运行中 role run 的 sessionId 使用 run.id，delete usecase 负责 abort。
- Compliance：不触碰外部 API、隐私凭证或新许可证。

## 9. 验证方式

定向验证:
- `pnpm test -- --run tests/contract/channels-validate.spec.ts`
- `pnpm test -- --run tests/contract/preload-api-shape.spec.ts`
- `pnpm test -- --run tests/integration/channels-store.spec.ts`
- `pnpm test -- --run tests/integration/channel-orchestrator.spec.ts`
- `pnpm test -- --run tests/unit/sidebar-dom.spec.tsx`
- `pnpm build`
- `pnpm test:e2e tests/e2e/channel-role-mvp.spec.ts`

收尾验证:
- 按仓库要求 staged 后运行 `pnpm pre-commit`。
- UI 相关执行 design-review Phase 1：四态截图、50% 缩小、灰度、键盘全流程。

## 10. 非目标

- 不做频道归档/恢复。
- 不做批量解散。
- 不做权限模型。
- 不保留已解散群聊的历史消息。
- 不改角色删除的既有文案和行为。
