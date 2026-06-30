# Spec · channel-role-chat-mvp

> **分类**：Large（新业务 context + IPC 契约 + 持久化 + runtime orchestration + UI flow）
> **分支**：`codex/channel-role-chat-mvp`
> **基线**：从 `main` 新开，不继续在 `feat/agentic-handoff-workflow` 上叠加

---

## 0. 任务判定

这是 **Large**：

- 新增频道 / 角色 / 角色运行 / 交接建议等业务对象。
- 触达 main / preload / renderer / shared IPC / runtime session / 本地文件夹权限。
- 改变运行时调度方式：从“renderer 直接发 prompt”升级为“频道 orchestrator 生成上下文并启动角色 run”。
- 含用户可见新 flow：新建群聊、绑定文件夹、新建角色、@ 角色、查看角色设置。

视觉稿前置闸门：🔴 新 Flow / 布局重构。

- 视觉稿载体：HTML 原型 `/Users/songhuiyu/Morrow/.comate/specs/channel-role-chat-mvp/prototype/v2/index.html`
- 用户视觉确认：已确认进入开发；需落实两条最后反馈：
  - 顶部右侧不放“添加角色 / 新建群聊”，入口收敛到左侧导航。
  - Composer 下方不常驻角色 chip；只有输入 `@` 时弹出当前频道角色选择器。

---

## 1. 背景与目标

Morrow 的定位不是一个团队 SaaS，而是**基于个人本地电脑的 AI 工作空间**：

- 用户可以继续使用单人对话。
- 当需要多个视角时，可以进入一个群聊频道，让 AI 队友发表建议。
- 频道可以绑定本地文件夹；频道里的 AI 回复必须基于该文件夹作为工作上下文。
- AI 队友不是简单标签，而是有可编辑的「指示」：它决定角色 prompt。

旧分支 `feat/agentic-handoff-workflow` 提供了有价值的 spike：

- 角色 profile / systemPrompt
- `@` mention 解析
- channel event / workflow run / handoff 的雏形
- Codex / Claude runtime 基础调用

但旧分支的产品重心偏“任务发布 / 抢单 / handoff 工作流”，不适合直接延续。本 MVP 要从 `main` 做一个更窄、更稳定的实现。

---

## 2. 外部参考与裁剪

