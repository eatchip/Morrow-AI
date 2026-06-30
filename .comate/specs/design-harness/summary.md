# Summary: design-harness

> 本次 SDD 的收束文档。记录做了什么、踩过什么坑、已知限制、下一步 follow-up。
> 对后来者（包括未来的自己）的作用：**避免重走弯路**。

---

## 1. 做了什么

把 Morrow 的 harness 从"流程 + 技术"补齐到"流程 + 技术 + 设计"，解决项目 owner 在先前项目（OpenCove）踩过的四类设计失败模式（**A1 无北极星 / A2 标准模糊 / B3 无视觉评审闸门 / C3 动效手感廉价**）。

### 1.1 新增文件（3）

| 文件 | 作用 |
|---|---|
| `docs/decisions/0005-design-north-stars.md` | 钉死"像什么"：Linear 为骨架基准，Arc 为血肉基准 |
| `docs/design/DESIGN.md` | 设计系统 source of truth：Philosophy / Anti-Patterns / Tokens 规约 / Motion Contract / Component Primitives / State Coverage / Density & Rhythm / 可验收标准总表 / 视觉稿前置闸门触发表 |
| `docs/playbooks/design-review.md` | Phase 0 视觉稿前置闸门 + Phase 1 solo 合入前物理自检五步 |

### 1.2 修改文件（5）

| 文件 | 改动 |
|---|---|
| `AGENTS.md` | § 1 加第 8 条"设计契约优于手感"硬规则；§ 4 Workflow 加"视觉稿前置闸门"段；§ 7 加"设计契约"指引段 |
| `docs/playbooks/new-feature.md` | Step 2 Spec checklist 增加"视觉与交互设计"条目；Step 6 引用 design-review.md |
| `docs/playbooks/spec-review.md` | B/D/E 节增加视觉评审项（benchmark 对齐 / 四态完整性 / 触发档位 / 视觉确认状态 / token 使用声明） |
| `.github/pull_request_template.md` | Screenshots 段扩展为 Visual Review（触发档位 / 视觉稿链接 / 四态 / North Star 并排 / 自检五步） |
| `CHANGELOG.md` | [Unreleased] 段落追加本次所有 Added / Changed / Notes |

### 1.3 本次 SDD 产物（内部）

| 文件 | 作用 |
|---|---|
| `.comate/specs/design-harness/doc.md` | Spec（经过多轮对齐后 accepted） |
| `.comate/specs/design-harness/tasks.md` | 9 个任务的执行计划（全部完成） |
| `.comate/specs/design-harness/dry-run.md` | 用假想 feature "主窗口命令面板"干跑全流程的记录 |
| `.comate/specs/design-harness/summary.md` | 本文件 |

---

## 2. 关键决策与理由

### 2.1 Benchmark 选 Linear + Arc 而非单一流派

考虑过 4 个美学流派（A 极简信息工具派 / B 原生质感派 / C 键盘命令派 / D 创意生命力派）。最终选 **A 主 + D 辅**。

**理由**：
- 纯 A → 过于冷峻，仿品同质化风险高
- 纯 D → 动效预算太高，solo 长期维护不可持续
- A + D → 用 Linear 的结构化承重，用 Arc 的动效与色彩注入差异化，对"通用生产力"产品最契合

### 2.2 Token 硬规则延后而非现在

- **AGENTS.md § 1.8** 写"设计契约优于手感"作为硬规则，但明示"tech-stack-scaffold 落地前由 code review 把关，其后由 lint 强制"
- 避免"写了 lint 规则但没 lint 工具"的空头承诺
- 升级路径清晰：`tech-stack-scaffold` 后新起 SDD `design-tokens-enforcement`

### 2.3 视觉稿前置闸门采用四档触发表而非一刀切

- 🔴 必须前置 / 🟡 交互原型 / 🟢 截图 / ⚪ 无要求
- 避免"所有 UI 变更同等对待"导致小改动被流程拖累
- 四档在 DESIGN.md（权威）/ AGENTS.md / design-review.md / PR 模板 四处引用，保持一致

### 2.4 Figma MCP 具体配置延后

讨论中曾倾向锁死 Figma MCP，后改为"Figma 为首选 + HTML 原型为文档化降级"。

**理由**：
- 绝大多数 Figma MCP 是**读**不是**写**，AI 生成 Figma 稿的能力尚在演进
- 工具链选择不应污染 harness（harness 应保持工具中立）
- 真正的 MCP 配置放到 `tech-stack-scaffold` 之后独立处理，不阻塞 harness 成型

### 2.5 Solo 自检"六步改五步"

曾设计"放一夜再看"作为第 3 步（12h 硬门槛），用户反馈"不需要这个时间限制"后移除。

**理由**：
- 尊重 solo 开发者自主节奏
- 其余五步（四态截图 / North Star 并排 / 缩小 50% / 灰度 / 键盘全流程）本身信号已足够强
- 物理隔断的效力不依赖时间，更依赖"动作类型"的陌生感

---

## 3. 尝试过但未采用的方案

