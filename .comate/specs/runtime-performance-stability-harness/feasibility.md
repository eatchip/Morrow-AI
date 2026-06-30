# runtime-performance-stability-harness — Feasibility Check

## Summary

Feasibility result: proceed, with guardrails.

The existing codebase already has usable building blocks for the proposed architecture:

- Codex MCP starts and exposes `codex` / `codex-reply`.
- Existing MCP, PTY, and live-text tests pass after installing dependencies in the new worktree.
- A real `codex exec --json` probe confirms the current structured provider path can have a large gap between first JSON event and first visible assistant text.
- A real MCP `tools/call` probe confirms that raw event timing is not enough; benchmark code must classify event semantics carefully to avoid counting prompt echo or internal events as assistant output.

## Environment

| Item | Result |
| --- | --- |
| Worktree | `/Users/songhuiyu/Morrow-perf-core-performance` |
| Branch | `perf/core-performance` |
| Node | `v22.12.0` |
| pnpm | `9.6.0` |
| Codex CLI | `codex-cli 0.130.0` |
| Codex binary | `/Users/songhuiyu/.local/share/node-versions/v22.22.2/bin/codex` |

## Probe 1: Codex MCP initialize/tools-list

Command shape: spawn `codex mcp-server`, send `initialize`, then `tools/list`.

Result outside the repository sandbox:

```json
{
  "ok": true,
  "elapsedMs": 343,
  "server": {
    "name": "codex-mcp-server",
    "title": "Codex",
    "version": "0.130.0"
  },
  "tools": ["codex", "codex-reply"]
}
```

Sandbox-only failure observed:

```text
attempt to write a readonly database
failed to initialize state runtime at /Users/songhuiyu/.codex
```

Conclusion:

- MCP is available in the real desktop/user environment.
- Runtime startup failures caused by user-state access must be surfaced as structured runtime errors.
- Tests should keep using synthetic/mocked MCP where possible; real MCP probes belong to local/release validation.

## Probe 2: Existing targeted tests

After `pnpm install`, targeted tests passed:

| Test | Result |
| --- | --- |
| `tests/integration/codex-mcp.spec.ts` | 6 passed |
| `tests/contract/pty-session.spec.ts` | 1 passed |
| `tests/unit/live-text-store.spec.ts` | 4 passed |

Conclusion:

- Existing MCP adapter behavior, PTY session contract, and live-text coalescing are stable enough to build on.
- New worktree commands need unsandboxed filesystem permission because `/Users/songhuiyu/Morrow-perf-core-performance` is outside the default writable root.

## Probe 3: Real `codex exec --json`

Prompt:

```text
Reply with exactly OK. Do not inspect files. Do not run commands.
```

Options:

```text
--json --sandbox read-only --ephemeral --ignore-rules --skip-git-repo-check
```

Result:

```json
{
  "ok": true,
  "firstLineMs": 1308,
  "firstTextMs": 10882,
  "doneMs": 11029,
  "totalMs": 11885,
  "firstText": "OK"
}
```

Conclusion:

- First structured JSON event arrived quickly, but first visible assistant text arrived around 10.9s.
- A UI that waits only for Friendly Lane assistant text can still feel frozen even while the runtime is active.
- The product needs first-evidence feedback distinct from first-assistant-token feedback.

## Probe 4: Real MCP `tools/call`

Prompt:

```text
Reply with exactly OK. Do not inspect files. Do not run commands.
```

Result:

```json
{
  "ok": true,
  "firstEventMs": 1747,
  "firstTextMs": 11246,
  "responseMs": 13892,
  "firstText": "Reply with exactly OK. Do not inspect files. Do not run commands.",
  "resultSummary": {
    "hasStructured": true
  }
}
```

Conclusion:

- MCP activity was visible early, but naive text extraction counted prompt text as first text.
- Benchmark must distinguish:
  - first runtime evidence,
  - first assistant delta,
  - first clean chat text,
  - final response.
- This supports Dual-Lane design: Fast Lane can satisfy "it is alive", while Friendly Lane must remain semantically strict.

## Feasibility Decision

Proceed with implementation planning.

Required guardrails:

1. Build `RuntimeRunSupervisor` around a state machine before UI polish.
2. Add synthetic runtime tests before touching real Codex paths.
3. Make benchmark semantics explicit; do not treat arbitrary stdout/MCP text as assistant output.
4. Keep PTY raw output out of durable chat messages.
5. Real Codex parity probes should be local/release checks and may skip when Codex is unavailable or unauthenticated.
