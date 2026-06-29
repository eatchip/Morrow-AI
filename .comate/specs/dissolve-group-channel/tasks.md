# Plan: 解散群聊频道

- [x] 1. 确认 Spec、视觉原型和解散文案
  - 用户确认 `.comate/specs/dissolve-group-channel/doc.md`
  - 用户确认 `.comate/specs/dissolve-group-channel/prototype/v1/index.html`

- [x] 2. 扩展频道删除契约
  - 新增 shared 类型、IPC channel、preload real/mock API
  - 新增 main IPC payload 校验和 contract 测试

- [x] 3. 落地持久化与运行时收口
  - Store 删除 channel 及关联 events/runs/handoffs
  - Orchestrator abort 运行中 run，并忽略删除后的 late callback
  - 增加 integration 回归

- [x] 4. 接入 renderer 操作路径
  - Sidebar 群聊条目增加“解散群聊”入口
  - 增加确认弹层和错误/提交中状态
  - 删除当前打开群聊后回到频道空态

- [x] 5. 更新用户可见记录
  - 更新 `CHANGELOG.md [Unreleased]`
  - 补充 unit/e2e 覆盖文案和主路径

- [x] 6. 验证与收尾
  - 跑定向测试、build、受影响 e2e
  - staged 后跑 `pnpm pre-commit`
  - 写 `.comate/specs/dissolve-group-channel/summary.md`
