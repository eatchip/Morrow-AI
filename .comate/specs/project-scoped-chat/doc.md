# Spec · project-scoped-chat

> **分类**：Large（新功能 + 跨进程契约变更 + 布局重构 + 持久化）
> **视觉稿闸门**：🔴 布局重构 / 新原语组件 — 实现前必须产出视觉稿并经用户确认
> **分支**：`feat/project-scoped-chat`

---

## 1. 场景与动机

当前对话是纯"扁平列表"：所有会话平铺在 Sidebar，不携带任何文件夹上下文。CLI 子进程（`claude` / `codex`）在 Electron 主进程默认的 `cwd` 下启动，无法"基于某个项目文件夹"工作。

参考 Codex 的结构：
- 左侧 Sidebar 分为两个区：**项目**（可折叠，按 folder 分组的会话） + **对话**（未绑定项目的会话）。
- 顶部 Composer 下方提供一个"进入项目工作"的入口，支持搜索已有项目、选择、或"添加新项目"。
- 默认状态：**不在任何项目下**（新建对话落在"对话"分组里）。

Morrow 要做的是**等价语义的最小子集**：让用户可选地把一段会话绑定到一个本地文件夹，后台 CLI 以该文件夹为 `cwd` 运行。

---

## 2. 业界参考

- **Codex**（用户截图 & 官方）：项目持久化；每个项目是一个文件夹；sidebar 分组显示；project picker 支持搜索 + 新增。
- **Claude Desktop / Cursor / Zed**：项目 = 文件夹绝对路径；启动 CLI/agent 时把 `cwd` 设为项目根；项目列表在用户 profile 中持久化（JSON）。
- **VS Code "Recent"**：相对路径显示 basename，完整路径作 tooltip；最近使用排序。

结论：Morrow 采用"**项目 = { id, name, path, createdAt, lastUsedAt }** + 跨重启持久化 + CLI `cwd` 注入"的业界通用模型。

---

## 3. 业务逻辑与验收

### 3.1 数据模型

新增一个**项目**实体（仅项目持久化；会话仍然内存态，与现状一致）：

```ts
// src/shared/ipc.ts (新增)
export interface Project {
  id: string;            // `p-<uuid>`
  name: string;          // 显示名（默认 = basename(path)，可后续改名；本次只做默认名）
  path: string;          // 绝对路径（normalized）
  createdAt: number;
  lastUsedAt: number;
}
```

`Conversation`（renderer 层）新增可选字段：

```ts
interface Conversation {
  // ...既有字段
  projectId: string | null;  // null = 未归属任何项目（默认）
}
```

### 3.2 UI 规格（详细视觉稿在 Task 1 产出）

**Sidebar 布局变更**（基于现有 260px 宽度）：

```
┌──────────────────────────┐
│  + 新建对话               │
├──────────────────────────┤
│  项目                ＋  │← 分组 header + "添加项目"按钮
│  ▸ Morrow              │← 折叠：点击展开子项；默认展开最近使用的项目
│     · 新对话         4天 │
│     · 修 codex      1周 │
│  ▸ opencove            │
│     ...                  │
├──────────────────────────┤
│  对话                    │← 未归属项目的会话（即当前所有会话的默认区）
│     · 你好         15小时│
│     · hi            1周  │
└──────────────────────────┘
```

**Composer 项目切换器**（Home 与 Chat 的 Composer 上方）：
- 默认显示 `进入项目工作 ▾`（灰度、次级样式）；
- 点击打开下拉：搜索框 + 已有项目列表 + `+ 添加新项目`；
- 已在项目内时显示 `📁 {projectName} ▾`，下拉多一项 `退出项目`；
- "添加新项目"走 Electron `dialog.showOpenDialog({ properties: ['openDirectory'] })`。

**作用域语义**：
- 当前 Composer 的"项目选择"决定 **"本次发送"的目标项目**；
- 新会话首条消息发送时：把 `projectId` 绑到会话上；
- 打开既有会话：Composer 自动回显该会话的 `projectId`（但此时切换器是只读预览 + 可"退出项目"解除绑定，对已绑定会话**不允许改签到另一个项目**，避免语义混乱；如需换项目，新建对话即可）。

