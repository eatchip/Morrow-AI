# SDD: design-harness

> **阶段**：Spec（doc.md）· 待用户 Approval
> **规模**：Large（跨多文件、触及 AGENTS.md、改变 SDD 流程契约）
> **前置讨论**：与用户对齐的 6 层方案 + Benchmark（Linear 主 + Arc 辅）+ 视觉稿前置闸门
> **关联**：即将新增 ADR 0005；本 SDD 完成后方可启动 `tech-stack-scaffold`

---

## 1. Context（需求背景与约束）

### 1.1 问题

Morrow 项目处于 Harness Refinement 阶段。现有 harness（AGENTS.md / DEVELOPMENT.md / ADR 0001–0004 / playbooks）覆盖了**流程**与**技术**两个维度，但**设计**维度完全缺位：

- 没有审美基准（北极星）
- 没有可验收的设计原则
- 没有 design token 与组件原语契约
- 没有动效与交互手感约束
- Spec 模板不包含视觉/交互设计章节
- 没有 UI 变更的视觉前置闸门，没有 solo 开发者的自评审流程

这直接对应作者在先前项目（OpenCove）踩过的坑：**A1 没有北极星 / A2 标准模糊 / B3 无视觉评审闸门 / C3 动效手感廉价**。

### 1.2 约束

- **Solo 开发者**：不存在团队文化与设计师长期把关，所有护栏必须**自强制**
- **产品形态未最终锁定**：benchmark 必须基于"通用生产力"假设，不锁死 Morrow 本身
- **技术栈已定但脚手架未落地**：token 硬规则与 lint 必须推迟到 `tech-stack-scaffold`，本次只写"原则"
- **付费 Figma 权益**：视觉稿流程应支持并优先使用 Figma
- **不越界**：本次仅修改 AGENTS.md（经用户显式批准）；DEVELOPMENT.md、CI、ADR 状态均不动

### 1.3 驱动因素

1. 启动 `tech-stack-scaffold` 之前必须先确定设计契约，避免脚手架生成后再返工
2. 第一个真实 UI feature 启动前，必须已有可引用的 benchmark 与流程
3. 设计腐化是不可逆的：**越晚立规矩，代价越高**

---

## 2. Decision（架构与技术思路）

将本次 harness 补完分为 **6 层**，每层对应一个明确的失败模式：

| 层 | 产物 | 解决 | 本次落地形态 |
|---|---|---|---|
| L1 | `docs/decisions/0005-design-north-stars.md` | A1 无锚点 / D1 审美衰退 | 新 ADR |
| L2 | `docs/design/DESIGN.md` | A2 标准模糊 / C2 密度失衡 | 新文档 |
| L3 | DESIGN.md § Tokens（规约） + AGENTS.md 软规则 | B1 硬编码绕行 | 原则先行，lint 延后 |
| L4 | DESIGN.md § Motion Contract | C3 动效手感廉价 | 可验收的参数化契约 |
| L5 | SDD `doc.md` 模板增章 + 触发表 | B3 无视觉评审 / C1 四态缺失 | 修改 `new-feature.md` 与 `spec-review.md` |
| L6 | `docs/playbooks/design-review.md` + PR 模板 | solo 无第二双眼睛 | 新 playbook + 清单 |

### 2.1 Benchmark 组合

北极星采用 **Linear 为主、Arc 为辅** 的双层定位：

- **骨架层（Linear）**：信息结构、密度、克制美学、四态的"第一等公民"地位、深浅双模式质感
- **血肉层（Arc）**：动效哲学（spring 驱动的连续性与层级感）、色彩注入点（强调色、主题化）

**不采纳**：纯 D 流派的表现力优先（solo 维护成本过高、3 年内审美衰退风险大），以及纯 A 流派的冷峻（与 Morrow 面向个人工具的预期情绪不匹配）。

### 2.2 视觉稿前置闸门

Large 且含 UI 变更的任务，**代码实现前必须存在用户确认过的视觉稿**。

**触发表**（四档）：

