# Spec · auto-team-compose

> **分类**：Large（新业务流程 + IPC 契约增量 + Orchestrator 逻辑分支 + 新 UI 组件）
> **分支**：`main`（单会话串行）
> **基线**：`main` HEAD（`1d65bd0`）

---

## 0. 任务判定

这是 **Large**：

- 新增 Morrow 系统角色 + 角色自动创建业务流。
- 触达 shared IPC / store / orchestrator / renderer 四层。
- 新增用户可见交互：内联确认卡片。

视觉稿前置闸门：🟢（已有组件局部修改 + 复用 handoff-card 范式，无新页面/布局变动）。

---

## 1. 背景与目标

用户目前创建 AI 队友需手动填写名称、简介、指示词。多数用户不知道怎么写 prompt。

目标：用户在频道里 @Morrow 用自然语言描述需求，Morrow 自动生成角色配置，用户一键确认即可创建。

---

## 2. 外部参考与裁剪

| 参考 | 可借鉴点 | Morrow 裁剪 |
|---|---|---|
| Slack Workflow Builder | 对话内触发自动化 | 仅用 @mention 触发，不做 trigger 配置 |
| GPTs Builder (OpenAI) | 对话式生成 agent 配置 | 单轮生成+确认，不做多轮编辑迭代 |
| AutoGen GroupChat | 自动创建 agent 角色 | 不做自动分配，用户显式确认 |

结论：**@Morrow 触发 + AI 单轮生成 + 内联卡片确认**，最小成本跑通。

---

## 3. 产品范围

### In Scope

1. 内置 Morrow 系统角色（不可删除、不可修改 instruction）
2. 用户在频道 @Morrow + 自然语言 → 触发角色生成流程
3. Morrow 角色输出结构化 JSON → orchestrator 解析为 TeamProposal
4. 消息流内联 TeamProposalCard：展示角色名称/简介/指示词摘要/模型
5. 用户点「确认创建」→ createRole + addRoleToChannel
6. 多角色场景分多轮：确认一个后 Morrow 主动问「还要继续创建下一个吗？」
7. 解析失败 → Morrow 以普通消息回复"没听懂，请再描述一次"

### Out of Scope

- 批量一次创建多角色
- 角色编辑/修改流程（已有）
- Morrow 角色回答非角色创建的问题（MVP 仅处理组建团队意图）
- 按钮/Dialog 入口（纯对话触发）

---

## 4. 领域模型

### 4.1 新增类型

```ts
// 新增事件类型
export type ChannelEventType = ... | 'team_proposal_posted' | 'team_proposal_confirmed';

// 新增 proposal 结构（内存态，不持久化为独立表）
export interface TeamProposal {
  id: string;
  channelId: string;
  runId: string;
  role: { name: string; intro: string; instruction: string; defaultRuntime: RuntimeId };
  status: 'proposed' | 'confirmed' | 'dismissed';
  createdAt: number;
}
```

### 4.2 Morrow 系统角色

```ts
{
  id: 'role-morrow',
  name: 'Morrow',
  intro: '频道助手，帮你快速组建 AI 团队。',
  instruction: MORROW_SYSTEM_PROMPT, // 固定，引导输出 JSON
  defaultRuntime: 'codex',
  createdAt: 0,
  updatedAt: 0,
}
```

### 4.3 State Ownership

| 状态 | Owner | 持久化 |
|---|---|---|
| Morrow 角色 profile | `channels-file.ts` seed | 是 |
| TeamProposal | `ChannelsStore.teamProposals[]` | 是 |
| 确认卡片 UI 状态 | renderer（派生自 snapshot） | 否 |

### 4.4 不变量

1. **单次一个**：Morrow 每次 run 最多生成 1 个 TeamProposal。输出含多角色时只取第一个。
2. **确认前不创建**：TeamProposal 仅在用户点击确认后调 createRole；确认前系统无副作用。
3. **系统角色不可删**：`role-morrow` 的 deleteRole 调用必须拒绝。

---

## 5. 架构方案

### 5.1 触发路径

```
用户 @Morrow → postUserMessage → findMentionedRoles → [Morrow role]
→ orchestrator.startRun(morrowRun) → runtime 执行 → completeRoleRun
```

与普通角色 run 完全一致，无特殊分支。

### 5.2 输出解析（completeRoleRun 后）