### 3.3 接受标准

1. 首次启动：Sidebar 有"项目"区（空态提示"还没有项目"）+"对话"区；默认不在任何项目下。
2. 点击"＋ 添加项目"可打开系统文件夹选择；选择后项目进入 Sidebar 持久化列表，立即成为 Composer 的当前项目。
3. 在某项目下发送首条消息，后台 `claude`/`codex` 子进程以该项目 path 为 `cwd`（可用 `pwd` prompt 验证）。
4. 重启应用，项目列表保留；会话列表丢失（保持现状）。
5. 现有无项目会话流程（零项目时）与改造前完全一致，不破坏现有 E2E/单测。
6. Invalid path（已删除/无权访问）：启动时项目仍保留在列表但标记"❗ 不可用"，发送时提示并阻止。

---

## 4. 架构与所有权

### 4.1 状态所有权

| 状态 | Owner | 持久化 | 备注 |
|------|-------|--------|------|
| `projects: Project[]` | **Main** 进程（electron `app.getPath('userData')/projects.json`） | 是 | 通过 IPC 读写；renderer 只读副本 |
| `activeProjectId: string \| null` | **Renderer**（App state） | 否（会话级） | 默认 null |
| `conversations[*].projectId` | **Renderer**（App state） | 否（沿用现状） | 首次发送时定版 |

**不变量**：
1. `conversation.projectId` 一经首次发送即不可变（仅可通过"退出项目"置空，但本次范围内只允许新会话绑定，不允许中途切项目）。
2. `Project.path` 必须是绝对、已存在的目录；主进程在新增时校验。
3. CLI 子进程的 `cwd` 严格来自校验过的 `Project.path`；renderer 传入的 `projectId` 在主进程用于查表，不接受 renderer 直接传 path（防逃逸）。

### 4.2 IPC 契约增量

`src/shared/ipc.ts`：

```ts
// 新增 Channel
export const IPC_CHANNELS = {
  // ...既有
  projectsList:   'projects:list',
  projectsAdd:    'projects:add',     // 弹系统目录选择；或直接传 path
  projectsRemove: 'projects:remove',
} as const;

export interface MorrowApi {
  // ...既有
  listProjects(): Promise<Project[]>;
  addProject(): Promise<Project | null>;   // 内部调 dialog；取消返回 null
  removeProject(id: string): Promise<void>;
}

// sendPrompt 扩展
export interface SendPromptArgs {
  runtime: RuntimeId;
  prompt: string;
  sessionId: string;
  projectId?: string | null;   // 新增；主进程据此解析 cwd
}
```

### 4.3 主进程改造

- **新文件**（必要，专司项目持久化）：`src/app/main/projects-store.ts`
  - `loadProjects() / saveProjects()`：`userData/projects.json`，原子写（tmp + rename）。
  - `addProject(path): Project`：normalize、存在性校验、去重（相同 path 视为同一项目）。
  - `getProjectPath(id): string | null`
- **修改** `src/app/main/ipc.ts`：注册 3 个新 channel；`sendPrompt` 校验 `projectId`（如传入）并解析 cwd。
- **修改** `src/app/main/runtime-session.ts`：`startSession` 增加 `cwd?: string` 参数，透传给 `spawn(..., { cwd })`；cwd 不存在/不可访问时 emit `error`。

### 4.4 Renderer 改造

- **修改** `src/shared/ipc.ts`（契约）
- **修改** `src/app/preload/index.ts`（暴露新 API）
- **修改** `src/app/renderer/src/components/Sidebar.tsx`：分组渲染（项目 / 对话）+ 项目折叠 + 添加项目按钮。
- **新文件**（必要，新原语组件）：`src/app/renderer/src/components/ProjectPicker.tsx`：Composer 上方的项目切换器。
- **修改** `src/app/renderer/src/screens/Home.tsx` / `Chat.tsx`：挂载 `ProjectPicker`。
- **修改** `src/app/renderer/src/App.tsx`：引入 `projects / activeProjectId` 状态；`send()` 把 `projectId` 传给 IPC。
- **修改** `src/app/renderer/src/sidebar.css`：分组 header、折叠箭头、嵌套项缩进。

