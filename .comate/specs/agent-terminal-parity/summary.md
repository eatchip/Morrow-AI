# agent-terminal-parity — Summary

## Outcome

已完成三阶段落地：

1. MCP stopgap：兼容 codex-cli 0.130 的 `agent_message_content_delta`，并从
   `structuredContent.content` / `content[].text` 补输出；`isError: true` 不再被误判为
   `(no output)`；model / effort 进入 MCP call。
2. PTY runtime：新增 `ptyHost` utility process + `node-pty` supervisor + replay buffer /
   snapshot / resize / kill IPC。`node-pty` 被限制在 host process 内加载，Electron main 不
   直接加载 native addon。
3. Renderer terminal：Codex conversation 默认启动真实 interactive `codex [PROMPT]` PTY，
   使用 xterm.js 渲染；同一 conversation 后续追问写入同一个 PTY session。若 PTY 启动失败，
   自动降级到原 MCP chat fallback 并显示原因。

## Files

- Main/runtime: `src/app/main/pty-host-protocol.ts`,
  `src/app/main/pty-host-entry.ts`, `src/app/main/pty-supervisor.ts`,
  `src/app/main/pty-session.ts`, `src/app/main/pty-agent-command.ts`,
  `src/app/main/codex-mcp-client.ts`, `src/app/main/index.ts`, `src/app/main/ipc.ts`,
  `src/app/main/ipc-validate.ts`,
  `src/app/main/codex-mcp.ts`, `src/app/main/runtime-session.ts`
- Renderer/preload: `src/app/preload/index.ts`,
  `src/app/renderer/src/components/TerminalPane.tsx`,
  `src/app/renderer/src/screens/Chat.tsx`, `src/app/renderer/src/App.tsx`,
  `src/app/renderer/src/lib/use-send-message.ts`, `src/app/renderer/src/screens.css`
- Packaging: `electron.vite.config.ts`, `package.json`, `pnpm-lock.yaml`,
  `scripts/prepare-node-pty.mjs`
- Tests: `tests/contract/pty-agent-command.spec.ts`,
  `tests/contract/pty-validate.spec.ts`, `tests/contract/pty-session.spec.ts`,
  `tests/contract/preload-api-shape.spec.ts`, `tests/integration/codex-mcp.spec.ts`,
  `tests/e2e/codex-pty.spec.ts`, `tests/e2e/mvp-smoke.spec.ts`

## Validation

- `pnpm check`
- `pnpm test -- --run`
- `pnpm build`
- `pnpm test:e2e`
- `node scripts/prepare-node-pty.mjs`
- `node -e "import('node-pty')...spawn('/bin/echo', ['ok'])..."`

## Follow-up Notes

- 当前版本保留内存 PTY replay，不做跨应用重启后的 terminal 恢复。
- 真实 Codex 结构化摘要可在后续 SDD 中作为 MCP-second 增强层追加，但不得阻塞 PTY 主输出。