Orchestrator 在 `completeRoleRun` 之后，检查 `run.roleId === 'role-morrow'`：
- 尝试从 output text 提取 JSON（支持 ```json 包裹）
- 解析成功 → 创建 TeamProposal + 发 `team_proposal_posted` 事件
- 解析失败 → 保持原样，Morrow 回复当做普通 role_message_posted 展示

### 5.3 确认路径

新 IPC：`channels:confirm-team-proposal`

```ts
export interface ConfirmTeamProposalArgs {
  channelId: string;
  proposalId: string;
}
```

Handler 逻辑：
1. 找到 proposal，校验 status === 'proposed'
2. 调 `createRole({ ...proposal.role, channelIds: [channelId] })`
3. proposal.status = 'confirmed'
4. 发 `team_proposal_confirmed` 事件
5. 返回 snapshot

### 5.4 Morrow System Prompt

```
你是 Morrow，一个频道助手。用户会描述他需要什么样的 AI 队友。

你的任务：根据用户描述，生成一个角色配置。

输出格式（严格 JSON，不要输出其他内容）：
```json
{
  "name": "角色名称（2-8字）",
  "intro": "一句话简介（20字以内）",
  "instruction": "角色的完整指示词，描述角色的专业能力、回答风格和工作范围",
  "defaultRuntime": "codex 或 claude"
}
```

规则：
- 只输出一个角色。如果用户描述了多个，选最重要的那个先输出。
- instruction 要具体、可执行，像在写给一个真实同事的工作说明。
- 如果无法理解用户需求，输出纯文本（不包含 JSON）说明你没听懂。
```

### 5.5 IPC 增量

| Channel Name | 方向 | 用途 |
|---|---|---|
| `channels:confirm-team-proposal` | renderer→main | 确认创建角色 |
| `channels:dismiss-team-proposal` | renderer→main | 取消/忽略 proposal |

### 5.6 受影响文件

新增：
- 无新文件（全部改动在现有文件内完成）

修改：
- `src/shared/channel-ipc.ts` — 新增 TeamProposal 类型、事件类型、IPC 接口
- `src/contexts/channels/infrastructure/channels-file.ts` — seed Morrow 角色 + teamProposals 字段
- `src/contexts/channels/infrastructure/channels-store.ts` — teamProposal CRUD + confirmTeamProposal
- `src/contexts/channels/application/channel-orchestrator.ts` — completeRoleRun 后的 JSON 解析
- `src/app/main/ipc.ts` — 注册新 handler
- `src/app/main/ipc-validate.ts` — 新 validate 函数
- `src/shared/ipc.ts` — IPC_CHANNELS 增量 + ChannelsApi 增量
- `src/app/preload/index.ts` — bridge 增量
- `src/app/preload/index.d.ts` — 无需改（MorrowApi.channels 类型从 channel-ipc 推导）
- `src/app/renderer/src/screens/ChannelWorkspace.tsx` — TeamProposalCard 渲染
- `src/app/renderer/src/channel-workspace.css` — 卡片样式
- `CHANGELOG.md`

---

## 6. UI / 交互设计

### TeamProposalCard（内联卡片）

复用 `.handoff-card` 范式：

```
┌─────────────────────────────────────────┐
│  Morrow 建议创建角色：                    │
│                                          │
│  名称：前端工程师                          │
│  模型：Codex                             │
│  简介：负责 React 组件开发与页面实现       │
│  指示词：你是一位前端工程师，擅长...       │
│                                          │
│  [ 确认创建 ]    [ 忽略 ]                 │
└─────────────────────────────────────────┘
```

确认后卡片变为「已创建 ✓」静态态。

---

## 7. 风险与处理

| 风险 | 处理 |
|---|---|
| Codex 输出非 JSON | 当做普通消息展示，不报错 |
| JSON 缺字段 | 用默认值兜底（name 必须有，其余可 fallback） |
| 用户 @Morrow 聊别的事 | Morrow instruction 引导只输出 JSON；非 JSON 输出直接展示 |
| Morrow 角色被删 | deleteRole 拒绝 id='role-morrow' |
| 并发多个 Morrow run | 每个 run 独立生成 proposal，互不干扰 |

---

## 8. 验证方式

### Unit
- Morrow system prompt 常量存在且非空
- JSON 解析逻辑：正常 JSON / ```json 包裹 / 非 JSON → 各走正确分支
- TeamProposal 创建/确认状态流转
- deleteRole 拒绝 role-morrow

### Contract
- IPC validate 对 ConfirmTeamProposalArgs / DismissTeamProposalArgs 的边界校验

### Integration
- postMessage @Morrow → run 启动 → 模拟输出 JSON → proposal 生成 → confirm → 角色出现在 snapshot

### Full Gate
```bash
pnpm pre-commit
```

---

## 9. 决策记录

### 采纳方案
@Morrow 系统角色 + Codex runtime + orchestrator 后置 JSON 解析 + 内联卡片确认。

### 替代方案
1. **独立 Dialog 入口** — 用户说希望在对话中触发，否定。
2. **Claude runtime** — 用户指定用 Codex。
3. **批量创建多角色** — 用户指定单次只创建一个，分多轮。
