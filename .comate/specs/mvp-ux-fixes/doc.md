# Spec: MVP UX Fixes (sidebar + multi-conversation + keyboard + back)

## 0. 背景

`agent-runtime-mvp` 跑通了"splash → home → chat → 流式响应"的主链路，但用户试用后报告 4 个阻塞 MVP 可用性的交互问题：

1. **截图 1（布局混淆）**：Chat 页的 AI 消息卡片与底部 Composer 之间缺乏视觉分隔，流式中的 "streaming… Esc 中止" 提示像粘在 AI 响应末尾，用户无法分辨"这是 AI 输出"还是"这是输入框状态"。
2. **返回入口缺失**：进入 Chat 后只有 `Esc` 键可回到 Home，没有任何可视按钮。用户不知道能回去。
3. **无多会话 / 无侧边栏 / 无新建**：当前 `App.tsx` 只维护单个 `messages: Msg[]`，`Home` 是空壳占位；用户期望类似 ChatGPT / Claude / 截图 3 中的 Task List 结构——侧边栏列出历史会话、支持新建与切换。
4. **Enter 不发送**：`Composer` 当前绑定 `⌘/Ctrl+Enter` 发送、`Enter` 换行，与用户直觉（ChatGPT / Claude / Arc Max / Cursor Chat 的 `Enter 发送 / Shift+Enter 换行`）相悖，用户以为发不出去。

这些问题让 MVP **不可用**。本 Spec 的目标是用**最小改动**把这 4 个问题修掉，不引入持久化、不引入路由库。

---

## 1. 业界实践参考

| 产品 | Enter 行为 | 返回 | 会话列表 |
|---|---|---|---|
| ChatGPT | Enter 发送 / Shift+Enter 换行 | 左侧栏始终可见 | 左侧栏"+ New chat" |
| Claude.ai | Enter 发送 / Shift+Enter 换行 | 左上角 logo / 新建按钮 | 左侧栏"New chat" |
| Cursor Chat | Enter 发送 / Shift+Enter 换行 | `Cmd+N` 新建 | 顶部 tabs / 历史面板 |
| Arc Max | Enter 发送 / Shift+Enter 换行 | — | — |

**结论**：Enter 发送 + Shift+Enter 换行 是绝对共识；`⌘⏎` 可作为冗余快捷键保留，但**不能**是唯一发送方式。左侧永久侧边栏 + 显式"+ 新建"按钮也是共识。

---

## 2. 需求范围与验收标准

### 2.1 Enter 发送语义调整（问题 4）

- Composer 的 `keydown` 契约改为：
  - `Enter`（无修饰键）→ 阻止默认 + 调用 `submit()`
  - `Shift+Enter` → 走默认，插入换行
  - `⌘/Ctrl+Enter` → 保留为等价发送（冗余，不删除，兼容老肌肉记忆）
  - IME 合成期间（`e.nativeEvent.isComposing === true` 或 `e.keyCode === 229`）→ 一律不发送（中文输入法不被误触）
- 占位文案与按钮 title 同步更新：`⏎ 发送 · Shift⏎ 换行`。
- **AC**：中文输入状态下按 Enter 只完成候选词，不发送；英文直接打字按 Enter 即发送；Shift+Enter 可换行。

### 2.2 返回入口可见化（问题 2）

- 顶部 `.top` 栏左侧（交通灯右边）新增一个"返回"按钮，仅在 `scene === 'chat'` 时渲染。
  - 文案：`← 首页`
  - 行为：等价于当前 `back()`（若流式中先 `abortSession`，再回 home）
- 保留 `Esc` 快捷键不动。
- **AC**：Chat 页左上显式可见"← 首页"按钮；点击立刻回到 Home，流式被正确 abort。

### 2.3 多会话 + 侧边栏 + 新建（问题 3）

**这是本 Spec 最大的改动。**

#### 状态模型（内存，不落盘）

```ts
interface Conversation {
  id: string;                   // c-<timestamp>
  title: string;                // 首条用户消息截断 24 字；空会话显示"新对话"
  runtime: RuntimeId | null;    // 创建时绑定当前 runtime；null 表示空对话
  messages: Msg[];
  createdAt: number;            // ms
  updatedAt: number;            // ms
}

// App.tsx 状态
conversations: Conversation[];  // 按 updatedAt desc 排序
activeId: string | null;        // 当前选中的会话；null 表示在 Home
streamingSid / streamingAiId / streamingConvId: 绑定到具体会话
```

