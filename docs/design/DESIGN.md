# DESIGN.md — Morrow 设计系统

> **地位**：Morrow 视觉与交互决策的 source of truth，与 [`ARCHITECTURE.md`](../architecture/ARCHITECTURE.md) / [`DEVELOPMENT.md`](../../DEVELOPMENT.md) 平级。
> **北极星**：[ADR 0005](../decisions/0005-design-north-stars.md) —— Linear 为骨架基准，Arc 为血肉基准。
> **评审**：视觉稿前置闸门与 solo 自检流程见 [`docs/playbooks/design-review.md`](../playbooks/design-review.md)。
> **强制力**：本文档中的"原则"由 code review 把关；`tech-stack-scaffold` 落地后升级为 lint 强制。

---

## 0. 如何使用本文档

- 开始任何含 UI 变更的 Spec 前：通读 § 1 Design Philosophy + § 2 Anti-Patterns + § 8 可验收标准总表
- 实现期间：按需查 § 3 Tokens 与 § 4 Motion Contract
- 合入前：按 [`design-review.md`](../playbooks/design-review.md) 的五步自检
- 发现本文无法指导的新情形：新起 ADR，而非内联 "just this once"

---

## 1. Design Philosophy

**信条不是口号。下列每一条都附可验收标准，使其可被 review、未来可被 lint。**

### 1.1 信息是内容，界面是背景

界面的职责是让用户看清**信息本身**，而非展示界面的存在感。

**可验收**：主色在一屏内出现次数 ≤ 3；装饰性图形（非功能性 icon / 无语义的插画 / 纯装饰渐变）数量 = 0。

### 1.2 密度优先，呼吸辅助

承袭 Linear，在可读性前提下偏向高信息密度；留白服务于层级与节奏，不服务于"看上去高级"。

**可验收**：主要工作界面一屏可见信息项 ≥ 对标 Linear 同类场景的 80%；行高与字号比例在 § 3.2 白名单内。

### 1.3 状态即第一等公民

Empty / Loading / Error 与 Default 拥有**同等的设计投入**，而非"先做 Default 再补其他"。

**可验收**：任何新页面/新组件 Spec 必须包含四态完整描述（见 § 6），四态截图必须出现在 PR。

### 1.4 动效服务于连续性，不服务于装饰

承袭 Arc，动效仅在"连续性 / 层级关系 / 状态转换"三类目的下存在，禁止"因为好看所以加"。

**可验收**：每一处动效必须在代码注释或 Spec 中标明目的归类；不属于三类的动效视为违规。

### 1.5 键盘先行，鼠标后补

所有主要操作必须有键盘路径；鼠标/触控是对键盘的**补充**而非替代。

**可验收**：任何新 Flow 必须在 design-review.md Phase 1 第 5 步"键盘全流程"中走通；缺少键盘路径的操作视为未完成。

### 1.6 克制地使用色彩

主体使用冷灰骨架（Linear 式），强调色（Arc 式）作为**指引而非点缀**，且在语义上一致（不在同一界面内让同色有多种含义）。

**可验收**：单一主色在同屏最多承担 1 种语义；彩色面积占比 ≤ 10%；禁止装饰性多色渐变背景。

---

## 2. Anti-Patterns（显式禁止清单）

以下模式**不经 Spec 显式讨论禁止使用**。出现即视为违反设计契约。

- ❌ **硬编码视觉属性**：`style={{color: '#3b82f6'}}` / `padding: 13px` / `transition: 0.3s ease` 等。所有视觉属性必须来自 § 3 Tokens。
- ❌ **装饰性渐变背景**：任何"为了好看"而存在的渐变背景（功能性的除外，如进度条、skeleton）
- ❌ **阴影堆叠**：同一元素同时使用超过 1 层阴影（不包括内外组合的语义用途）
- ❌ **多字体家族混用**：超出 § 3.2 白名单之外的字体家族
- ❌ **装饰性动画**：不服务于 § 1.4 三类目的的动画（hover 时抖动、进入时弹跳等）
- ❌ **模态滥用**：能用内联/侧栏解决的交互绝不使用全屏模态
- ❌ **半透明叠层嵌套**：两层以上 backdrop-filter 嵌套（性能与视觉双灾难）
- ❌ **失去状态**：仅有 Default 态的组件（参见 § 6 四态强制）
- ❌ **键盘死角**：仅能通过鼠标触发的操作（例外：拖拽必须有键盘替代路径，如方向键 + 修饰键）
- ❌ **文本截断不可恢复**：超长文本仅 `text-overflow: ellipsis` 而无 tooltip/详情访问路径
- ❌ **"仅此一次"样式覆盖**：在组件消费处写 `style={{...}}` 覆盖原语组件样式。若原语不够用，走 token 或原语扩展 ADR。