| 变更类型 | 视觉稿要求 |
|---|---|
| 新页面 / 新 Flow / 布局重构（IA 动了） / 新原语组件 | 🔴 必须前置完整视觉稿 |
| 新动效 / 新过渡 | 🟡 必须前置交互原型（视频或可交互 HTML） |
| 已有组件局部修改（文案、图标、微调 padding） | 🟢 截图放 PR 即可 |
| 纯逻辑 / 文档 / 不可见变更 | ⚪ 无要求 |

**载体优先级**：
1. **Figma 文件**（首选，不论人画 / Figma Make 生成 / write-MCP 生成）
2. **HTML/CSS 可交互原型**（降级，需在 Spec 中记录原因）
3. **位图 mockup**（仅用于方向对齐，不作为还原参照）

**Figma MCP 具体配置**属于工具链问题，延后到 `tech-stack-scaffold` 之后独立处理，不在本 SDD 范围内。

### 2.3 Token 硬规则的分阶段落地

- **本次**：DESIGN.md 写明"所有视觉属性应来自 token"的原则；AGENTS.md 加**软规则**（"review 时出现硬编码色值/尺寸为违反设计原则"），但不加 lint / CI 强制
- **`tech-stack-scaffold` 之后**：新增 SDD `design-tokens-enforcement`，把软规则升级为 lint 规则 + token 源码文件落地

这样可以在脚手架未落地前就建立契约认知，同时避免"纸上规则执行不了"的尴尬。

---

## 3. 受影响文件清单

### 3.1 新增

| 路径 | 操作 | 说明 |
|---|---|---|
| `docs/decisions/0005-design-north-stars.md` | 新建 | L1 — Benchmark ADR（Linear 主 + Arc 辅） |
| `docs/design/DESIGN.md` | 新建 | L2/L3/L4 合并：Philosophy / Anti-Patterns / Tokens 规约 / Motion Contract / Primitives / State Coverage / Density & Rhythm / 可验收标准 |
| `docs/playbooks/design-review.md` | 新建 | L6 — 视觉稿前置闸门流程 + solo 自评审六步 |

### 3.2 修改

| 路径 | 操作 | 说明 |
|---|---|---|
| `AGENTS.md` | 修改 § 1 / § 4 / § 7 | 加 token 软规则；加视觉前置闸门规则；§ 7 指向 DESIGN.md |
| `docs/playbooks/new-feature.md` | 修改 Step 2 / Step 6 | Step 2 Spec checklist 增加"视觉与交互设计"条目；Step 6 引用 design-review.md |
| `docs/playbooks/spec-review.md` | 修改 | 在 B / D / E 节增加视觉评审项 |
| `.github/pull_request_template.md` | 修改 § Screenshots | 扩展为"视觉四态 + North Star 并排对比 + 触发表判定"清单 |
| `CHANGELOG.md` | 修改 [Unreleased] | Added / Changed 段落追加本次产物 |

### 3.3 不动

- `DEVELOPMENT.md`（本次不涉及方法论/命令，避免与 `tech-stack-scaffold` 交叉）
- `CONTRIBUTING.md`（人类贡献流程不涉及新闸门）
- 现有 ADR 0001–0004（不改变状态）
- `CLAUDE.md`（兼容壳，无需动）
- CI 配置（本仓库尚无）

---

## 4. 实现要点

### 4.1 `0005-design-north-stars.md` 要点

- 严格走 ADR 模板（Context / Decision / Consequences / Alternatives / References）
- Decision 一句话：**"Linear 为骨架基准，Arc 为动效与色彩基准；前提假设是通用生产力形态"**
- 列出 4 个候选流派（A/B/C/D）+ 未采纳原因
- Negative/Trade-offs 明确列出："Linear 系有仿品同质化风险，需在密度中找自己的节奏"
- 约定**复审机制**：每 6 个月或技术栈/产品形态发生重大变化时复审；Superseded 走新 ADR

### 4.2 `DESIGN.md` 要点

骨架：