**不变量**：
1. `streamingSid !== null` ⇔ 存在唯一 `msg.status === 'streaming'`，且该 msg 在 `activeId` 指向的会话内
2. 切换 `activeId` 时不中断后台流；但 UI 层只显示 `activeId` 对应会话的消息
3. 新建会话时，若当前有流式任务**不**打断（让它在后台继续写入对应会话）

#### 布局

```
┌─────────────────────────────────────────────────────────┐
│ [● ● ●]  ← 首页(仅chat)         morrow        [runtime▼]│  ← .top
├───────────────┬─────────────────────────────────────────┤
│ + 新建对话     │                                         │
│ ─────────────│                                         │
│ 你用的什么…   │           .body 内容                     │
│   刚刚         │  (home 欢迎页 / chat 消息流 + composer) │
│ 帮我 refactor  │                                         │
│   5 分钟前     │                                         │
│ 翻译下面…      │                                         │
│   昨天         │                                         │
│               │                                         │
└───────────────┴─────────────────────────────────────────┘
    260px                    flex: 1
```

- **Splash / Install 两屏不显示侧边栏**（检测期还没有会话概念）
- **Home / Chat 两屏显示侧边栏**
- 侧边栏固定宽度 260px；body 占剩余宽度
- 侧边栏内容：
  - 顶部："+ 新建对话"按钮（整行）
  - 列表项：标题（单行省略）+ 相对时间（"刚刚 / 5 分钟前 / 昨天 / MM-DD"）
  - active 项高亮（使用现有 design token）
  - 空态：列表区显示"还没有对话"

#### 交互

| 动作 | 行为 |
|---|---|
| 点击"+ 新建对话" | 创建新空 `Conversation`（`runtime = current`, `messages = []`, `title = '新对话'`），设 `activeId`，`setScene('home')` 显示欢迎 Composer |
| 在 Home Composer 发送 | 若 `activeId` 为空先创建一个新 conversation；用户消息 + AI 占位写入该 conversation；`setScene('chat')` |
| 在 Chat Composer 发送 | 追加到 `activeId` 指向的 conversation |
| 点击侧边栏某项 | `setActiveId(id)`，该 conversation 有消息 → `scene='chat'`；无消息 → `scene='home'` |
| 顶部"← 首页" | `setActiveId(null)`，`scene='home'`；若流式中，**不 abort**（后台继续跑），只切视图 |
| Esc（Chat 页） | 同"← 首页" |

#### 会话标题派生

- 会话首条 user 消息发送后，如果标题还是"新对话"，设为 `user.text.slice(0, 24)`（UTF-16 code unit；中文字面上够看）。
- 不做 AI 总结命名（MVP 不引入额外模型调用）。

#### 流式 abort 的语义变化

当前 `back()` 里调用 `abortSession`。**新语义**：返回首页不 abort；只有显式按按钮（未来）或关闭 app 才 abort。这样用户可以"点开新对话让旧的继续跑"。

### 2.4 Chat 页视觉分隔（问题 1）

- 在 `.stream`（消息流）和 `.composer-wrap` 之间加一条 1px 分割线 + 12px 底色渐隐，确保 AI 消息末尾和 Composer 顶部视觉上完全分离。
- Composer 的 streaming hint 从 `streaming… Esc 中止` 改为 `● streaming · Esc 中止`（加圆点前缀 + 中点分隔，显著区别于消息内容字体）。
- AI 消息 `.msg-ai` 增加 `margin-bottom: var(--space-6)`，避免最后一条 AI 消息紧贴分割线。

---

## 3. 受影响文件

| 文件 | 变更类型 | 说明 |
|---|---|---|
| `src/app/renderer/src/App.tsx` | 重构 | 状态从 `messages[]` → `conversations[]` + `activeId`；新增 `createConversation / selectConversation`；send 逻辑改为写入 active conversation；back 语义改为"只切视图"；传 props 给 Sidebar/Home/Chat |
| `src/app/renderer/src/components/Sidebar.tsx` | **新增** | 260px 侧边栏；props: `conversations, activeId, onSelect, onCreate` |
| `src/app/renderer/src/components/Composer.tsx` | 修改 | keydown 契约切换为 Enter/Shift+Enter；兼容 IME；hint 文案更新 |
| `src/app/renderer/src/screens/Chat.tsx` | 修改 | 移除已独立出去的 back 处理（保留 Esc 监听）；hint 文案 `● streaming · Esc 中止` |
| `src/app/renderer/src/screens/Home.tsx` | 修改 | 保留欢迎内容；不再自行渲染侧边栏（由 App 统一挂载）；Composer hint 文案更新 |
| `src/app/renderer/src/index.css` 或 `screens.css` | 修改 | 新增 `.layout` flex 容器、`.sidebar` / `.sidebar-item` / `.sidebar-new` 样式；`.stream` 与 `.composer-wrap` 之间分割线 |
| `tests/e2e/mvp-flow.spec.ts` | 修改 | 断言新建对话按钮存在、Enter 可发送、返回按钮可见可点击 |
| `CHANGELOG.md` | 追加 | `[Unreleased]` 记录用户可感知变更 |

