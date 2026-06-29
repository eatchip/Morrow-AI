# Dry Run · 主窗口命令面板（command-palette，假想）

> **用途**：验证本次 `design-harness` 产出的流程、模板、闸门能在一个真实场景中自洽运转。
> **不入主干**：此文件为干跑记录，不代表 Morrow 真的要做命令面板。
> **载体**：假想一个 UI feature，仅走流程、不产实现代码。

---

## 1. Triage

- 涉及：主窗口新增全屏模态 `Command Palette`，支持键盘驱动的操作搜索与执行
- 跨模块：涉及渲染进程 UI + 主进程的命令注册中心 → **Large**
- 含 UI 变更：是
- 运行时风险：键盘快捷键拦截、焦点管理 → 是

**判定：Large + UI 变更**，走完整 SDD 流程 + design-review 流程。

---

## 2. 按 new-feature.md Step 2 填 Spec「视觉与交互设计」章节

### 触发档位判定

- 新增页面级全屏浮层 → 属于"新页面 / 新 Flow" → **🔴 档位**
- 涉及新原语组件（CommandItem / CommandGroup / CommandShortcut） → **🔴 确认**

**判定结论**：🔴 必须前置完整视觉稿。

### 视觉稿载体与路径

- 首选 Figma（当前 Figma MCP 未配置，采用"人在 Figma 内画 + Figma Make 辅助生成初稿"工作流）
- 路径：`<待填入 Figma URL>`
- 降级方案：若 Figma 产出不足以还原（如弹性布局细节），降级到 `docs/design/prototypes/command-palette/` 的 HTML 原型，并在此处记录原因

### 四态设计

| 态 | 描述 |
|---|---|
| **Default** | 打开后聚焦输入框，显示"最近使用"分组 + "推荐"分组（各 5 项） |
| **Empty** | 输入无匹配时：显示"没有找到命令"+ 建议"按 ⌘K 查看全部"的次级行动 |
| **Loading** | 异步搜索（如命中远端索引）时：命令项保持占位，顶部细线 progress bar |
| **Error** | 远端索引失败：显示"仅显示本地命令"黄色 banner，不阻塞使用 |

### 极端数据态

- 0 项命令（首次使用）：显示 onboarding 卡片而非空列表
- 超长命令名：中间 ellipsis，保留前缀与快捷键；hover/focus 展开完整名
- 1000+ 命令：虚拟化列表（引用 Radix / react-virtual）；搜索防抖 60ms
- 窗口尺寸：320px 时铺满宽度；1440px / 超宽时居中约束 720px

### 键盘可达性

- 打开：`⌘K` / `Ctrl+K`
- 关闭：`ESC`
- 上下选择：`↑/↓`
- 分组跳转：`⌘↑ / ⌘↓`
- 执行：`Enter`
- 执行并保留打开：`⌘Enter`
- 全键盘路径覆盖，无鼠标强依赖

### 动效决策（引用 Motion Contract）

- 打开：`duration-medium(240ms)` + `easing-entrance`，scale 0.95 → 1 + opacity 0 → 1 **（连续性 / 层级关系）**
- 关闭：`duration-short(180ms)` + `easing-exit`，reverse
- 选中态变化：`duration-instant`（即时）**（状态转换）**
- 结果列表刷新：`duration-micro(120ms)` 的 opacity fade **（连续性）**

所有动效均归属 Motion Contract 三分类之一，符合 V4 验收标准。

### Token 使用声明

- 复用现有 token：`bg-surface-elevated` / `text-primary` / `border-subtle` / `shadow-xl` / `radius-xl` / `z-commandbar`
- **需要新增 token**：无
- 若需微调阴影强度，走 DESIGN.md § 3.5 内的 PR 调整，不开 token ADR

### 用户视觉确认

- [ ] 已确认 / [x] 待确认（干跑场景）

---

## 3. 档位判定在 DESIGN.md / AGENTS.md / PR 模板三处是否一致

| 位置 | 触发表是否存在 | 四档是否一致 | 引用了 DESIGN.md §9 |
|---|---|---|---|
| `docs/design/DESIGN.md § 9` | ✅ 权威源 | — | — |
| `AGENTS.md § 4 · 视觉稿前置闸门` | ✅ | ✅ 与权威源一致 | ✅ |
| `.github/pull_request_template.md § Visual Review` | ✅ | ✅ 与权威源一致 | ✅ |
| `docs/playbooks/design-review.md § 判定入口` | ✅ | ✅ 与权威源一致 | ✅ |

**结论**：四处引用保持一致，档位"新页面 / 新原语"正确落到 🔴，边界清晰，不落两档之间。

---

## 4. 排演 design-review.md Phase 0 全流程

| Step | 是否可照做 | 说明 |
|---|---|---|
| 0.1 按档位选载体 | ✅ | 🔴 档位 → Figma 首选；Figma MCP 未配置时走 Figma + Figma Make 人工 |
| 0.2 产出视觉稿 | ✅（假想） | 四态 + 所有新原语外观 + 动效描述均可覆盖 |
| 0.3 North Star 并排 | ✅ | Linear 的 ⌘K（结构/密度）+ Arc 的命令输入（动效/色彩）各截一张 |
| 0.4 用户确认闸门 | ✅ | 干跑中此步为"待确认"，真实流程下须等用户勾选 |
| 0.5 迭代上限 | ✅ | 3 轮未收敛 → 回到 Spec 审视需求。本干跑不触发 |

**结论**：Phase 0 五步可在真实场景中无歧义执行。

---

## 5. 填 PR 模板 Visual Review 区域

| 字段 | 是否可回答 | 内容（模拟） |
|---|---|---|
| 触发档位 | ✅ | 🔴 新页面 / 新 Flow / 新原语 |
| 视觉稿链接 | ✅ | `<Figma URL>` |
| 四态截图 | ✅ | 4 张截图 |
| North Star 并排对比 | ✅ | Linear ⌘K + Arc 命令输入 并排图 |
| 自检五步 checklist | ✅ | 逐项勾选 |

**结论**：PR 模板所有字段在本场景均可填写，没有"不适用但没给出路径"的字段。

---

## 6. 发现的问题与改进建议

| 问题 | 严重度 | 建议 |
|---|---|---|
| `design-review.md` Phase 0 Step 0.1 中"Figma MCP 未配置时的工作流"描述相对笼统 | 低 | 等 `tech-stack-scaffold` 后由独立任务具体化，本阶段不改 |
| PR 模板 Self-Review 五步未指明"证据如何附"（截图 / 录屏 / 文字） | 低 | 下次迭代可在注释中加提示；本次不阻塞 |
| 🟡 档位的"交互原型"在当前文档中仅定义了"视频或可交互 HTML"；未说明录屏工具选型 | 低 | 留给 follow-up；不影响本 SDD 验收 |

**阻断性问题**：无。

---

## 7. 验收结论

- ✅ Spec 模板"视觉与交互设计"章节可填满，无歧义字段
- ✅ 触发表四档边界清晰
- ✅ design-review.md Phase 0 五步可照做
- ✅ PR 模板 Visual Review 全部字段可填
- ✅ 三处触发表引用保持一致
- ✅ Motion Contract 参数可被 Spec 直接引用（`duration-medium` / `easing-entrance` 等）
- ✅ DESIGN.md 的可验收标准（V1–V13）可映射到本场景的 Spec 与 PR

**本次 harness 交付的流程可在真实 Large UI 场景中自洽运转，无需阻断性修改。**