```
1. Design Philosophy           — 3–5 条可执行信条（不是口号）
2. Anti-Patterns               — 显式禁止清单（如："禁止装饰性渐变背景"）
3. Design Tokens（规约层）
   3.1 Color / 3.2 Typography / 3.3 Spacing / 3.4 Radius
   3.5 Shadow / 3.6 Z-Index / 3.7 Motion Tokens（与 § 4 交叉引用）
4. Motion Contract
   4.1 Duration 分级：instant(0) / micro(120ms) / short(180ms)
                      / medium(240ms) / long(320ms)；超出需 ADR
   4.2 Easing 白名单（具体 cubic-bezier / spring 参数）
   4.3 反馈延迟契约：>100ms 必须视觉反馈；>300ms 必须加载态；
                    >1s 必须进度态
   4.4 动画目的：仅服务于「连续性 / 层级关系 / 状态转换」
5. Component Primitives 清单   — 哪些元素必须通过原语组件
6. State Coverage Checklist    — Default / Empty / Loading / Error /
                                 极端数据态（0 项 / 超长 / 1000+）
7. Density & Rhythm            — 间距层级规则、视觉节奏原则
8. 可验收标准                  — 每条原则的"如何验收"
```

**关键原则**：每条写下的原则必须有**验收方式**。示例：

- ❌ "界面要克制" — 无法验收
- ✅ "主色在一屏内出现次数 ≤ 3" — 可 code review，将来可 lint

### 4.3 `design-review.md` 要点

两阶段结构：

**Phase 0 · 开发前视觉对齐**
1. 读触发表判定档位
2. 按载体优先级产出视觉稿
3. 与 North Star 并排截图对比
4. 提交给用户确认
5. **未确认前禁止写实现代码**（仅允许改视觉稿本身）

**Phase 1 · 合入前物理自检五步**（solo 核心）
1. 截图四态（Default / Empty / Loading / Error）
2. 与 North Star 并排对比
3. 缩小 50% 再看（失去细节后节奏是否 OK）
4. 灰度再看（层级是否仍清晰）
5. 键盘全流程走一遍（所有操作不用鼠标）

这五步的共同特征：**极低成本、极高信号、物理隔断**（非主观判断）。

### 4.4 AGENTS.md 修改要点

**§ 1 Golden Rules** 追加 1 条：

> 8. **设计契约优于手感**：UI 实现须引用 `docs/design/DESIGN.md` 的 tokens 与原语组件；禁止硬编码色值、字号、间距、圆角、阴影、动效参数。`tech-stack-scaffold` 落地后此规则由 lint 强制，此前由 code review 把关。

**§ 4 Workflow** 在 Plan 阶段追加一段：

> Large 任务若含视觉变更（参见 `docs/design/DESIGN.md` 触发表），Plan 阶段必须包含"视觉稿产出"任务；该任务完成并经用户确认前，不得开始实现代码。具体流程见 `docs/playbooks/design-review.md`。

**§ 7 Setup & Commands** 末尾追加指引：

> **设计契约**：视觉/交互决策遵循 [`docs/design/DESIGN.md`](./docs/design/DESIGN.md) 与 [ADR 0005](./docs/decisions/0005-design-north-stars.md)；视觉评审流程见 [`docs/playbooks/design-review.md`](./docs/playbooks/design-review.md)。

### 4.5 PR 模板修改要点

将 `## Screenshots / Recordings` 扩展为：

```markdown
## Screenshots / Visual Review（UI 变更必填）

**触发档位判定**（参见 DESIGN.md 触发表）：
- [ ] 🔴 新页面 / 新 Flow / 布局重构 / 新原语 → 需前置完整视觉稿
- [ ] 🟡 新动效 / 新过渡 → 需前置交互原型
- [ ] 🟢 已有组件局部修改 → 截图即可
- [ ] ⚪ 无可见变更

**视觉稿链接**：<!-- Figma / HTML 原型 / 不适用 -->

**四态截图**（Default / Empty / Loading / Error）：

**North Star 并排对比**（贴 benchmark 同类界面截图）：

**Self-Review 五步是否完成**：
- [ ] 四态截图 / [ ] North Star 并排 / [ ] 缩小 50% / [ ] 灰度 / [ ] 键盘全流程
```

