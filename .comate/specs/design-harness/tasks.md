# Tasks: design-harness —— 把设计契约与视觉前置闸门落进 harness

> 执行顺序原则：**基础文档先立 → 依赖文档再挂 → 闸门最后收口 → 干跑兜底**。
> 每个 top-level task 完成后 repo 处于自洽状态，可独立 review / 中断。

---

- [x] Task 1：建立 Benchmark ADR（L1）
    - 1.1 按 `docs/decisions/template.md` 创建 `docs/decisions/0005-design-north-stars.md`
    - 1.2 Context：写明 Morrow 缺乏审美锚点的问题与"通用生产力"前提假设
    - 1.3 Decision：一句话定性"Linear 为骨架、Arc 为血肉"+ 具体分工（信息结构/密度/克制 vs 动效/色彩/生命力）
    - 1.4 Consequences：Positive / Negative（仿品风险、维护成本）/ Neutral
    - 1.5 Alternatives：列出 4 个候选流派（A/B/C/D）及未采纳原因
    - 1.6 References：Linear / Arc / Things 3 / Raycast 官网链接 + Refactoring UI 等撰写源
    - 1.7 约定复审机制（每 6 个月或产品形态重大变化）

- [x] Task 2：建立设计系统文档（L2/L3/L4）
    - 2.1 创建 `docs/design/` 目录 + `DESIGN.md` 骨架（8 章）
    - 2.2 § 1 Design Philosophy：3–5 条可执行信条（每条附可验收标准）
    - 2.3 § 2 Anti-Patterns：显式禁止清单（含硬编码值、装饰性渐变等）
    - 2.4 § 3 Design Tokens 规约层（Color / Typography / Spacing / Radius / Shadow / Z-Index / Motion）
    - 2.5 § 4 Motion Contract：Duration 五档 + Easing 白名单 + 反馈延迟三档 + 动画目的三分类
    - 2.6 § 5 Component Primitives 清单 + § 6 State Coverage Checklist（四态 + 极端数据态）
    - 2.7 § 7 Density & Rhythm + § 8 可验收标准总表
    - 2.8 嵌入"视觉稿前置闸门触发表"（四档 🔴🟡🟢⚪，后续会被 AGENTS.md / playbook / PR 模板引用）
    - 2.9 回填 ADR 0005 的链接与版权约定（内部文档 vs 外部参考）

- [x] Task 3：建立视觉评审 playbook（L6）
    - 3.1 创建 `docs/playbooks/design-review.md` 骨架
    - 3.2 Phase 0（开发前视觉对齐）：读触发表 → 选载体（Figma 优先 / HTML 降级）→ North Star 对比 → 用户确认
    - 3.3 明确"用户未确认前禁止写实现代码"的闸门语义
    - 3.4 Phase 1（合入前自检五步）：四态截图 / North Star 并排 / 缩小 50% / 灰度 / 键盘全流程
    - 3.5 每步给"如何做"的最小指引（降低 solo 执行惰性）
    - 3.6 Figma 降级条款：MCP 不可用时走 HTML 原型，需在 Spec 记录原因
    - 3.7 与 `new-feature.md` / `spec-review.md` / PR 模板的交叉引用

- [x] Task 4：修改 AGENTS.md（§ 1 / § 4 / § 7）
    - 4.1 § 1 Golden Rules 追加第 8 条：设计契约优于手感（禁硬编码 + token 来源指引 + lint 落地节奏）
    - 4.2 § 4 Workflow 的 Plan 阶段追加视觉稿前置闸门段落（引用 DESIGN.md 触发表与 design-review.md）
    - 4.3 § 7 Setup & Commands 末尾追加"设计契约"指引段，指向 ADR 0005 / DESIGN.md / design-review.md
    - 4.4 自校验：新增/修改的内部链接全部可达；§ 6 Out of Scope 未被触及（本次授权仅限 AGENTS.md 本身）

- [x] Task 5：修改两个既有 playbook
    - 5.1 `new-feature.md` Step 2 Spec checklist 增加"视觉与交互设计"条目（含触发档位 / 视觉稿路径 / 用户确认状态）
    - 5.2 `new-feature.md` Step 6 Verify 引用 `design-review.md` Phase 1 五步
    - 5.3 `spec-review.md` B/D/E 节追加视觉评审项（benchmark 对齐、四态完整性、token 使用声明）
    - 5.4 与 Task 3 的 design-review.md 交叉引用闭环检查

- [x] Task 6：修改 PR 模板
    - 6.1 将 `.github/pull_request_template.md` 的 `## Screenshots / Recordings` 扩展为 `## Screenshots / Visual Review`
    - 6.2 加入触发档位判定四档 checkbox
    - 6.3 加入视觉稿链接字段（Figma / HTML / 不适用）
    - 6.4 加入四态截图与 North Star 并排对比区
    - 6.5 加入 Self-Review 五步 checklist

- [x] Task 7：更新 CHANGELOG
    - 7.1 `[Unreleased] · Added` 追加 ADR 0005 / DESIGN.md / design-review.md
    - 7.2 `[Unreleased] · Changed` 追加 AGENTS.md / new-feature.md / spec-review.md / PR 模板的变更摘要
    - 7.3 `Notes` 段落标注：token 硬规则与 Figma MCP 配置均延后到 `tech-stack-scaffold` 之后

- [x] Task 8：干跑验证（Dry Run）
    - 8.1 选一个假想 UI feature（如"主窗口命令面板"）作为载体
    - 8.2 按新 `new-feature.md` Step 2 填写"视觉与交互设计"章节，验证字段可填满
    - 8.3 用触发表判定档位，验证边界清晰（不落两档之间）
    - 8.4 排演 design-review.md Phase 0 全流程（不真画稿，仅走步骤）
    - 8.5 填写 PR 模板 Visual Review 区域，验证每项可回答
    - 8.6 结果写入 summary.md，不入主干代码

- [x] Task 9：全局自检与收尾
    - 9.1 全仓内部链接可达性检查（ADR / DESIGN.md / playbook / PR 模板的相互引用）
    - 9.2 触发表四档在 DESIGN.md / AGENTS.md / PR 模板三处措辞一致性校对
    - 9.3 Motion Contract 参数（duration / easing / 延迟分级）在 DESIGN.md / design-review.md 引用一致
    - 9.4 生成 `.comate/specs/design-harness/summary.md`（含干跑结论、已知限制、后续 follow-up）
