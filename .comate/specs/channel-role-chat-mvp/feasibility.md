# Feasibility · channel-role-chat-mvp

## 结论

可行，不需要引入新顶层依赖。

## 已有基础

- `main` 已有 `ProjectsStore`，可把频道 folder root 表达为 `folderProjectId`。
- `main` 已有 `runtime-session` / `pty-session`，可复用本地 Claude Code / Codex 调用能力。
- `renderer` 已有个人对话、ProjectPicker、模型选择、流式消息基础。
- 旧分支 `feat/agentic-handoff-workflow` 已验证过 `@` 解析、role prompt、event/run/handoff 的基本形态，但不整体迁移。

## 关键假设

1. 频道绑定文件夹可以复用现有 Project 模型。
   - 判定：成立。频道存 `folderProjectId`，main 解析到 path。
2. 角色运行可以复用现有 runtime startSession。
   - 判定：成立。需要由 orchestrator 包装 prompt 和 sessionId。
3. handoff 不需要第一阶段自动执行。
   - 判定：成立。用户确认的 proposal 足以覆盖 MVP，并能避免循环。

## 不做实验的原因

本 SDD 不引入新的外部 runtime、协议或依赖；风险主要来自状态建模和代码集成。用 unit/contract/integration 测试覆盖比单独 spike 更有效。

