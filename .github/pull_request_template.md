<!--
  本模板对所有 PR 适用。按 Type / Size 选择相关部分填写；空的部分删掉也可以。
  硬规则见 AGENTS.md。
-->

## Summary

<!-- 一句话说明这个 PR 做了什么、为什么。 -->

## Type

- [ ] feat — 新功能
- [ ] fix — Bug 修复
- [ ] refactor — 结构调整（无行为变更）
- [ ] docs — 文档
- [ ] chore — 杂务（配置 / 依赖 / 构建）
- [ ] test — 仅测试变更
- [ ] perf — 性能优化
- [ ] build / ci — 构建与 CI

## Change Size

- [ ] **Small** — 局部、低风险、非结构性
- [ ] **Large** — 走过完整 Spec → Plan → Approval 流程

## Links

- Spec: `.comate/specs/<feature-name>/doc.md`
- Plan: `.comate/specs/<feature-name>/tasks.md`
- ADR:  `docs/decisions/<NNNN>-...md`
- Related issues:

## What Changed

<!-- 高层次的变更摘要；不重复 diff 细节。列出关键改动与非显而易见的决定。 -->

## Verification

- [ ] 定向测试已通过
- [ ] 全量 pre-commit 闸门已通过（Large 任务必选）
- [ ] 手动验证了关键路径
- [ ] 覆盖了原始复现路径（bug fix 必选）

**验证说明**：

<!-- 具体跑了什么测试 / 走了哪些场景 / 有什么证据。 -->

## Risk Checklist

（Small 任务跳过无关项；Large 任务必须逐项确认）

- [ ] Async / 并发 / 生命周期风险已检视
- [ ] 状态所有权与不变量未被破坏
- [ ] 外部输入边界已校验
- [ ] 安全影响已考虑（密钥、凭证、日志脱敏）
- [ ] 性能敏感路径已基准对比（如涉及）
- [ ] 数据一致性 / 可恢复性未劣化

## CHANGELOG

- [ ] 用户可感知变更已更新 `CHANGELOG.md [Unreleased]`
- [ ] 仅内部变更，无需更新

## Screenshots / Visual Review

**触发档位判定**（参见 [`DESIGN.md § 9 触发表`](../docs/design/DESIGN.md#9-视觉稿前置闸门触发表)，单选）：

- [ ] 🔴 新页面 / 新 Flow / 布局重构 / 新原语 → 需前置完整视觉稿
- [ ] 🟡 新动效 / 新过渡 → 需前置交互原型
- [ ] 🟢 已有组件局部修改 → 截图即可
- [ ] ⚪ 无可见变更 → 跳过本段

**视觉稿链接**（🔴/🟡 必填；🟢 可不填）：

<!-- Figma URL / HTML 原型路径 / 位图目录；降级路径需说明原因 -->

**四态截图**（Default / Empty / Loading / Error；🔴/🟡 必填）：

<!-- 贴图或 PR 评论外链 -->

**North Star 并排对比**（🔴 必填；对标 Linear / Arc 同类界面）：

<!-- 贴图 -->

**Self-Review 五步**（🔴/🟡/🟢 UI 变更必须逐项完成，见 [`design-review.md`](../docs/playbooks/design-review.md) Phase 1）：

- [ ] 四态截图
- [ ] North Star 并排
- [ ] 缩小 50% 再看
- [ ] 灰度再看
- [ ] 键盘全流程

## Out-of-scope / Follow-ups

<!-- 本 PR 故意没做的事、待跟进的 issue、留给未来的技术债。 -->

---

**Reviewer 视角提示**
- 用 `DEVELOPMENT.md § 风险与合规检查清单` 作为底线
- 用 `docs/playbooks/spec-review.md` 检查 Spec 质量（Large 任务）
- 非阻塞建议请前缀 `nit:`；必须处理的用 `blocking:`
