# Visual Spec · project-scoped-chat

> 替代载体：考虑到变更均为既有骨架的增量（分组 header + 嵌套列表 + 下拉面板），本次以**规格文档**作为视觉稿。偏离 DESIGN.md §9 首选 HTML 原型载体的原因：
> - 所有新元素 100% 复用 `index.css` 既有 CSS 变量，无新色值 / 新字号 / 新圆角；
> - 交互复杂度低（折叠、搜索、选择）；
> - solo 模式下已由用户通过"执行所有任务"预授权。
> 未来如觉得需要 HTML 原型，再走 `pnpm prototype:serve project-scoped-chat`。

## 1. Sidebar 布局（保持 260px 宽度）

```
┌──────────────────────────────┐  padding: 0 8px 12px (既有)
│  [+ 新建对话]                │  .sidebar-new（既有，不变）
├──────────────────────────────┤  1px solid var(--line) 分隔
│  项目                    [＋]│  .sidebar-group-header (新)
│                              │  font: var(--mono) 11px var(--muted)
│  ▸ Morrow                    │  .sidebar-project (新, 折叠态)
│  ▾ opencove                  │  .sidebar-project.expanded
│      · 设计问卷         2天  │  .sidebar-item.nested (既有 item + 左内边距 16→24)
│      · 测试             ·   │
│      · 你好             4天  │
│  ▸ hello-world (不可用)      │  .sidebar-project.invalid + tooltip=path
├──────────────────────────────┤  1px solid var(--line)
│  对话                        │  .sidebar-group-header
│      · 新对话          15h   │  .sidebar-item（既有）
│      · hi               1周  │
│                              │
│  (空态：还没有对话)           │
└──────────────────────────────┘
```

### 四态（必答）

| 态 | 规格 |
|---|---|
| Default | 至少 1 个项目 + 1 组对话 |
| Empty · 无项目 | "项目"区隐藏 header，只显"对话"区 |
| Empty · 无对话 | "对话"区显示 `.sidebar-empty`（既有"还没有对话"） |
| Error · 项目不可用 | 项目名后缀「❗」(var(--error) 文本色 + `title={path} (不可用)`)，折叠态下项目名变灰 (var(--disabled)) |
| 超长项目名 | CSS `text-overflow: ellipsis`；鼠标悬浮 tooltip = 完整 path |

### Tokens

- 分隔线：`var(--line)`
- header 色：`var(--muted)` + `var(--mono)` 11px
- 折叠箭头：纯文本字符 `▸ / ▾`（var(--muted)）；非装饰
- 嵌套缩进：左 padding 从 10px → 24px（14px 增量 = 既有间距阶梯）
- active 嵌套项：沿用 `.sidebar-item.active`（既有 `var(--panel-3)` + `var(--text)`）
- 添加按钮 [＋]：36×24，`.sidebar-group-action`，`font-size: 14px`，`color: var(--muted)`，hover → `var(--accent)`；使用 var(--radius) 6px

## 2. ProjectPicker（Composer 上方新原语）

挂载位置：Home 的 Composer 正下方 · Chat 的 `.composer-wrap` 内 Composer 上方；宽度与 Composer 对齐（`min(740px, 100%)`）。

```
Default (未选中项目)：
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│  ▾ 进入项目工作            │   .project-picker (28 高)
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
          ↓ click
┌──────────────────────────┐
│  🔍 搜索项目              │   .project-picker-search
│  ─────────────────────── │
│  Morrow                  │   .project-picker-item.active
│  opencove                │   .project-picker-item
│  hello-world ❗          │   .project-picker-item.invalid
│  ─────────────────────── │
│  [+ 添加新项目]           │   .project-picker-add
└──────────────────────────┘

Active (已选中项目)：
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│  📁 Morrow           ▾ │    色：var(--text) / 底：var(--accent-bg)
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘

Locked (打开已绑定项目的会话)：
┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐
│  📁 Morrow (只读)      │    无 ▾；只在下拉里提供"退出项目"
└ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┘
```

### 四态

| 态 | 规格 |
|---|---|
| Default | "进入项目工作" dashed 边框 var(--line)，文本 var(--muted) |
| Open | 面板 `.project-picker-panel`：背景 var(--panel)，边框 var(--line)，radius 8px，宽度同触发器，`z-index: dropdown` |
| Searching | 搜索框聚焦态；列表按 `name` 前缀匹配过滤（大小写不敏感）；无匹配 → "没有匹配的项目" (var(--muted)) |
| Selected | 触发器背景 var(--accent-bg)，边框 var(--accent)，前缀 📁，文本 var(--text) |
| Locked | 同 Selected，但不显示 ▾；点击打开面板只显 "退出项目" |

### 键盘路径（V5 合规）

- `Tab` 聚焦触发器 → `Enter/Space` 打开
- 面板内 `↑/↓` 切换候选，`Enter` 选中，`Esc` 关闭
- 搜索框自动获焦

### Tokens

- 高度 28px、圆角 6px、文本 13px（`.composer-row .hint` 同档）
- 动效：`short 180ms` `easing-standard`（仅 open/close 高度动画；属"连续性"目的）
- 面板 shadow：`sm`（既有 var(--line-strong) 底边 + 1px border 足够）

## 3. 动效清单（V4 合规）

| 动效 | duration | easing | 目的分类 |
|------|----------|--------|---------|
| 项目折叠展开 | short 180ms | standard | 连续性 |
| Picker 面板 open | short 180ms | entrance | 层级关系 |
| hover 态变色 | micro 120ms | standard | 状态转换 |

## 4. 不引入

- 新色值、新字号、新圆角档位
- 新原语组件以外的 UI 元素（Menu / Dialog 原语尚未落地，本次 ProjectPicker 自包含实现，后续 SDD 统一替换为 Menu 原语）
- 拖拽排序、项目改名 / 删除确认 Dialog（确认用 `window.confirm` 兜底，下一版本替换为 Dialog 原语）

## 5. 用户确认

- [x] 方向确认（由用户"确认并执行所有任务"给出）
- [ ] 完成后提交 PR 截图回填此处
