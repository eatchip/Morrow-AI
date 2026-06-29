# ADR 0005: 设计审美北极星（Design North Stars）

- **Status**: Accepted
- **Date**: 2026-05-12
- **Deciders**: 项目 owner
- **Tags**: design / aesthetics / architecture

---

## Context

Morrow 当前处于 Harness Refinement 阶段，现有规范覆盖流程（AGENTS.md / playbooks）与技术（ADR 0001–0004），但**设计维度完全缺位**。

项目 owner 在先前项目（OpenCove）的设计实践中识别出四类重复失败模式：

- **A1 — 没有北极星**：缺少明确的审美基准与对标应用，全凭手感决策
- **A2 — 标准模糊**：即便提出"要好看"，也因缺少可验收的尺度而无法执行
- **B3 — 无视觉评审闸门**：代码评审只看逻辑，视觉问题常常漏到线上
- **C3 — 动效手感廉价**：过渡/反馈/延迟不一致，破坏整体质感

其中 A1 是根源：**没有锚点，则 A2/B3/C3 的补救都会失焦**。因此本 ADR 的职责是先钉死"像什么"，为后续 `docs/design/DESIGN.md` 与 `docs/playbooks/design-review.md` 提供可引用的北极星。

### 约束

- **Solo 开发者**：无团队文化与设计师兜底，所有锚点必须显式写下，不能靠"默契"
- **产品形态尚未锁定**：benchmark 必须基于**假设性的产品形态**做出，不得反过来锁死产品本身
- **技术栈已定为 Electron + React**（ADR 0004）：benchmark 必须是在 Web/桌面 UI 技术范式内可还原的
- **付费 Figma 权益**：benchmark 应能与 Figma 生态 / MCP 读写链路配合

### 前提假设

本 ADR 采用的产品形态假设为 **"通用生产力工具"**（面向信息/任务/知识场景，而非创意工具或媒体消费）。若未来产品形态发生重大偏移（如转型为创意工具、内容消费产品），本 ADR 应走 Supersede 流程，而不是悄悄漂移。

---

## Decision

**Morrow 采用双层 benchmark 定位**：

> **Linear 为骨架基准（信息结构、密度、克制美学）**
> **Arc 为血肉基准（动效哲学、色彩注入、产品生命力）**

### Scope of this Decision

- 全仓库所有用户可感知界面适用
- 适用于深浅双模式设计（Linear 与 Arc 均为主流流派中对双模式支持最好的之一）
- **不**锁定具体的色值、字号、间距、圆角、阴影等 token —— 这些属于 `DESIGN.md` 的决策
- **不**锁定具体的组件原语目录、文件组织方式 —— 这些属于 `tech-stack-scaffold` 后续的 SDD
- **不**锁定产品形态本身 —— 本 ADR 的前提假设可被替换

### Benchmark 分工详解

| 维度 | 主基准 | 辅基准 | 说明 |
|---|---|---|---|
| 信息结构与层级 | **Linear** | — | 列表/看板/详情页的信息密度与层级节奏 |
| 克制美学与留白 | **Linear** | — | "少即是多"，强调内容本身而非装饰 |
| 四态第一等公民 | **Linear** | — | Empty / Loading / Error 与 Default 同等设计投入 |
| 深浅双模式质感 | **Linear** | Arc | Linear 的冷静 + Arc 的氛围 |
| 动效与微交互 | — | **Arc** | spring 驱动的连续性与层级感，有"生命"不浮夸 |
| 色彩策略 | 基础 Linear | **Arc 主导强调色** | 主体冷灰骨架 + 局部饱和色点缀 |
| 主题化能力 | — | **Arc** | 预留用户主题扩展空间（非本 ADR 决策项，但不排斥） |
| 键盘可达性与 command palette | Linear / Arc 兼参 | — | 两者都强调键盘优先，取交集 |

---

## Consequences

### Positive

- **为 `DESIGN.md` 提供了可引用的具体参照**：原则不再是"要好看"而是"在 Linear 的密度下加 Arc 的动效"
- **降低审美抉择成本**：solo 开发者在犹豫时有可对照的参考实现
- **与 Figma 生态契合**：Linear 与 Arc 在 Figma 社区均有公开设计资源可研究
- **深浅双模式天然兼容**：两者都把暗色作为一等公民，不是后期补丁
- **可验收**："是否更接近 Linear/Arc" 比 "是否好看" 更易形成共识

### Negative / Trade-offs

- **仿品同质化风险**：Linear 系产品近三年激增，存在"又一个 Linear 仿品"的市场风险
- **Arc 的动效预算最高**：solo 开发者容易在动效上过度投入或做不到位
- **前提假设耦合产品形态**：若未来转型为创意工具/媒体消费产品，本 ADR 失效
- **审美有衰退周期**：Linear 的克制与 Arc 的生命力属于 2022–2026 的主流审美；3–5 年后可能需复审

### Mitigations

