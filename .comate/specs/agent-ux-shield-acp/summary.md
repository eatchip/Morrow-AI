# agent-ux-shield-acp — Summary

## Outcome

已完成 UX Shield + ACP-ready adapter。

Codex 仍通过 PTY-first 路径运行，保留与 Terminal 接近的速度；但 Chat 默认不再把 xterm 当作主界面。
Renderer 将 PTY bytes 投影成 Morrow activity timeline：用户消息、assistant 文本、命令执行卡片、
状态卡片和可折叠终端日志。

## What Changed

- `TerminalPane` 增加 `readOnly`：只读模式禁用 stdin、退出 tab 焦点路径，仅作为 debug 日志 fallback。
- 新增 `agent-transcript.ts`：清理 ANSI/control bytes，解析 PTY 输出为 ACP-compatible activity shape。
- 新增 `AgentTranscriptView`：默认展示 Morrow 对话流和活动卡片，raw terminal 藏到“查看终端日志”。
- 新增 `ApprovalPromptBar`：Codex approval prompt 显示在 Composer 上方，按钮映射 Enter / Escape。
- Chat 只保留 Composer 作为主要输入入口；审批按钮鼠标点击不抢走 Composer 焦点。
- E2E mock 覆盖 approval prompt，避免真实 Codex/TUI 不稳定影响自动化验证。
- PTY transcript 改为保守投影：Codex TUI chrome、update banner、cwd/status bar、用户输入回显
  和未知 terminal 输出不进入主 timeline，只保留 raw terminal log；多轮会话按 prompt echo 切分 turn。

## Verification

- `pnpm check`
- `pnpm test -- --run`
- `pnpm build`
- `pnpm test:e2e`
- `pnpm pre-commit`

## Follow-up

真实 ACP transport 暂不落地。当前边界已经把 UI 与传输分开；等 Codex 或目标 Agent 暴露稳定
ACP server 后，只需要把 PTY transcript adapter 替换为 ACP transport adapter，`AgentTranscriptView`
和 `ApprovalPromptBar` 不需要重写。