### 4.5 数据流

```
[UI 添加项目]
 renderer: addProject()
  → preload: invoke('projects:add')
   → main: dialog.showOpenDialog → validate → persist → return Project
  ← renderer: 更新 projects 列表

[UI 发送消息(带 projectId)]
 renderer: sendPrompt({...args, projectId})
  → main: projectId → getProjectPath → fs.access 校验 → spawn({ cwd })
  ← stream events ...
```

---

## 5. 风险与边界条件

| 风险 | 缓解 |
|------|------|
| 用户删除了已持久化的项目目录 | 发送时 `fs.access` 失败 → emit error，不崩溃；Sidebar 项目条目显示不可用标记（本次仅处理错误态，不自动清理） |
| 路径包含空格 / 中文 / 符号 | `spawn(..., shell: false)` 已避免 shell 注入；`cwd` 直接传字符串，Node 正确处理 |
| 用户选了家目录 / 根目录 | 不做强制拦截（业界约定由用户负责），但 UI 提示一次"确认使用 {path}？" |
| `projects.json` 损坏 | load 时 try/catch 失败则回退空数组 + 备份损坏文件为 `projects.json.bak-<ts>` |
| 并发写 `projects.json` | 主进程单例串行化（内存队列）；测试环境允许同步写 |
| Renderer 伪造 projectId 逃逸 cwd | 主进程**不接受 path 入参**，只接受 id 并内部查表 |
| 跨平台路径 | 仅保存绝对路径；显示时用 `path.basename`；tooltip 显示完整 path |

---

## 6. 预期验证

- **单测**（vitest）：
  - `projects-store`：add/remove/load 幂等；损坏文件回退；重复 path 去重。
  - `runtime-session`：`startSession({ cwd })` 透传到 spawn options（mock `child_process.spawn`）。
  - `Sidebar` 分组渲染：给定 projects + conversations，DOM 结构正确。
  - `ProjectPicker`：搜索过滤；选中回调。
- **契约测试**（tests/contract）：`MorrowApi` 类型完整（已有模式，补 3 个新方法）。
- **E2E**（playwright，可选最小用例）：空态 → 添加项目（mock dialog） → sidebar 可见；已有 E2E 不回归。
- **手动验证**：发送 `pwd` 到 Codex，验证输出等于项目 path。
- **Pre-commit 闸门**：`pnpm pre-commit` 必须全绿（format / lint / typecheck / test / naming / secrets / max-lines）。

---

## 7. 与设计契约的关系

- 所有新增 UI 元素（分组 header、折叠箭头、ProjectPicker、添加按钮）**必须使用 `docs/design/DESIGN.md` 的 tokens**（`--line`, `--panel`, `--accent`, `--text-2`, `--mono` 等），禁止硬编码色/距/圆角。
- 视觉稿（Task 1）需覆盖：空态、有项目折叠态、展开态、active conversation 高亮、ProjectPicker 默认/打开/搜索中/已选中四态。

---

## 8. 非目标（本次不做）

- 会话本身的跨重启持久化（另行 SDD）。
- 项目改名、项目内子目录浏览、文件拖拽。
- 多窗口下项目列表同步（当前是单窗口应用）。
- 自动"感知 git 仓库根"——用户显式选择即可。
- 已绑定会话中途改签项目（见 §3.2 语义）。

---

## 9. 待确认

1. "项目持久化 + 会话仍内存"的折中是否可接受？
2. 已绑定会话不允许改签到另一个项目（需要时新建对话），是否可接受？
3. CLI `cwd` 注入是硬需求（否则"基于文件夹"就失去实际意义），确认同意？