---

## 5. 状态所有权与不变量

### 5.1 所有权

| 资产 | Owner | 修改闸门 |
|---|---|---|
| `0005-design-north-stars.md`（benchmark） | ADR 体系 | 须走新 ADR 替换（Superseded），不得直接改 |
| `DESIGN.md` 的 token 规约与 Motion Contract | 设计契约文档 | 触及契约的变更须在 Spec 中显式列出 |
| `design-review.md`（流程本身） | playbook 体系 | 流程变更须新起 SDD |
| 具体 UI 实现中的样式值 | feature 代码 | 必须引用 tokens，不得硬编码 |

### 5.2 不变量（本次 harness 层面）

1. **Spec → Visual Draft → Code** 三段顺序单向：Large UI 任务在用户确认视觉稿前，实现代码不得提交
2. **Token 单一源**：`DESIGN.md`（规约）→ 未来的 `src/design/tokens/*`（实现）是视觉属性的唯一出处
3. **Benchmark 可替换但不可忽略**：任何对 North Star 的偏离必须在 Spec 的"视觉与交互设计"章节中显式标注原因

---

## 6. 边界条件与异常处理

| 情形 | 处理 |
|---|---|
| Figma MCP 不可用 | 降级到 HTML 原型，Spec 中记录降级原因 |
| 视觉稿反复迭代不收敛 | Spec `doc.md` 对应章节保留版本历史；超过 3 轮触发与用户对齐 |
| 发现现有 token 不足以表达新设计 | 新开 token ADR（视作契约变更）；不得通过内联样式绕过 |
| Benchmark 审美过时（D1） | 每 6 个月或产品形态重大变化时触发 ADR 复审；新起 ADR Supersede 旧的，不得悄悄漂移 |
| 极紧急修复（hotfix）含 UI 变更 | 允许先合入，但必须开 follow-up 在 7 天内补齐视觉评审五步并记录结果 |
| 本次 SDD 执行期间与其他 PR 冲突 | harness 文档类变更优先级高；若实质冲突则暂停，先对齐 |

---

## 7. 数据流 / 信息流

本次为纯文档/规则变更，无运行时数据流。**信息流**（约束传播链路）：

```
ADR 0005 (North Stars)
     │
     ▼
DESIGN.md (Principles / Tokens / Motion / Primitives / States)
     │     ├──> AGENTS.md § 1 / § 4 / § 7    (硬规则与流程闸门)
     │     ├──> new-feature.md Step 2 / 6   (Spec 模板 + 验证)
     │     ├──> spec-review.md B/D/E        (评审清单)
     │     └──> design-review.md Phase 0/1  (执行流程)
     │
     ▼
.github/pull_request_template.md  (合入闸门清单)
     │
     ▼
CHANGELOG.md [Unreleased]         (变更记录)
```

---

## 8. 验证方式

本次产物为文档/规则，采用**文档级验收**：

### 8.1 结构性验收（机械可查）

- [ ] 新增 3 个文件均存在且非空
- [ ] AGENTS.md 的 3 处修改（§ 1 / § 4 / § 7）均可定位
- [ ] 2 个 playbook 的修改章节均可定位
- [ ] PR 模板的 Visual Review 段落就位
- [ ] CHANGELOG.md [Unreleased] 有对应条目
- [ ] 所有内部链接可达（`docs/design/DESIGN.md`、`docs/decisions/0005-*`、`docs/playbooks/design-review.md`）

### 8.2 语义性验收（人工审阅）

- [ ] ADR 0005 符合 `docs/decisions/template.md`（Status / Context / Decision / Consequences / Alternatives / References 齐全）
- [ ] DESIGN.md 每条原则都有配套的"可验收标准"
- [ ] Motion Contract 的 duration / easing 参数具体可引用（而非抽象描述）
- [ ] 触发表四档在 DESIGN.md / AGENTS.md / PR 模板三处保持一致
- [ ] design-review.md 的五步自检在**未有任何 UI 代码时也可排演**（纯物理动作）