---

## 3. Design Tokens（规约层）

> **本章是规约**，不是代码实现。token 源码文件将由后续 SDD `design-tokens-enforcement` 产出；在此之前，本章内容由 code review 作为唯一依据。

### 3.1 Color

Token 结构采用**语义层 + 基础色阶**双层：

- **基础层**（`gray-50 ... gray-950` / `blue-50 ... blue-950` 等）：仅用于定义语义层，**不**在组件消费处直接使用
- **语义层**（`bg-surface` / `text-primary` / `border-subtle` / `accent` 等）：组件消费处唯一合法引用

**双模式**：语义 token 必须同时定义 light 与 dark 值，不允许仅有一侧。

**主色约束**：单一主色（accent），不预设次色；次色需走 ADR 新增。

**具体色值**本次不钉，延后到 `design-tokens-enforcement` 阶段；但约束**结构**已经确定。

### 3.2 Typography

**字体家族白名单**（任何新增需 ADR）：
- **UI 文本**：系统字体优先（`-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, ...`）
- **等宽**：`ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, Consolas, monospace`

**字号阶**（初定 8 档，可随 token 落地微调）：
- `xs / sm / base / lg / xl / 2xl / 3xl / 4xl` — 不得出现白名单外的字号

**行高规则**：UI 文本行高 ∈ [1.3, 1.6]；长文本阅读 ∈ [1.5, 1.75]；其余需 ADR。

**字重白名单**：`regular(400) / medium(500) / semibold(600) / bold(700)`，禁用 100/200/300/800/900 除非品牌场景 ADR 允许。

### 3.3 Spacing

**间距阶**（基于 4px 基准）：
`0 / 1(4) / 2(8) / 3(12) / 4(16) / 5(20) / 6(24) / 8(32) / 10(40) / 12(48) / 16(64) / 20(80) / 24(96)`

**消费规则**：只能使用本阶梯，禁止中间值（如 `padding: 13px`）。

### 3.4 Radius

`none(0) / sm(4) / md(6) / lg(8) / xl(12) / 2xl(16) / full(9999)` —— 六档 + 全圆，无其他。

**语义约束**：
- 交互元素（Button / Input / Menu item）：`md` 或 `lg`
- 容器（Card / Dialog）：`lg` 或 `xl`
- 微标签（Badge / Tag）：`sm` 或 `full`

### 3.5 Shadow

四档阴影 token（light 与 dark 分别定义）：
- `none` — 无
- `sm` — 贴近元素（hover / subtle elevation）
- `md` — 浮层（Popover / Menu）
- `lg` — 高浮层（Dialog / Toast）
- `xl` — 全屏覆盖（Command palette）

**规则**：同一元素同时只能应用一档；**禁止**嵌套/叠加阴影。暗色模式阴影透明度通常低于亮色，但必须保持层级区分可见（不是"暗模式就没阴影"）。

### 3.6 Z-Index

语义分层（数值本次不钉，结构已确定）：

```
base       — 常规流内容
sticky     — 置顶区块
dropdown   — 下拉菜单
popover    — 气泡浮层
tooltip    — 提示浮层
dialog     — 模态对话框
toast      — 消息
commandbar — 命令面板（最高）
```

**规则**：组件消费处只能引用语义 token（`z-dialog` 等），禁止使用裸数值；新增语义层需 ADR。

### 3.7 Motion Tokens

Duration 与 Easing 见 § 4 Motion Contract；作为 token 暴露时命名遵循：
- `duration-instant / micro / short / medium / long`
- `easing-standard / entrance / exit / emphasized`

---

## 4. Motion Contract

### 4.1 Duration 五档

| 档位 | 时长 | 语义场景 |
|---|---|---|
| `instant` | 0ms | 即时切换（tab 切换、选中态） |
| `micro` | 120ms | 微反馈（hover 变色、图标切换） |
| `short` | 180ms | 组件内过渡（expand/collapse 小范围） |
| `medium` | 240ms | 页面级过渡（Dialog 打开、Drawer 滑入） |
| `long` | 320ms | 路由级过渡（页面切换、重大状态转移） |

**规则**：超出上述范围的时长必须开 ADR 说明。`long` 以上时长（>320ms）**不得**用于常规 UI 过渡。

### 4.2 Easing 白名单

采用"目的 → easing"的绑定方式：

| 用途 | 推荐曲线 | 说明 |
|---|---|---|
| 标准过渡（默认） | `cubic-bezier(0.4, 0.0, 0.2, 1)` | Material standard；平衡进出 |
| 入场（无出场配对） | `cubic-bezier(0.0, 0.0, 0.2, 1)` | 加速进入，有存在感 |
| 出场（无入场配对） | `cubic-bezier(0.4, 0.0, 1, 1)` | 快速离场，不拖沓 |
| 强调（关键转场） | spring(stiffness=180, damping=20) | Arc 式有弹性但不浮夸 |

