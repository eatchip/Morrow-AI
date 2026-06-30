# agent-ux-shield-acp — Plan

## Phase 0: SDD

- [x] 写 Spec：明确 UX Shield、ACP-ready adapter、状态 owner 与不变量。
- [x] 写 Summary：实现和验证完成后补齐。

## Phase 1: Read-only Terminal Shell

- [x] `TerminalPane` 支持 `readOnly`，默认不聚焦、不转发键盘输入。
- [x] Chat 默认不再直接显示 xterm；改成折叠的“终端日志”。
- [x] Composer 仍负责所有追问输入。

## Phase 2: Agent Transcript Adapter

- [x] 新增 `agent-transcript.ts`：strip ANSI、解析 PTY bytes 为 activity items。
- [x] 解析 assistant text / status / tool run / terminal output / approval prompt。
- [x] 新增 unit tests 覆盖 parser 与 approval detection。

## Phase 3: Morrow Agent UI

- [x] 新增 `AgentTranscriptView`：对话流 + tool/status cards + raw log disclosure。
- [x] 新增 `ApprovalPromptBar`：Composer 上方浮层按钮。
- [x] `Chat.tsx` 接入 transcript UI，保留 legacy stream bubble fallback。

## Phase 4: ACP-ready Boundary

- [x] 新增 ACP-compatible event 类型注释与 adapter 输出 shape。
- [x] 文档记录 ACP 后续接入点：transport 替换 adapter，不改 UI。

## Phase 5: Verification

- [x] 更新 E2E：Codex 默认显示 Morrow UI，不显示可输入 terminal。
- [x] E2E mock 输出 approval prompt，验证浮层按钮写入 PTY。
- [x] `pnpm check`
- [x] `pnpm test -- --run`
- [x] `pnpm build`
- [x] `pnpm test:e2e`
- [x] `pnpm pre-commit`
- [x] 更新 `CHANGELOG.md`