### 8.3 干跑验证（Dry Run）

在本 SDD 收尾阶段，用一个**假想的 UI feature**（例如"主窗口命令面板"）跑一遍新流程，验证：
- Spec 模板的"视觉与交互设计"章节能填满
- 触发表能判定到正确档位
- design-review.md Phase 0 的步骤可照做
- PR 模板的 Visual Review 清单能逐项回答

干跑结果写入 `summary.md`，不入主干代码。

---

## 9. 非目标（本次明确不做）

以下内容被有意排除，避免本 SDD 膨胀：

- ❌ 落地真实的 `src/design/tokens/*` 源码文件（属 `tech-stack-scaffold` 之后的 SDD）
- ❌ 加入 lint 规则强制 token 使用（同上）
- ❌ 配置具体的 Figma MCP（属工具链，`tech-stack-scaffold` 之后独立处理）
- ❌ 确定 Morrow 最终产品形态（benchmark 仅基于"通用生产力"假设）
- ❌ 修改 `DEVELOPMENT.md`（避免与 `tech-stack-scaffold` 交叉）
- ❌ 为每个组件原语预先画样（留给第一个真实 UI feature）
- ❌ 修改 ADR 0001–0004 的状态或内容
- ❌ 制定 i18n / a11y 的完整规范（本次仅在 DESIGN.md 埋钩子，留给后续）
- ❌ 引入任何新顶层依赖或 SaaS

---

## 10. 风险与缓解

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 原则写得过抽象，validator 落地时无法执行 | 中 | 高 | 每条原则强制配"可验收标准"；干跑验证兜底 |
| 视觉稿前置闸门过于严苛，导致小改动也卡壳 | 中 | 中 | 四档触发表明确分级；🟢/⚪ 档免除 |
| Benchmark 过于仿 Linear 导致 Morrow 成为"又一个 Linear" | 中 | 中 | ADR 0005 Negative 章节显式提醒；Arc 层色彩/动效差异化 |
| 硬规则与软规则混用造成认知分裂 | 低 | 中 | AGENTS.md 明写"lint 落地前由 code review 把关"；在 `tech-stack-scaffold` 后升级 |
| solo 自检五步执行惰性 | 高 | 中 | PR 模板强制 checklist；明确列出每步的"如何做"，降低心智门槛 |
| 文档内部链接未来失效 | 低 | 低 | 干跑阶段逐一点击；未来 pre-commit 可加 markdown link check |

---

## 11. References

- `AGENTS.md`（现行版本，本次将修改 § 1 / § 4 / § 7）
- `docs/decisions/template.md`（ADR 模板）
- `docs/decisions/0004-tech-stack.md`（技术栈前提）
- `docs/playbooks/new-feature.md` / `spec-review.md`（本次会修改）
- `docs/playbooks/research-method.md`（benchmark 研究方法）
- External: Linear / Arc / Things 3 / Raycast 产品（benchmark 对标对象）
- External: Refactoring UI、Apple HIG、Tailwind Design Tokens 等（DESIGN.md 撰写参考源）

---

## 12. 决策确认点（提醒给 Reviewer）

以下决策已在 pre-Spec 讨论阶段与用户对齐，本 Spec 视为已 accepted：

1. ✅ 采纳 L1~L6 全部 6 层
2. ✅ Benchmark：Linear 为主、Arc 为辅
3. ✅ Token 硬规则延后到 `tech-stack-scaffold` 之后
4. ✅ 视觉稿前置闸门 + 四档触发表
5. ✅ 视觉稿载体：Figma 为首选 + HTML 原型为降级
6. ✅ 用户显式批准本次修改 `AGENTS.md`

如对任一条有异议，请在 Approval 阶段提出，不要在 Plan / Execute 阶段回撤。
