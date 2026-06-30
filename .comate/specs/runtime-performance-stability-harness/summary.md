# runtime-performance-stability-harness — Summary

## Outcome

This branch introduces a runtime stability harness for Morrow's Codex path:

- `RuntimeRunSupervisor` in main process owns run lifecycle, deadlines, cancel/timeout cleanup, and exactly-once settlement.
- Renderer no longer owns real timeout semantics; it only renders supervisor state and sends user intent.
- Chat now has a compact recovery surface for slow, canceled, failed, and timed-out runs.
- E2E mock can simulate stuck runs, slow runs, normal runs, cancellation, and run events.
- `pnpm perf:codex` and `pnpm perf:codex:real` provide repeatable performance checks.

## Key Files

- `src/app/main/runtime-run-supervisor.ts`
- `src/app/main/ipc.ts`
- `src/shared/ipc.ts`
- `src/app/preload/index.ts`
- `src/app/preload/mock-api.ts`
- `src/app/renderer/src/lib/use-runtime-run-status.ts`
- `src/app/renderer/src/components/RunStatusPanel.tsx`
- `scripts/run-codex-parity-benchmark.mjs`
- `tests/contract/runtime-run-supervisor.spec.ts`
- `tests/integration/runtime-run-supervisor.spec.ts`
- `tests/e2e/runtime-stability.spec.ts`

## State Ownership

- `RuntimeRunSupervisor` owns run state, deadlines, lane cleanup, and terminal state.
- Renderer owns `Conversation.messages` and only mutates streaming AI messages in response to `stream` or terminal `run-event`.
- `liveTextStore` remains a renderer-only UI projection and is consumed/dropped on all terminal paths.
- PTY raw output remains diagnostic; this implementation does not start a second PTY prompt for the same user message, avoiding duplicate Codex calls.

## Verification

- `pnpm check`
- `pnpm test -- --run tests/unit/chat-streaming-message.spec.tsx tests/unit/use-send-message.spec.tsx tests/contract/preload-api-shape.spec.ts tests/contract/send-prompt-args.spec.ts tests/contract/package-scripts.spec.ts tests/contract/runtime-run-supervisor.spec.ts tests/integration/runtime-run-supervisor.spec.ts tests/integration/codex-mcp.spec.ts`
- `pnpm build`
- `pnpm test:e2e tests/e2e/runtime-stability.spec.ts`
- `pnpm test:e2e tests/e2e/mvp-smoke.spec.ts tests/e2e/multi-session-draft.spec.ts tests/e2e/codex-provider.spec.ts`
- `pnpm perf:codex`
- `pnpm perf:codex:real`

## Measured Baseline

Recorded on 2026-05-26 in this worktree with sequential `codex exec` baseline and Morrow MCP probe:

| Metric | `codex exec --json` baseline | Morrow MCP friendly lane |
| --- | ---: | ---: |
| First runtime evidence | 1580ms | 261ms |
| First assistant text | 12358ms | 7235ms |
| Total | 12515ms | 7615ms |
| Chunk cadence P95 | n/a | 252ms |

Result: `pnpm perf:codex:real` passed parity budget. The chunk cadence sample is too small to treat as a stable distribution because the probe asks for exactly `OK`.

## Release Checklist Addition

Before releasing runtime/chat changes, run:

```bash
pnpm perf:codex
pnpm perf:codex:real
```

Use `perf:codex` as the credential-free gate and `perf:codex:real` on a machine authenticated with Codex. CI configuration is intentionally unchanged in this SDD.

## Known Limitations

- Task 7 is intentionally not implemented as a second live PTY fast lane for normal sends because that would duplicate Codex prompts. The current safe version uses supervisor run evidence and keeps PTY raw logs as diagnostics. A future PTY fast lane needs a single transport that can provide both raw evidence and structured response without double-running the model.
- The real benchmark currently compares Codex exec baseline with Morrow's MCP protocol path, not the full packaged Electron renderer loop. E2E covers renderer stability separately.
- Hard timeout defaults are conservative and should be tuned after collecting more real traces.

## Experience Command

```bash
cd /Users/songhuiyu/Morrow-perf-core-performance && pnpm dev
```
