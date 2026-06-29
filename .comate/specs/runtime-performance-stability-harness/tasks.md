# runtime-performance-stability-harness — Plan

## Phase 0: SDD Gate

- [x] Task 0: Spec approval
  - Spec written in `doc.md`.
  - User approved proceeding on 2026-05-22.

- [x] Task 1: Feasibility check
  - Validate local Codex CLI / MCP availability.
  - Run targeted existing tests for MCP, PTY, and live text store.
  - Record findings in `feasibility.md`.

## Phase 1: Safety Net First

- [x] Task 2: Add runtime state-machine tests before implementation
  - Create unit tests for Run transitions: created -> starting -> running/streaming -> terminal.
  - Cover exactly-once settlement.
  - Cover ignored late chunk/done/error after timeout/cancel.
  - Cover deadline classes: first-output, idle, hard.
  - Verification: `pnpm test -- --run tests/unit/runtime-run-supervisor.spec.ts`.

- [x] Task 3: Add synthetic runtime integration harness
  - Add fake Fast Lane and Friendly Lane adapters.
  - Simulate no done, slow first token, only chunks no end, MCP crash, PTY crash, cancel ignored, late response, concurrent runs.
  - Keep this independent of real Codex credentials/network.
  - Verification: `pnpm test -- --run tests/integration/runtime-run-supervisor.spec.ts`.

## Phase 2: RuntimeRunSupervisor Core

- [x] Task 4: Implement `RuntimeRunSupervisor`
  - Own run registry, status transitions, lane handles, timers, trace events, cleanup.
  - Expose start/cancel/timeout/settle APIs for adapters.
  - Make terminal states idempotent.
  - Keep implementation in main/application style; no renderer dependency.
  - Verification: Task 2 and Task 3 tests pass.

- [x] Task 5: Add RunEvent IPC contract
  - Add serializable Run DTOs/events to `src/shared/ipc.ts`.
  - Add runtime validation in main IPC.
  - Extend preload API and E2E mock.
  - Keep old `stream` event temporarily for compatibility while migrating renderer.
  - Verification: `pnpm test -- --run tests/contract/preload-api-shape.spec.ts tests/contract/send-prompt-args.spec.ts`.

## Phase 3: Codex Dual-Lane Runtime

- [x] Task 6: Adapt Codex MCP as Friendly Lane
  - Route MCP lifecycle through supervisor.
  - Convert timeout/cancel into supervisor terminal events.
  - Ignore late MCP responses after terminal state.
  - Keep structured chat chunks semantically strict.
  - Verification: `pnpm test -- --run tests/integration/codex-mcp.spec.ts tests/integration/runtime-run-supervisor.spec.ts`.

- [ ] Task 7: Adapt PTY as Fast Lane diagnostic/evidence path
  - Start/reuse Codex PTY session as first-evidence lane when configured.
  - Route PTY first data to run activity without writing chat messages.
  - Ensure PTY kill/cleanup on timeout/cancel/delete.
  - Keep raw terminal logs behind diagnostics.
  - Verification: `pnpm test -- --run tests/contract/pty-session.spec.ts tests/integration/runtime-run-supervisor.spec.ts`.

- [x] Task 8: Remove renderer-owned real timeout
  - Remove `SEND_TIMEOUT_MS` ownership from renderer send hook.
  - Renderer displays supervisor states and sends cancel/retry commands.
  - Ensure liveTextStore cleanup on all terminal states.
  - Verification: `pnpm test -- --run tests/unit/use-send-message.spec.tsx tests/unit/live-text-store.spec.ts`.

## Phase 4: User Experience Gate

- [x] Task 9: Produce and approve recovery-flow visual prototype
  - Create `.comate/specs/runtime-performance-stability-harness/prototype/index.html`.
  - Cover Default, Loading, Slow, Error/Timeout, Extreme log states.
  - Use existing design tokens/CSS variables; no new token unless documented.
  - Stop for user visual approval before implementing UI components.

- [x] Task 10: Implement run status and recovery controls
  - Add small run status surface in chat/composer area.
  - Add cancel, retry, restart runtime, diagnostics affordances.
  - Keep terminal log collapsed by default.
  - Ensure keyboard access for controls.
  - Verification: targeted unit tests plus screenshot/browser verification after dev build.

## Phase 5: Performance And Regression Gates

- [x] Task 11: Add Codex parity benchmark script
  - Measure first runtime evidence, first assistant text, final response, chunk cadence, cleanup.
  - Support synthetic mode for CI/pre-commit and real Codex mode for local/release validation.
  - Output JSON and concise Markdown summary.
  - Skip real mode clearly when Codex is unavailable/unauthenticated.
  - Verification: run synthetic benchmark in tests; run real benchmark manually on release machine.

- [x] Task 12: Add E2E stability paths
  - Continuous 20-turn synthetic conversation.
  - Timeout then next send succeeds without app restart.
  - One stuck background run does not block a new conversation.
  - Diagnostics panel is reachable and does not pollute chat messages.
  - Verification: `pnpm test:e2e tests/e2e/runtime-stability.spec.ts`.

- [x] Task 13: Wire release checklist and documentation
  - Update `CHANGELOG.md`.
  - Add performance gate command to SDD summary / release checklist without modifying CI.
  - Document how to run real Codex parity benchmark locally.
  - Verification: docs reviewed, no CI config touched.

## Phase 6: Full Verification And Closeout

- [x] Task 14: Full gate
  - Run `pnpm check`.
  - Run targeted unit/integration/E2E tests.
  - Run `pnpm pre-commit`.
  - Run real Codex parity benchmark if authenticated.

- [x] Task 15: Summary
  - Write `summary.md`.
  - Record measured baseline, known limitations, skipped checks, and follow-ups.
  - Include final experience command.
