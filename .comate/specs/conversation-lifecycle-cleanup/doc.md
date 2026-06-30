# Spec — conversation-lifecycle-cleanup

> 让空对话不污染侧边栏；让侧边栏对话像项目一样可手动移除。

## 1. 背景与现状

当前 `App.tsx::createConversation`（src/app/renderer/src/App.tsx:89）会在用户点击「+ 新建对话」时立即往 `conversations` 顶端塞入一个 `messages=[]`、`title='新对话'` 的占位记录，并把它设为 `activeId`。`title` 与 `projectId` 仅在首次发送时定版（`send` 中的 `isFirstUserMsg`，App.tsx:140-148）。

由此产生两个问题（与用户截图一致）：
1. 用户进入「新对话」后**未发送任何消息就切到其它对话**，这个空记录会以「新对话」常驻侧边栏，且永远不会被清理（无持久化、无生命周期回收）。
2. 侧边栏对**项目**支持移除（`ProjectBranch.sidebar-project-remove`，Sidebar.tsx:158-177），但对**对话**（无论是项目下嵌套的还是未归属的）**没有删除入口**——一旦产生就再也清不掉。

## 2. 业界参考

- **ChatGPT / Claude Web / Cursor / Linear 的命令面板对话**：均不会为「点击新建」就先入库；通常仅在首次发送后才在侧边栏物化，或者将「空草稿」绑定在当前视图，离开即丢弃。
- **Linear（设计北极星）**：列表项的销毁动作走 hover 出现的轻量图标（× / trash），与本仓库现有 `.sidebar-project-remove` 形态一致；不弹确认对话框（撤销靠 toast / undo）。
- **VS Code 的"untitled"标签**：未编辑过的草稿在切走时直接销毁，不污染侧边栏。

本仓库选择的折中方案与上述工业实践一致：**空对话以本地草稿语义存在，离开即销毁；非空对话支持手动删除**。

## 3. 需求与验收标准

### 3.1 自动清理空对话（auto-evict）

- **触发点**：当 `activeId` 指向的对话变化时（用户切到另一会话 / 切换 scene 离开 chat&home 工作区 / 删除当前会话 / 应用 detect 流程把 scene 拉回 splash），若上一个 `activeId` 对应的对话满足"空对话"判定，则**从 `conversations` 中移除**该记录。
- **空对话判定**：`messages.length === 0`。`title` 不参与判定（保持单一信号源）。
- **不变量**：
  - **I1**：任意时刻 `conversations` 中最多存在一条空对话，且其 `id === activeId`。
  - **I2**：一旦某条对话有过任意 `messages`（user 或 ai），即视为"已物化"，永不被自动回收。
  - **I3**：自动清理只对**当前离开的旧 activeId** 生效，不会扫描全表。

### 3.2 手动删除对话（manual delete）

- **入口**：侧边栏每条 `ConvItem`（`src/app/renderer/src/components/Sidebar.tsx:201`）右侧 hover 出现 × 图标，沿用现有 `.sidebar-project-remove` 样式与交互（hover 显示、stopPropagation、Enter/Space 键盘可达）。
- **行为**：调用 `onDelete(id)` → `App.tsx` 从 `conversations` 中移除该 id；若被删的是 `activeId`，则 `activeId=null` 且 `scene='home'`。
- **二次确认**：不弹确认框（与 `onRemoveProject` 现有体验一致；若误删，由后续独立 SDD 决定是否引入 undo toast，本次不做）。
- **流式中的对话**：若被删对话正处于 streaming（`streamingRef.current.convId === id`），删除时一并清空 `streamingRef.current` 以避免 chunk 落到已销毁记录上；后端 IPC 流不在本次 abort（与现有 `back()` 的多会话语义保持一致，App.tsx:171-174）。

### 3.3 不在本次范围

- 持久化（重启后保留对话列表）—— 当前是纯内存态，本 SDD 不引入。
- Undo / Toast。
- 项目下空对话计数显示。
- 后端进程的 abort（与既有 `back()` 语义一致，留待后续）。

## 4. 状态所有权与不变量