| 方案 | 未采用原因 |
|---|---|
| 等 Morrow 产品形态清晰后再定 benchmark | 设计债务一旦开始就难逆转；先以"通用生产力"假设立基准，产品偏移时走 Supersede |
| 在 DESIGN.md 里直接钉死具体色值 / 字号 | 本阶段无代码落地，具体值会与脚手架产生双事实源；留到 `design-tokens-enforcement` |
| 把 DESIGN.md 拆成 Philosophy / Tokens / Motion 三个文件 | 当前规模（< 400 行）拆分成本高于收益；超过 800 行再拆 |
| 把自检做成 6 步、加"放一夜" | 用户判定过于刚性；信号增益不抵执行摩擦 |
| 等跑过一个真实 UI feature 再定规则 | 那时再补规则意味着前置决策不足；干跑（dry-run.md）作为妥协方案 |
| 把 AGENTS.md 拆成多个文件 | 超出本 SDD 范围；维持单文件便于 AI agent 加载 |

---

## 4. 已知限制

### 4.1 本 SDD 本身的限制

- **无代码落地**：所有 token 与原语组件仍是"规约"，无真实实现；依赖 `tech-stack-scaffold` 之后的后续 SDD
- **无 lint 强制**：硬规则依赖 code review；solo 场景下"自己审自己"仍存在盲区，需靠 PR 模板 checklist 辅助
- **Figma MCP 工作流未验证**：付费 Figma 权益 + Figma Make 的实际产出质量需第一个真实 UI feature 时验证
- **Motion Contract 的 easing 参数是初定值**：`cubic-bezier` 具体系数与 spring 参数（stiffness / damping）未经真实 UI 验证，可能需微调
- **Linear 与 Arc 的"差异化"尚未具体化**：DESIGN.md Anti-Patterns 写了"不做纯 Linear 复刻"但未说明具体差异化点；需第一个真实 UI feature 时补充

### 4.2 触发表的边界模糊区

干跑中未出现，但可预见的争议场景：

- "改变按钮 hover 动效" —— 属 🟡 还是 🟢？本次采取"🟡 = 新动效 / 新过渡"，修改已有动效按修改幅度定，阈值待后续积累
- "重写一个组件的内部实现但视觉保持" —— 属 🟢 还是 ⚪？`design-review.md § 特殊情形 · 纯重构的 UI 表现`已处理

### 4.3 编号冲突

本 SDD 征用了 ADR 0005 编号（原 ADR 0004 Follow-ups 预留给"命名前缀决策"）。已在 ADR 0005 中显式说明，后续 ADR 实际创建时顺延为 0006+。ADR 0004 本体未改。

---

## 5. 干跑验证结论

用假想 feature **"主窗口命令面板（command-palette）"** 排演新流程，验证见 `dry-run.md`：

- ✅ Spec 模板"视觉与交互设计"章节可填满，无歧义字段
- ✅ 触发表四档边界清晰
- ✅ design-review.md Phase 0 五步可照做
- ✅ PR 模板 Visual Review 全部字段可填
- ✅ 四处触发表引用保持一致
- ✅ Motion Contract 参数可被 Spec 直接引用
- ✅ DESIGN.md 的可验收标准（V1–V13）可映射到真实场景

**未发现阻断性问题**。

---

## 6. Follow-ups

### 6.1 直接关联（按优先级）

1. **`tech-stack-scaffold`**（即将启动）：把 `pnpm *` 命令从"规约态"变"可执行态"；同时为 token 落地提供源码承载位置
2. **`design-tokens-enforcement`**（在 1 之后）：把 token 软规则升级为 lint 规则；落地 `src/design/tokens/*`
3. **`visual-primitives-scaffold`**（在 2 之后）：按 DESIGN.md § 5 清单产出真实的原语组件代码
4. **Figma MCP 配置**（在 1 之后，独立小任务）：决定并配置具体的 Figma MCP；验证 Figma Make 产出质量

### 6.2 间接关联

- **ADR 编号顺延**：当"命名前缀决策 / 发布流程 / i18n 策略"真正落地时使用 ADR 0006/0007/0008
- **ADR 0005 第一次复审**：自今日起 6 个月后（2026-11-12）或产品形态/技术栈发生重大变化时触发
- **Morrow 与 Linear 的差异化点具体化**：第一个真实 UI feature 时，在 DESIGN.md Anti-Patterns 或 Philosophy 中补充 1–2 条"Morrow 不同于 Linear 的地方"
- **Motion Contract 系数微调**：第一个含显著动效的 feature 落地后，根据实际手感回写调整 easing 系数

### 6.3 潜在风险监控项

- Linear / Arc 若发生根本性重设计（例如 Arc 被收购后更换方向、Linear 转向新流派），触发 ADR 0005 事件型复审
- 本次 harness 的"自强制"机制依赖项目 owner 的自律；若出现连续 3 个 PR 跳过 Phase 1 五步，视为执行漂移，需反思机制是否过于刚性或清单过长

---

## 7. 对后来者的提醒

- **不要在 feature 代码里硬编码视觉属性**：即便 lint 未落地，code review 也会 blocking（见 AGENTS.md § 1.8）
- **Spec 里视觉章节留空 = 阻断**：spec-review.md 会要求补齐
- **🔴 档位不走视觉稿前置 = 严重违反**：参见 `design-review.md` Phase 0.4
- **想偏离 North Star**：不禁止，但必须在 Spec 中说明理由；偏离次数过多触发 ADR 0005 复审
- **DESIGN.md 是活文档**：新增 token 类别 / 原语 / Motion 分类需 ADR；调整具体值可直接 PR

---

**SDD `design-harness` 到此结束。下一步启动 `tech-stack-scaffold`。**