| 参考 | 可借鉴点 | Morrow 裁剪 |
|---|---|---|
| [OpenAI Agents SDK Handoffs](https://openai.github.io/openai-agents-python/handoffs/) | handoff 是显式能力，不是普通聊天文本；可携带上下文和 metadata | MVP 不引入 SDK，仅借鉴“handoff 是结构化事件”的思想 |
| [AutoGen SelectorGroupChat](https://microsoft.github.io/autogen/0.4.4/user-guide/agentchat-user-guide/selector-group-chat.html) | 多 agent 共享上下文，由 selector 决定下一位发言者 | MVP 不做自动 speaker selector，先由 `@` 和用户确认的 handoff 驱动 |
| [LangGraph handoffs](https://docs.langchain.com/oss/python/langchain/multi-agent/handoffs) | 多 agent 流程应显式更新 state，控制上下文传递 | 不引入 LangGraph；用本仓库 DDD context + append-only event store 表达 state |
| [MCP Roots](https://modelcontextprotocol.io/specification/2025-06-18/client/roots) | root 定义工具/模型可访问的文件系统边界 | Morrow 的 `Channel.folderProjectId` 就是频道 root；renderer 禁止直接传 cwd |

结论：采用 **频道事件流 + 角色运行器 + 受控 handoff**。

---

## 3. 产品范围

### In Scope

1. 左侧导航保留：
   - `+ 新建对话`
   - `# 新建群聊`
   - 个人对话列表
   - 群聊频道列表
   - AI 队友列表
2. 新建群聊：
   - 输入频道名
   - 选择本地文件夹
   - 可选择初始 AI 队友
3. 新建角色：
   - 显示名称
   - 模型：`Claude Code` / `Codex`
   - 简介：用于列表识别
   - 指示：角色 prompt 的核心定义，必填，可随时查看修改
   - 可选择加入已有频道；没有频道时也允许先创建角色
4. 群聊：
   - 输入普通消息只进入频道。
   - 输入 `@` 时弹出当前频道角色选择器。
   - 发送后，只有被 @ 的角色启动 `RoleRun`。
   - 角色回复进入同一频道事件流。
5. 角色详情：
   - `Chat`
   - `Settings`
   - Settings 可编辑名称、模型、简介、指示。
6. 频道成员：
   - 默认收起。
   - 用户点击顶部“频道成员”展开/收起。
7. 文件夹上下文：
   - 每个频道绑定一个本地 folder root。
   - 角色运行必须在该 root 下启动 runtime。

### Out of Scope

- ❌ 任务发布 / 抢单 / bid / active task 面板。
- ❌ 能力标签。
- ❌ 自动全员回复。
- ❌ 未经用户确认的无限自动 handoff。
- ❌ Memory / Skills / Activity / Calendar 等多 tab。
- ❌ 多用户组织、权限、云同步。
- ❌ 新依赖（LangGraph / AutoGen / Agents SDK）引入。

---

## 4. 领域模型

### 4.1 Durable Facts

```ts
export interface Channel {
  id: string;
  name: string;
  description: string;
  folderProjectId: string | null;
  memberRoleIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface RoleProfile {
  id: string;
  name: string;
  intro: string;
  instruction: string;
  defaultRuntime: RuntimeId;
  createdAt: number;
  updatedAt: number;
}

export interface ChannelEvent {
  id: string;
  channelId: string;
  type:
    | 'message_posted'
    | 'role_run_started'
    | 'role_message_posted'
    | 'role_run_failed'
    | 'handoff_proposed'
    | 'handoff_accepted'
    | 'role_joined'
    | 'folder_bound';
  authorType: 'user' | 'role' | 'system';
  roleId?: string;
  runId?: string;
  handoffId?: string;
  text?: string;
  createdAt: number;
}

export interface RoleRun {
  id: string;
  channelId: string;
  roleId: string;
  trigger: 'mention' | 'handoff_accept';
  triggerEventId: string;
  inputText: string;
  status: 'running' | 'done' | 'failed' | 'canceled';
  runtime: RuntimeId;
  createdAt: number;
  updatedAt: number;
}

export interface HandoffProposal {
  id: string;
  channelId: string;
  fromRoleId: string;
  toRoleId: string;
  sourceRunId: string;
  reason: string;
  instruction: string;
  status: 'proposed' | 'accepted' | 'canceled';
  createdAt: number;
  updatedAt: number;
}
```

说明：

- `folderProjectId` 复用现有 `ProjectsStore`。频道存 project id，不存 renderer 传来的 path。
- `RoleProfile.instruction` 是角色 prompt 的核心输入，不是展示文案。
- `ChannelEvent` 是 UI 时间线的唯一事实源。
- `RoleRun` 是 runtime 执行状态，不直接等于一条消息。
- `HandoffProposal` 是建议，MVP 需要用户确认后才会启动目标角色。

### 4.2 State Ownership

| 状态 | Owner | 持久化 | 说明 |
|---|---|---|---|
| `Project.path` | `ProjectsStore` | 是 | 现有项目/文件夹 owner；renderer 只传 project id |
| `Channel / Role / Event / Run / Handoff` | `ChannelsStore` | 是 | 新增 `contexts/channels` |
| role runtime process | `ChannelOrchestrator` in main | 否 | runtime observation，断线后不会伪装成已完成 |
| composer 输入、mention menu 开关、drawer tab | renderer | 否 | UI projection |
| 个人对话 | 现有 renderer App state | 否 | 本次不扩大个人对话持久化范围 |

### 4.3 不变量

1. **频道 root 不变量**：任何角色运行的 `cwd` 必须由 `channel.folderProjectId -> ProjectsStore.getAccessiblePath()` 解析得到；renderer 不能传 path/cwd。
2. **角色 prompt 不变量**：角色运行时必须包含当前 `role.instruction`，并且 instruction 缺失的角色不能被创建或运行。
3. **事件流不变量**：用户消息、角色启动、角色输出、错误、handoff 建议都必须先成为 durable event；UI 只渲染 snapshot，不自行制造业务事实。

---

## 5. 架构方案

### 5.1 Context 划分

新增 `src/contexts/channels/`：

```text
src/contexts/channels/
  domain/
    channel-types.ts
    role-mentions.ts
    channel-invariants.ts
    handoff-detection.ts
  application/
    role-context-envelope.ts
    channel-orchestrator.ts
    channel-ports.ts
  infrastructure/
    channels-file.ts
    channels-store.ts
```

职责：

- `domain`：实体类型、mention 解析、不变量、handoff proposal 解析。
- `application`：生成角色上下文、创建 RoleRun、协调 store + runtime。
- `infrastructure`：JSON 文件持久化，原子写。

### 5.2 IPC 增量

新增 `src/shared/channel-ipc.ts`，并由 `src/shared/ipc.ts` re-export：

```ts
channels: {
  getSnapshot(): Promise<ChannelsSnapshot>;
  createChannel(args: CreateChannelArgs): Promise<ChannelsSnapshot>;
  createRole(args: CreateRoleArgs): Promise<ChannelsSnapshot>;
  updateRole(args: UpdateRoleArgs): Promise<ChannelsSnapshot>;
  addRoleToChannel(args: AddRoleToChannelArgs): Promise<ChannelsSnapshot>;
  postMessage(args: PostChannelMessageArgs): Promise<ChannelsSnapshot>;
  acceptHandoff(args: AcceptHandoffArgs): Promise<ChannelsSnapshot>;
  onEvent(listener: (event: ChannelUiEvent) => void): () => void;
}
```

`postMessage` 的副作用：

1. append user `message_posted`
2. parse mentions against current channel members
3. for each mentioned role:
   - create `RoleRun`
   - append `role_run_started`
   - orchestrator starts runtime
4. return updated snapshot immediately
5. runtime chunks / final message later通过 `channels:on-event` 推给 renderer，并持久化到 store

### 5.3 RoleContextEnvelope

角色运行时 prompt 由 application 层统一生成：

```text
你是 Morrow 本地工作空间中的 AI 队友。

角色：
- 名称：{role.name}
- 简介：{role.intro}
- 指示：
{role.instruction}

频道：
- 名称：#{channel.name}
- 绑定文件夹：{folder.path}
- 成员：{member roles}

最近上下文：
{last N channel events}

本次用户消息：
{trigger input}

回复要求：
- 只代表自己的角色发言。
- 如果需要另一个角色继续，请在回复末尾明确建议 @目标角色，并说明原因和交接输入。
- 不要声称已经读取或修改文件，除非 runtime 实际完成了相关动作。
```

MVP 的上下文来源：

- 最近 12 条频道事件。
- 当前频道成员列表。
- folder path 作为可见上下文。
- 暂不做 embedding / repo index / memory。

### 5.4 Handoff 机制

MVP 采用**受控 handoff**：

- 角色回复中如果明确提到频道内其他角色，例如 `@工程师`，domain 层把它解析为 `HandoffProposal`。
- UI 显示“建议让工程师接着看”的卡片。
- 用户点击接受后，才创建目标角色的 `RoleRun`。
- 不做 role -> role -> role 的自动链式执行。

这能满足“角色在合适时机主动 @ 其他角色”，但避免模型互相循环。

### 5.5 文件夹上下文

频道创建时：

1. renderer 调用 `channels.createChannel`。
2. 如果用户要绑定文件夹，main 打开系统 folder dialog 或复用 ProjectsStore 的 add flow。
3. `Channel.folderProjectId` 持久化。

角色运行时：

```ts
const path = await projects.getAccessiblePath(channel.folderProjectId);
if (!path) {
  append role_run_failed event;
  return;
}
runtime.startSession({ cwd: path, prompt, ... });
```

无 folder 的频道：

- 可以聊天。
- 角色运行使用现有 `no-project-cwd` 隔离目录。
- UI 明确显示“未绑定文件夹”，避免用户误以为基于某个项目。

---

## 6. UI / 交互设计

### 6.1 布局

- 左侧：新建对话、新建群聊、个人对话、群聊频道、AI 队友。
- 中间：当前聊天。
- 右侧：频道成员 drawer/panel，默认收起。
- 顶部右侧：只保留当前模型/状态、频道成员开关；不放新建群聊、添加角色。

### 6.2 Composer

- 默认只显示 textarea + 发送按钮。
- 输入 `@` 时，弹出当前频道成员选择器。
- 选择后插入 `@角色名 `。
- 不在 composer 底部常驻 `@设计师 @工程师` chip。

### 6.3 四态

| 状态 | 设计 |
|---|---|
| Default | 展示频道事件流，成员栏默认收起 |
| Empty | 无频道时提示“新建群聊或继续个人对话”；无角色时提示“先新建 AI 队友” |
| Loading | snapshot 加载、角色 run streaming 时显示角色消息 pending |
| Error | folder 不可访问、runtime 未安装、角色 run 失败都作为频道系统事件展示 |

### 6.4 键盘

- `@` 打开 mention menu。
- 上下键切换角色。
- Enter 选中 mention；普通 Enter 发送。
- Esc 关闭 mention menu / drawer。

---

## 7. 受影响文件

预计新增：

- `src/shared/channel-ipc.ts`
- `src/contexts/channels/domain/channel-types.ts`
- `src/contexts/channels/domain/role-mentions.ts`
- `src/contexts/channels/domain/channel-invariants.ts`
- `src/contexts/channels/domain/handoff-detection.ts`
- `src/contexts/channels/application/role-context-envelope.ts`
- `src/contexts/channels/application/channel-orchestrator.ts`
- `src/contexts/channels/application/channel-ports.ts`
- `src/contexts/channels/infrastructure/channels-file.ts`
- `src/contexts/channels/infrastructure/channels-store.ts`
- `src/app/renderer/src/screens/ChannelWorkspace.tsx`
- `src/app/renderer/src/components/ChannelComposer.tsx`
- `src/app/renderer/src/components/ChannelSidebarSections.tsx`
- `src/app/renderer/src/components/RoleDrawer.tsx`
- `src/app/renderer/src/components/ChannelMembersPanel.tsx`
- `src/app/renderer/src/channel-workspace.css`
- unit / contract / integration / e2e tests

预计修改：

- `src/shared/ipc.ts`
- `src/app/main/ipc.ts`
- `src/app/main/ipc-validate.ts`
- `src/app/preload/index.ts`
- `src/app/preload/index.d.ts`
- `src/app/renderer/src/App.tsx`
- `src/app/renderer/src/components/Sidebar.tsx`
- `src/app/renderer/src/sidebar.css`
- `src/app/renderer/src/screens.css`
- `CHANGELOG.md`

不修改：

- `AGENTS.md`
- `DEVELOPMENT.md`
- CI / release 配置
- 新顶层依赖

---

## 8. 风险与处理

| 风险 | 处理 |
|---|---|
| role run 并发导致状态乱序 | `RoleRun.status` + event append；每个 run 独立 sessionId |
| folder 删除或无权限 | main 解析 cwd 失败，写 `role_run_failed` event，不启动 runtime |
| runtime stream 失败 | 保存失败事件；pending UI 结束 |
| 模型无限 @ 其他角色 | role output 只创建 `HandoffProposal`，用户确认才继续 |
| renderer 状态伪造 cwd | IPC 不接受 path，只接受 channelId / projectId，由 main 查表 |
| prompt 太长 | MVP 只取最近 12 条事件；后续再做 summary |
| 当前个人对话仍是内存态 | 本次不扩大个人对话持久化，避免 scope 膨胀 |

---

## 9. 验证方式

### Unit

- mention parser：只匹配当前频道角色。
- handoff detection：角色回复中 `@工程师` 生成 proposal，不自动启动 run。
- role context envelope：包含 role instruction、频道成员、最近事件、folder path。
- invariants：无 instruction 不能创建角色；role 不在 channel 不能被 @ 激活。

### Contract

- IPC validator 拒绝空 name / 空 instruction / 无效 runtime / unknown channel。
- preload API shape 包含 `channels.*`。

### Integration

- `ChannelsStore` 原子持久化。
- `postMessage` append user event + 创建 mentioned role run。
- folder unavailable 时写失败 event。

### E2E

- 新建频道并绑定文件夹。
- 新建角色，填写 `instruction`。
- 输入 `@` 打开角色选择器，选择角色并发送。
- 角色消息流式进入频道。
- 角色 Settings 可查看/修改 instruction。
- 频道成员栏可收起/展开。

### Full Gate

实现完成后跑：

```bash
pnpm pre-commit
```

---

## 10. 决策记录

### 采纳方案

从 `main` 新开分支，做新的 channel-role-chat MVP；旧 handoff 分支只作为参考。

### 替代方案

1. **继续在 `feat/agentic-handoff-workflow` 上改**
   - 优点：已有大量代码。
   - 缺点：任务/bid/capabilities 概念污染 MVP，需要大量反向删除。
2. **直接引入 LangGraph / AutoGen**
   - 优点：多 agent 编排成熟。
   - 缺点：引入新依赖和新 mental model，超出 MVP；本地 Claude/Codex CLI 也不天然适配。
3. **renderer 直接拼 prompt 调 runtime**
   - 优点：实现快。
   - 缺点：cwd、上下文、event 持久化和并发状态无法可靠治理。

---

## 11. 当前结论

先做一个窄而稳的 MVP：

> 用户在本地文件夹绑定的频道里 `@角色`，Morrow 用角色 instruction + 频道事件 + folder root 生成上下文，启动对应本地 runtime，并把结果作为频道事件保存。角色可以建议 @ 其他角色，但必须由用户确认后继续。

等待用户确认后进入 `tasks.md` 的执行阶段。