**禁止**：`ease` / `linear`（除非用于 skeleton / progress 等持续动画）/ `ease-in-out` 作为默认兜底。

### 4.3 反馈延迟契约

| 用户感知阈值 | 必须提供的反馈 |
|---|---|
| > 100ms 的点击 | 视觉态变化（按下态 / loading 颜色） |
| > 300ms 的操作 | 显式 loading 指示（spinner / skeleton） |
| > 1s 的操作 | 进度指示（确定进度条或阶段文案） |
| > 10s 的操作 | 可取消 / 后台化选项 |

### 4.4 动画目的三分类

所有动画必须归属以下之一，并在代码注释或 Spec 中标明：

1. **连续性（Continuity）**：让用户理解"这个元素从 A 变成了 B"（如抽屉从边缘滑入）
2. **层级关系（Hierarchy）**：让用户感知"这是临时浮层，那是背景"（如 Dialog 背景模糊 + 前景提升）
3. **状态转换（State Transition）**：让用户看到"状态已改变"（如勾选态 check mark 画出）

**不属于以上三类 = 装饰性动画 = 违规**。

---

## 5. Component Primitives 清单

以下元素**必须**通过原语组件消费，不得在 feature 代码中直接写 `<div>` + 样式：

| 原语 | 最小职责 | 不得绕行的规则 |
|---|---|---|
| `Button` | 主次操作入口 | 禁止用 `<div onClick>` 做按钮 |
| `IconButton` | 纯图标操作 | 同上；必须有 aria-label |
| `Input` / `Textarea` | 文本输入 | 禁止裸 `<input>` 写 UI |
| `Select` / `Menu` | 离散选择 | 键盘必须可达 |
| `Card` | 容器分组 | 控制 radius / shadow / padding 一致性 |
| `Dialog` | 模态 | 必须 trap focus 与 ESC 关闭 |
| `Toast` / `Banner` | 反馈消息 | 限制同时显示数量（建议 ≤ 3） |
| `Tooltip` | 补充说明 | 键盘 focus 也必须触发 |
| `Tabs` | 视图切换 | 键盘方向键导航 |
| `Skeleton` | 加载占位 | 尺寸必须与最终内容一致 |
| `EmptyState` | 空态载体 | 必须提供"下一步行动"而非仅文案 |

> 原语组件的实际代码实现属于 `tech-stack-scaffold` 之后的 SDD；本清单是**契约承诺**。新增原语需独立 ADR 或小 SDD。

---

## 6. State Coverage Checklist

任何**用户可见的视图单元**（页面 / 主要区块 / 列表 / 组件）必须覆盖以下状态。Spec 中缺失任何一档即视为 Spec 不完整。

| 状态 | 必答问题 | 常见失败 |
|---|---|---|
| **Default** | 有数据、无错误、常规尺寸下长什么样？ | — |
| **Empty** | 零项数据时显示什么？有无行动建议？ | 仅显示"暂无数据" |
| **Loading** | 首次加载 / 增量加载 / 后台刷新 三种 loading 分别长什么样？ | 全屏 spinner 替代局部 skeleton |
| **Error** | 网络错误 / 权限错误 / 数据错误 分别怎么显示？用户可做什么恢复动作？ | 仅显示"出错了" |
| **极端数据 · 0 项** | 列表 / 表格 / 图表的零态？ | 与 Empty 混淆 |
| **极端数据 · 超长文本** | 长标题 / 长内容 如何截断？如何访问完整版？ | 仅 ellipsis，无 tooltip |
| **极端数据 · 1000+ 项** | 列表滚动性能、虚拟化策略 | 直接 render 爆内存 |
| **响应式尺寸** | 窗口 320px / 800px / 1440px / 超宽 分别什么表现？ | 仅测试开发机尺寸 |
| **权限态**（如涉及） | 未登录 / 无权限 / 受限功能 如何提示？ | 直接 401 跳转 |

---

## 7. Density & Rhythm

### 7.1 信息密度三档

| 档位 | 行高 | 字号 | 间距单位 | 典型场景 |
|---|---|---|---|---|
| `compact` | 紧 | `sm` | 小 | 表格、密集列表 |
| `comfortable`（默认） | 中 | `base` | 中 | 常规工作界面 |
| `spacious` | 松 | `base/lg` | 大 | 阅读态、营销页 |

**规则**：同一视图内密度档位必须一致；不得在一屏混用 compact 与 spacious。

### 7.2 节奏原则

- **同级元素保持等距**：间距用 § 3.3 阶梯，不得"大致相等"
- **层级差异用 ≥ 2 档**：主次层级间距差至少跨越阶梯 2 档，否则层级感消失
- **对齐轴收敛**：一屏内的左对齐 / 右对齐 / 居中轴数量 ≤ 3