| 维度 | 当前 | 本次后 |
| --- | --- | --- |
| `conversations` owner | `App.tsx` `useState` | 不变 |
| 空对话生命周期 | 永生 | 由 `activeId` 转换钩子回收 |
| 删除入口 | 仅项目 | 项目 + 对话 |
| 流式 ref | `App.tsx` `streamingRef` | 删除被流式对话时同步清空 |

新不变量已写在 §3.1。

## 5. 架构与技术方案

### 5.1 集中处理 activeId 转换

新增一个内部 helper `setActiveIdWithEviction(nextId: string | null)`，封装：

```
// 伪代码（在 App.tsx 内 useCallback 化）
function setActiveIdWithEviction(nextId) {
  setActiveId((prevId) => {
    if (prevId && prevId !== nextId) {
      setConversations((convs) => {
        const prev = convs.find((c) => c.id === prevId);
        if (prev && prev.messages.length === 0) {
          // 同步清理流式 ref（理论上不会命中，因为空对话尚未触发 send）
          if (streamingRef.current?.convId === prevId) {
            streamingRef.current = null;
          }
          return convs.filter((c) => c.id !== prevId);
        }
        return convs;
      });
    }
    return nextId;
  });
}
```

替换以下三处直接 `setActiveId(...)` 的调用：
- `createConversation`（App.tsx:102）
- `selectConversation`（App.tsx:108）
- `send`（App.tsx:159）—— 此处旧 activeId 转向"自身"（`targetId === activeId` 是常态），eviction 自动跳过

`send` 内的 `targetId = activeId ?? createConversation()`：当 `activeId` 已是空对话且即将被首次 user 消息物化，**不应**触发 eviction（因为此时空对话即将变非空）。封装会处理：旧 `prevId === targetId` 时不动作。

`back()` 仅切 scene、不动 `activeId`，因此不触发 eviction（保留多会话并行语义）。

`detect()` 在重新检测时 scene→splash，不主动改 activeId；首次启动 activeId 本就为 null。**为安全起见**，`detect()` 末尾在 `r.installed` 全失败转 install 时也无需动作（activeId=null 保持）。

> **替代方案**：使用 `useEffect` 监听 activeId 变化做副作用清理。**否决理由**：副作用驱动的状态写回会让 React 严格模式下出现额外渲染；显式 helper 语义更清晰、可单测。

### 5.2 删除对话

- `Sidebar` props 新增 `onDeleteConversation: (id: string) => void`。
- `ConvItem` 内增加 × 元素，复用 `.sidebar-project-remove` 视觉与交互模式（`role=button`、`tabIndex=0`、`Enter/Space` 键、`stopPropagation`、`onClick`）。
- `App.tsx` 实现：

```ts
const handleDeleteConversation = useCallback((id: string) => {
  setConversations((prev) => prev.filter((c) => c.id !== id));
  if (streamingRef.current?.convId === id) streamingRef.current = null;
  setActiveId((prev) => {
    if (prev !== id) return prev;
    setScene('home');
    return null;
  });
}, []);
```

### 5.3 受影响文件

| 文件 | 修改类型 | 说明 |
| --- | --- | --- |
| `src/app/renderer/src/App.tsx` | 修改 | 新增 eviction helper、替换三处 setActiveId、新增 handleDeleteConversation、传入 Sidebar |
| `src/app/renderer/src/components/Sidebar.tsx` | 修改 | Props 增加 `onDeleteConversation`；`ConvItem` 增加 × 按钮 |
| `src/app/renderer/src/sidebar.css` | 修改 | 复用 `.sidebar-project-remove` 思路新增 `.sidebar-item-remove`（hover 浮现、× 图标），不引入新 token |
| `tests/unit/conversation-lifecycle.test.ts`（新建） | 新增 | 单测 eviction 与删除逻辑（reducer-style 纯函数提取） |
| `CHANGELOG.md` | 修改 | `[Unreleased]` 增加 `feat: 空对话切走自动清理` 与 `feat: 侧边栏对话支持删除` |

