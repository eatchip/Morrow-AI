# agent-terminal-parity — Plan

## Phase 0: SDD

- [x] 写 Spec：明确 PTY-first 架构、状态 owner、不变量、依赖与风险。
- [x] 写 Summary：实现与验证完成后补齐。

## Phase 1: MCP Stopgap

- [x] `codex-mcp.ts` 支持 `agent_message_content_delta`。
- [x] `codex-mcp.ts` 从 final `structuredContent.content` / `content[].text` 兜底补输出。
- [x] `codex-mcp.ts` 正确处理 `isError: true`。
- [x] `runtime-session.ts` / `codex-mcp.ts` 透传 model / effort。
- [x] 更新 `tests/integration/codex-mcp.spec.ts`。

## Phase 2: PTY Runtime

- [x] 引入 `node-pty`、`@xterm/xterm`、`@xterm/addon-fit`。
- [x] 新增 `src/app/main/pty-host/*`：host entry、protocol、supervisor。
- [x] 更新 `electron.vite.config.ts`：增加 `ptyHost` main entry。
- [x] 新增 `src/app/main/pty-session.ts`：session manager、buffer、snapshot。
- [x] 扩展 `shared/ipc.ts`：PTY DTO 与 channels。
- [x] 扩展 preload API：`morrowApi.pty.*`。
- [x] 注册 main IPC handlers：spawn/write/resize/kill/snapshot + data/exit events。

## Phase 3: Renderer Terminal Agent

- [x] 新增 `TerminalPane`：xterm mount、fit、data append、input forward。
- [x] App state 给 conversation 绑定 `ptySessionId`。
- [x] Codex conversation 首轮启动 PTY session，首 prompt 作为 argv 传入。
- [x] 后续追问写入同一 PTY session。
- [x] Chat view 对 Codex 优先显示 TerminalPane；MCP Chat 气泡作为 fallback/增强。
- [x] E2E mock 支持 PTY data event。

## Phase 4: Verification

- [x] Contract tests：preload API shape、PTY payload validation。
- [x] Integration tests：PTY session lifecycle、MCP schema regression。
- [x] Unit/E2E tests：renderer terminal attach/write flow。
- [x] E2E smoke 更新：Codex mock PTY 输出可见。
- [x] `pnpm check`。
- [x] `pnpm test -- --run ...` targeted tests。
- [x] `pnpm pre-commit`。
- [x] 更新 `CHANGELOG.md`。
