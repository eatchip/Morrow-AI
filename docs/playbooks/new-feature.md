# Playbook: 新功能开发

> 适用于"添加一个新功能、模块、子系统"类型的任务。
> 与 `AGENTS.md § 2 Decision Framework` / `§ 4 Workflow` 配合使用。

---

## Step 0 — Triage

判定这是 Small 还是 Large：

- **Small**：单文件 / 单函数 / 纯配置 / 无外部契约变更 → 直接跳到 Step 5
- **Large**：新增模块、跨多文件、改变外部契约、引入依赖 → 继续 Step 1

向用户**显式声明判定结果**和理由。

---

## Step 1 — Research（如需）

若涉及成熟工业问题，先走 [`research-method.md`](./research-method.md) 的四阶段。
产出：对比表 + 至少 2 个参考实现 + 识别的关键 trade-off。

---

## Step 2 — Spec（doc.md）

在 `.comate/specs/{feature-name}/doc.md` 中产出 Spec，必须覆盖：

- [ ] **需求背景与约束**（业务 / 技术 / 时间）
- [ ] **架构与技术思路**（含所选参考实现的 Adapt 说明）
- [ ] **受影响文件清单**（路径 / 操作类型 / 影响函数）
- [ ] **实现要点**（关键片段或伪代码）
- [ ] **状态所有权与不变量**（1–3 条）
- [ ] **边界条件与异常处理**
- [ ] **数据流 / 信息流**
- [ ] **视觉与交互设计**（若含 UI 变更）：
  - 触发档位判定（🔴/🟡/🟢/⚪，见 [`DESIGN.md § 9`](../design/DESIGN.md#9-视觉稿前置闸门触发表)）
  - 视觉稿载体与路径（Figma 链接 / HTML 原型路径 / 不适用）
  - 四态设计（Default / Empty / Loading / Error）+ 极端数据态
  - 键盘可达性说明
  - 动效决策（引用 Motion Contract 的 duration / easing）
  - Token 使用声明（是否需要新增 token；如需走 token ADR）
  - 用户视觉确认：[ ] 已确认 / [ ] 待确认
- [ ] **验证方式**（测试层级 / 场景 / 验收）
- [ ] **非目标**（明确不做什么）

Spec 完成后**等待用户 Approval**。

---

## Step 3 — Feasibility Check（如需）

触发条件：
- 引入新技术（语言、框架、服务）
- 高性能 / 实时诉求
- 系统级依赖（OS / 硬件 / 内核）
- 核心重构

产出：最小实验验证关键假设。失败则回到 Step 1 或 Step 2 修订。

---

## Step 4 — Plan（tasks.md）

在 `.comate/specs/{feature-name}/tasks.md` 中拆分任务。原则：

- 每个 top-level task **独立可验证**
- 最多 2 级层级，只在 top-level 打 checkbox
- 优先做减少风险的任务（先建测试脚手架、先跑通最窄路径）
- 留出"回滚点"：每个 task 完成后应可中断且状态自洽

Plan 完成后**等待用户 Approval**。

---

## Step 5 — Execute（TDD 循环）

对每个 task：

1. **Red** — 写一个会失败的测试（或预演验证步骤）
2. **Green** — 最小改动让它通过
3. **Refactor** — 提炼 / 命名 / 消除重复

执行边界：
- 遵守 `AGENTS.md § 1 Golden Rules`
- 每个 meaningful unit 一次提交（见 `AGENTS.md § 5`）
- 任务完成立刻更新 `tasks.md` 复选框

---

## Step 6 — Verify

- **Small**：定向测试 + 手动验证关键路径
- **Large**：全量 pre-commit 闸门（见 `DEVELOPMENT.md § Pre-commit 闸门`）
- 若 UI 相关：走 [`design-review.md`](./design-review.md) Phase 1 五步自检（四态截图 / North Star 并排 / 缩小 50% / 灰度 / 键盘全流程），截图 / 录屏存 PR，不入库

---

## Step 7 — Handoff

- [ ] 自审 diff
- [ ] 用户可感知变更 → 更新 `CHANGELOG.md [Unreleased]`
- [ ] 触达方向性决策 → 起一条 ADR（`docs/decisions/`）
- [ ] 填写 PR 模板所有 checklist
- [ ] 写 `.comate/specs/{feature-name}/summary.md`：
  - 做了什么
  - 尝试过但失败的方案（避免后人重走）
  - 已知限制与后续 follow-up