**不修改**：`main/`（主进程无关）、`preload/`、`shared/ipc.ts`（IPC 契约不动）、`runtime-session.ts`。

---

## 4. 关键实现细节

### 4.1 Composer IME-safe Enter 发送

```ts
onKeyDown={(e) => {
  if (e.key !== 'Enter') return;
  // IME 合成中：不拦截
  if (e.nativeEvent.isComposing || e.keyCode === 229) return;
  if (e.shiftKey) return;                 // 让默认换行发生
  e.preventDefault();
  submit();
}}
```

### 4.2 App.tsx 状态迁移

保持 `useStream` 订阅者是单一的（App 级别），但在 setState 时根据 `streamingConvId` 定位到对应 conversation 再更新其 messages。`streamingAiIdRef` 改为 `{ convId, aiId } | null`。

```ts
useStream((e) => {
  const ref = streamingRef.current;
  if (!ref) return;
  // ...根据 ref.convId 找 conversation, 再找 msg
});
```

### 4.3 相对时间

纯函数 `formatRelativeTime(ts: number, now: number): string`，无依赖。放在 `Sidebar.tsx` 内部（只此一处用）：
- <60s → "刚刚"
- <60min → "N 分钟前"
- 同一天 → "HH:mm"
- 昨天 → "昨天"
- 其他 → "MM-DD"

### 4.4 侧边栏显隐

```tsx
{(scene === 'home' || scene === 'chat') && (
  <Sidebar ... />
)}
```

Splash/Install 屏保持全宽居中，不破坏现有视觉。

---

## 5. 风险与边界

| 风险 | 应对 |
|---|---|
| 流式中切换会话导致事件写错 conversation | `streamingRef` 携带 `convId`，按 ref 定位而非按 `activeId` |
| 新建对话时 current runtime 为空 | 从 Home 进入时 current 必不为空（detect 保证）；否则禁用"+ 新建"按钮 |
| IME 识别不全（某些输入法只报 keyCode 229） | 双重兜底：`isComposing || keyCode === 229` |
| Sidebar 列表很长导致滚动与 Chat 滚动冲突 | Sidebar 自身 `overflow-y: auto`，独立滚动 |
| 内存会话在进程重启后丢失 | **明确不在本 Spec 范围**；未来由独立 SDD `conversation-persistence` 处理 |
| 多会话并发流式 | MVP 阶段上限 1 条流式（按会话粒度；后续可放开）；第二次发送前 `abortSession(当前 streamingSid)` 仅在同一 conversation 内强制覆盖，跨会话允许并行（runtime-session 主进程已支持多 sessionId） |

**决议**：多会话流式**允许并发**（主进程本来就按 sessionId 管子进程）。但前端同一 conversation 内只允许一条 streaming。

---

## 6. 验收清单

- [ ] Home/Chat 页左侧出现 260px 侧边栏，含"+ 新建对话"与会话列表
- [ ] 点击"+ 新建对话"能创建新会话并切到 Home 欢迎态
- [ ] 侧边栏点击可在会话间切换，active 项高亮
- [ ] Chat 页顶部出现"← 首页"按钮，点击回到 Home
- [ ] Composer 中中文输入时按 Enter 不误发；英文按 Enter 直接发送
- [ ] Shift+Enter 可换行
- [ ] AI 消息与 Composer 之间有明显视觉分隔，streaming 提示文案加点前缀
- [ ] `pnpm pre-commit` 全绿（lint / typecheck / test / css-line-check 等所有闸门）
- [ ] e2e 更新后通过

---

## 7. 非目标

- 会话持久化到磁盘
- 会话重命名 / 删除
- 会话搜索
- 侧边栏折叠
- 多窗口
- Runtime-per-conversation 切换（MVP 仍是全局 runtime）

以上均留待后续独立 SDD。