为方便测试 §5.1，将 eviction 与 delete 的纯计算部分以无副作用函数形态抽到组件文件顶部（不另起 lib 文件，遵守"能编辑就不新建"），形如：

```ts
// 纯函数：计算 activeId 转换后的 conversations 快照
export function evictEmptyOnLeave(
  convs: Conversation[],
  prevId: string | null,
  nextId: string | null,
): Conversation[] { ... }

export function deleteConversation(
  convs: Conversation[],
  id: string,
): Conversation[] { ... }
```

> 例外：因为 `App.tsx` 已偏长，且这两个纯函数对外可测试，**改为新建 `src/app/renderer/src/lib/conversations.ts`** 一个文件。已在 §6 列入 plan 评估。

### 5.4 边界与异常

- `prevId == null`（启动后第一次进入）→ 跳过 eviction。
- `prevId === nextId` → 跳过 eviction。
- `prevId` 在 `conversations` 中不存在（理论上不会发生，但若发生）→ 视为 no-op。
- 删除非 active 对话时，不动 scene、不动 activeId。
- 删除 active 对话时：activeId=null + scene=home。如果当前 scene 已是 splash/install（理论上 sidebar 不可见，无法触发），保持现 scene。
- 当被 evict / delete 的对话曾是流式发起源（理论不应是空对话，但 delete 可能命中已 streaming 的非空对话）：清空 `streamingRef.current` 防止悬挂回调写到不存在的对话。

## 6. 数据流

```
用户点击「+ 新建对话」
  → createConversation() 创建空 conv → setActiveIdWithEviction(newId)
    （prevId 若是另一空对话 → 该空对话被 evict）

用户在 Sidebar 点其它 ConvItem
  → selectConversation(otherId) → setActiveIdWithEviction(otherId)
    （prevId 若是空对话 → evict）

用户在 Composer 第一次发送
  → send(text) → setActiveIdWithEviction(targetId === prevId 常态 → no-op)
  → conversation.messages 增长 → 不再是空对话 → 永不会被回收

用户点 Sidebar ConvItem 的 ×
  → onDeleteConversation(id) → conversations 过滤掉该 id
    若 id === activeId → activeId=null, scene='home'
    若 streamingRef.convId === id → streamingRef=null
```

## 7. 风险

| 风险 | 缓解 |
| --- | --- |
| 用户期待"新对话"长期保留即使没发送 | 与截图诉求矛盾——本 spec 已对齐"留着没有意义" |
| 切到 home（点返回首页）但仍想保留草稿 | `back()` 不改 activeId（仅切 scene），不触发 eviction；草稿仍在 |
| 误删 | 暂不引入 undo（与现有移除项目体验一致）；未来由独立 SDD 决定 |
| 流式中删除导致 chunk 写入幽灵记录 | `useStream` 已经做了 `prev.map((c) => c.id !== ref.convId ? c : ...)` 形态；id 不存在则不写。同时清空 streamingRef 即足够 |

## 8. 预期验证

- **单测**（vitest）：`tests/unit/conversation-lifecycle.test.ts`
  - `evictEmptyOnLeave`：空对话被回收、非空对话保留、prevId=nextId no-op、prevId=null no-op
  - `deleteConversation`：移除存在/不存在 id 行为正确
- **手动 e2e（截图放 PR）**：
  1. 进入 chat 后切到另一对话 → 旧空对话消失
  2. 直接点新建对话两次 → 列表中只剩 1 条空对话
  3. 已发消息的对话 → 切走仍保留
  4. 侧边栏对话 hover → × 出现，点击删除该项；删 active 对话回首页
  5. 删除 streaming 中的对话 → 不再有 chunk 写入（控制台无错）
- **闸门**：`pnpm pre-commit`（含 `pnpm test` / `tsc --noEmit` / oxlint / 可视化结构检查）必须全绿

## 9. 设计契约

仅复用 `sidebar.css` 既有 token 与原语样式（`.sidebar-project-remove` 同形）。无新增颜色、字号、间距、动效；视觉档位 🟢，PR 附 hover-state 截图。
