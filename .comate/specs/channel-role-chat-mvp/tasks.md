# Plan · channel-role-chat-mvp

> 状态：已实现并完成验证。

- [x] 1. 建立频道领域模型与 IPC 契约
  - 新增 `src/shared/channel-ipc.ts`
  - 新增 `src/contexts/channels/domain/*`
  - 添加 role instruction、channel folder binding、event/run/handoff 类型
  - 验证：unit tests 覆盖 mention、handoff detection、invariants

- [x] 2. 实现 ChannelsStore 持久化
  - 新增 `channels-file.ts` / `channels-store.ts`
  - 支持 role/channel/event/run/handoff 的原子写入和 snapshot
  - 验证：integration tests 覆盖 load、persist、corrupt backup、snapshot

- [x] 3. 实现 ChannelOrchestrator
  - application 层生成 `RoleContextEnvelope`
  - `postMessage` 创建 mentioned role runs
  - main 层解析频道 folder root 并启动 runtime
  - 验证：application/unit 测 context envelope；integration 测 folder unavailable 和 run lifecycle

- [x] 4. 接入 main/preload IPC
  - `registerIpc` 装配 ChannelsStore + ChannelOrchestrator
  - `ipc-validate.ts` 增加 channels command 校验
  - preload 暴露 `window.morrowApi.channels`
  - 验证：contract tests 覆盖 API shape 和 invalid payload

- [x] 5. 改造 renderer 信息架构
  - 左侧加入个人对话 / 群聊频道 / AI 队友
  - 顶部移除“添加角色 / 新建群聊”入口
  - 频道成员栏默认收起，可展开
  - 验证：unit DOM tests + Playwright smoke

- [x] 6. 实现频道 composer 与 mention menu
  - 去掉 composer 底部常驻角色 chip
  - 输入 `@` 时按当前频道角色弹出选择器
  - 支持键盘选择和点击选择
  - 验证：unit tests 覆盖 cursor mention；E2E 覆盖选择角色并发送

- [x] 7. 实现角色创建与详情
  - 新建角色必填 name / model / intro / instruction
  - 无频道时也能创建角色
  - RoleDrawer 支持 Chat / Settings，Settings 可编辑 instruction
  - 验证：E2E 覆盖创建、查看、修改 instruction

- [x] 8. 实现受控 handoff proposal
  - 角色回复中提到其他频道角色时创建 `HandoffProposal`
  - UI 显示建议交接卡片
  - 用户确认后启动目标角色 run
  - 验证：unit + integration + E2E 覆盖不自动链式执行

- [x] 9. 视觉与体验收尾
  - 对齐 v2 原型和最后两条反馈
  - 四态：empty / loading / error / long content
  - 键盘全流程检查
  - 验证：截图/手测 + Playwright

- [x] 10. 全量验证与交付
  - 更新 `CHANGELOG.md [Unreleased]`
  - 跑 `pnpm check` / `pnpm lint` / `pnpm test -- --run` / `pnpm build` / `pnpm test:e2e`
  - 写 `summary.md`
