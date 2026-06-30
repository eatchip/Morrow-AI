# Fix codex 对话无输出 · 任务拆分

- [x] Task 1: 为新版 schema 补测试（Red）
    - 1.1: 在 `tests/contract/runtime-parse.spec.ts` 追加 `item.completed + agent_message` 用例（期望返回 text）
    - 1.2: 追加 `item.completed + error` 用例（期望 `\n[error] ...` 前缀）
    - 1.3: 追加 `thread.started` / `turn.started` / `turn.completed` 静默用例（期望 `null`）
    - 1.4: 追加顶层 `type === 'error'` 兜底用例
    - 1.5: 运行 `pnpm vitest run tests/contract/runtime-parse.spec.ts` 确认新用例全部 Red

- [x] Task 2: 升级 parseCodexLine 支持新旧 schema 并集（Green）
    - 2.1: 修改 `src/app/main/runtime-session.ts` 的 `parseCodexLine`，先按顶层 `type` 路由新版事件
    - 2.2: 保留旧版 `msg.type` 分支作为向后兼容通路
    - 2.3: 在函数上方注释标注支持的两种 schema 与对应 codex-cli 版本
    - 2.4: 运行 `pnpm vitest run tests/contract/runtime-parse.spec.ts` 确认旧 + 新用例全绿

- [x] Task 3: 端到端手工验证
    - 3.1: `pnpm dev` 启动应用
    - 3.2: 选中 Codex，发送 "ping"，确认气泡出现正文
    - 3.3: 发送中文 prompt 再验一次，排除编码问题

- [x] Task 4: 变更日志与闸门
    - 4.1: 在 `CHANGELOG.md` `[Unreleased]` 下新增 `### Fixed` 条目，说明 Codex 对话恢复
    - 4.2: 运行 `pnpm pre-commit`，确认全闸门通过
    - 4.3: 提交 commit：`fix(runtime): adapt codex-cli new JSONL schema · restore Codex chat output`