- **差异化锚点**：在 `DESIGN.md` Anti-Patterns 中显式列出"不做纯 Linear 复刻"的具体规则（如至少一处 Arc 式强调色点缀）
- **动效预算护栏**：Motion Contract 的 duration 分级与白名单限制动效复杂度，防止在 Arc 方向过度发力
- **强制复审机制**：本 ADR 约定**每 6 个月**或**产品形态发生重大变化时**必须进行一次复审（见 Review Cadence）
- **Supersede 而非原地改**：审美方向调整必须新起 ADR，不得悄悄改本 ADR，保留变更轨迹

### Neutral

- 后续 SDD `tech-stack-scaffold` 与 `design-tokens-enforcement` 的 token 粒度会受到本 ADR 影响（需要覆盖 Linear 的冷灰骨架 + Arc 的强调色 + 双模式）
- 本 ADR 不强制要求所有页面"看上去像 Linear 或 Arc"，而是要求**设计决策能追溯到这两个基准的某一个维度**

---

## Alternatives Considered

作为备选的 4 个美学流派均经过评估，最终只采用 A（主）+ D（辅）的组合：

| 方案 | 代表作 | 未采纳原因 |
|---|---|---|
| **流派 A — 极简信息工具派（纯 Linear 系）** | Linear / Height / Notion / Superhuman | 单独采用时过于冷峻，与 solo 个人工具预期情绪不匹配；仿品同质化风险最高 |
| **流派 B — 原生质感派（Things 系）** | Things 3 / Bear / iA Writer / Craft | 信息密度过低，不适配"通用生产力"的密集操作场景；Windows/Linux 原生质感还原差 |
| **流派 C — 键盘命令派（Raycast 系）** | Raycast / Warp / Cursor / Zed | 对非技术用户陡峭；亮色模式往往是二等公民；与 Morrow 的潜在通用性冲突 |
| **流派 D — 创意生命力派（纯 Arc 系）** | Arc / Figma / Framer | 单独采用时动效预算与视觉复杂度过高，solo 长期维护成本不可控；3 年衰退风险最大 |
| **A 主 + D 补（采纳）** | Linear 骨架 + Arc 血肉 | 用 Linear 的结构化与克制承重，用 Arc 的动效与色彩注入差异化，对 solo 最可持续 |
| **等权混搭 A + D** | — | 权重模糊会导致"风格漂移"，必须明确主次以作审美决策依据 |

---

## Review Cadence

本 ADR 明确要求以下两种复审触发：

1. **时间触发**：自 Accepted 起每 6 个月复审一次；复审结论有三种：维持 / 小幅修订（同 ADR 打补丁）/ Supersede（新 ADR 替换）
2. **事件触发**：
   - Morrow 产品形态发生重大变化（脱离"通用生产力"假设）
   - 技术栈发生重大变化（ADR 0004 被 Supersede）
   - Linear 或 Arc 发生根本性重设计，导致当前基准失效
   - 行业主流审美发生跃迁（新流派成熟度显著超越当前 benchmark）

复审产物：即便维持现状，也必须在 `CHANGELOG.md` 中记录"本次复审结论：维持"，保留审计轨迹。

---

## Follow-ups

本 ADR **只钉死审美北极星**，以下内容在其他文件/SDD 中承接：

- **`docs/design/DESIGN.md`**（随本次 SDD `design-harness` 同步产出）：把本 ADR 的基准翻译为可验收的原则、tokens 规约、Motion Contract、组件原语清单、State Coverage 清单
- **`docs/playbooks/design-review.md`**（随本次 SDD 同步产出）：视觉稿前置闸门流程与 solo 自检五步
- **后续 SDD `design-tokens-enforcement`**（在 `tech-stack-scaffold` 之后）：把 token 软规则升级为 lint 强制
- **后续 SDD `visual-primitives-scaffold`**（TBD）：按本 ADR 基准落地真实的原语组件

> 编号提示：ADR 0004 的 Follow-ups 列表预留了 0005/0006/0007 给"命名前缀 / 发布流程 / i18n"。本 ADR 征用 0005，上述三项在实际创建时将顺延为 0006+（ADR 0004 的列表为"规划中"条目，不视为状态变更）。

---

## References

- **内部前置**：[ADR 0001](./0001-adopt-agents-md.md)、[ADR 0002](./0002-harness-dual-file.md)、[ADR 0003](./0003-sdd-workflow.md)、[ADR 0004](./0004-tech-stack.md)
- **关联 SDD**：`.comate/specs/design-harness/doc.md`（本 ADR 产出上下文）
- **Benchmark 外部参考**：
  - Linear — [linear.app](https://linear.app)，公开的 Changelog 与 Blog 对其设计语言多次拆解
  - Arc — [arc.net](https://arc.net)，The Browser Company 的设计哲学系列访谈
  - Things 3 — 作为流派 B 的代表，Apple Design Award 多次获奖案例
  - Raycast — [raycast.com](https://raycast.com)，键盘命令派代表
- **设计系统撰写源**：
  - Refactoring UI（Adam Wathan / Steve Schoger）
  - Apple Human Interface Guidelines（macOS 章节）
  - Material Design 3 Foundations（作为 token 结构参考，非审美参考）