### 7.3 负空间原则

留白不是"空的地方"，而是用来**制造呼吸节奏**与**强调层级**的主动元素。禁止为填充而填充。

---

## 8. 可验收标准总表（Review / Lint 依据）

本表是上述所有原则的**索引**，review 时按此表逐项核对：

| 编号 | 来源 | 可验收标准 | 阶段 |
|---|---|---|---|
| V1 | § 1.1 | 主色在一屏内 ≤ 3；装饰性图形 = 0 | review |
| V2 | § 1.2 | 信息密度对标 Linear 同类场景 ≥ 80% | review |
| V3 | § 1.3 | Spec 含四态完整描述；PR 含四态截图 | PR gate |
| V4 | § 1.4 | 动效代码有目的注释，归属三分类之一 | review / 未来 lint |
| V5 | § 1.5 | design-review 五步中第 5 步（键盘全流程）通过 | PR gate |
| V6 | § 1.6 | 彩色面积占比 ≤ 10%；同色 ≤ 1 种语义 | review |
| V7 | § 2 | 未出现 Anti-Patterns 清单中的模式 | review / 未来 lint |
| V8 | § 3.1–3.7 | 无硬编码视觉属性；token 全部来自语义层 | review / 未来 lint |
| V9 | § 4 | 所有动效 duration / easing 来自白名单 | review / 未来 lint |
| V10 | § 5 | feature 代码消费原语组件，未裸写 UI 元素 | review / 未来 lint |
| V11 | § 6 | 可见视图单元四态 + 极端数据态完整 | Spec gate + PR gate |
| V12 | § 7.1 | 同一视图密度档位一致 | review |
| V13 | § 7.2 | 对齐轴数量 ≤ 3 | review |

> **Spec gate**：Spec 评审阶段卡关
> **PR gate**：PR 模板 checklist 卡关
> **review**：人工 code review 把关
> **未来 lint**：`design-tokens-enforcement` SDD 后由自动化把关

---

## 9. 视觉稿前置闸门触发表

> 本表被 [AGENTS.md § 4](../../AGENTS.md) / [`design-review.md`](../playbooks/design-review.md) / [PR 模板](../../.github/pull_request_template.md) 引用。三处必须保持一致，改一处 = 改三处。

| 变更类型 | 档位 | 视觉稿要求 |
|---|---|---|
| 新页面 / 新 Flow / 布局重构（IA 变动） / 新原语组件 | 🔴 | **必须前置完整视觉稿** |
| 新动效 / 新过渡 / 新微交互 | 🟡 | **必须前置交互原型**（可交互 HTML 或录屏） |
| 已有组件局部修改（文案、图标、微调 padding / margin） | 🟢 | 截图放 PR 即可 |
| 纯逻辑 / 文档 / 不可见变更 | ⚪ | 无要求 |

**载体优先级**（自 SDD `design-review-html-first` 起生效）：

同级首选：
- **AI 生成的 HTML 可交互原型**（本项目主场景；产出规约见 [`design-review.md § AI 产出 HTML 原型规约`](../playbooks/design-review.md#ai-产出-html-原型规约)）
- **Figma 文件**（Figma MCP 接通后 / 人工产出）

降级载体：
- 位图 mockup / `create-image` / `imagegen` 产物（仅用于方向对齐，不作为还原参照）

> HTML 原型与 Figma 不再分"首选 / 降级"，择一即可，无需在 Spec 中做载体选择留痕。

---

## 10. 附录

### 10.1 与 ADR 的关系

- 新增 token 类别 / 修改现有 token 结构 / 新增原语 / 修改 Motion Contract 五档 → 开 ADR
- 仅调整 token 具体值（如改某个阶梯的 px 值） → 本文档内 PR 即可，走常规 review
- 修改 Anti-Patterns 清单 → 本文档内 PR，但需在 PR 描述中附决策依据

### 10.2 与 `tech-stack-scaffold` 的分工

| 在本文档 | 在 `tech-stack-scaffold` 之后 |
|---|---|
| 规约 token 的**结构**与**名称** | 落地 token 的**具体值**与**源码文件** |
| 规定"必须用 token" | 用 lint 规则强制"必须用 token" |
| 原语组件**清单** | 原语组件**实现代码** |

### 10.3 参考资料

- [ADR 0005 Design North Stars](../decisions/0005-design-north-stars.md)
- Refactoring UI —— token 结构与层级参考
- Material Design 3 Foundations —— token 命名参考（非审美参考）
- Apple Human Interface Guidelines —— macOS 原生质感参考
- Radix UI / Ark UI / React Aria —— 原语组件行为参考（实现期间选用一家）
