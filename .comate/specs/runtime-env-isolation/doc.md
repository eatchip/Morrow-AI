# runtime-env-isolation - Spec

> Status: Implementing.
> Date: 2026-06-29

## 1. Problem

When Morrow is launched from an AI-agent shell such as Codex, child runtime processes inherit the parent agent environment. That can leak agent-owned variables into the Claude Code and Codex CLI processes that Morrow starts.

Observed failure:

- Claude Code responded once, then later requests failed with a service-side quota error.
- The launch environment included agent-owned variables such as `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `CODEX_SANDBOX_NETWORK_DISABLED`, and `CODEX_THREAD_ID`.
- Morrow only used `--version` to detect local binaries, so the UI could mark a runtime as installed even when inherited auth/runtime variables would make real requests fail.

## 2. Goal

Launch Claude/Codex child processes with a runtime-safe environment:

- Preserve shell essentials such as `PATH`, `HOME`, and standard explicit API keys.
- Strip parent-agent control variables that should not cross into nested runtime processes.
- Apply the same policy to main chat, Codex MCP, runtime detection, and explicit Codex PTY sessions.
- Add a reusable contract test so this class of issue does not regress.

## 3. Scope

In scope:

- Main-process runtime environment construction.
- `runtime-session` exec path for Claude and Codex fallback.
- `codex-mcp-client` MCP server spawn path.
- `runtime-detect` version probe path.
- `pty-supervisor` explicit Codex terminal path.
- Contract tests and changelog entry.

Out of scope:

- Bypassing upstream quota/403/402 errors. If the user's selected provider account is out of quota, Morrow should report it clearly but cannot make the provider accept the request.
- Adding a settings UI for credential profiles.
- Changing the Claude/Codex model picker.

## 4. State Ownership

- Runtime process environment is owned by the Electron main process.
- Renderer owns only user intent: selected runtime/model/effort and prompt text.
- External provider auth remains owned by each CLI and its normal local config/keychain/API-key flow.

Allowed transition:

`process.env` -> `sanitizedRuntimeEnv()` -> child process `env`

Renderer input must never directly alter child-process environment.

## 5. Invariants

1. Runtime child processes must not inherit Morrow's parent-agent session variables.
2. Sanitization must not remove `PATH` or `HOME`; otherwise GUI-launched apps would stop finding user CLIs.
3. The same environment policy must be used for Claude, Codex MCP, Codex exec fallback, runtime detection, and Codex PTY.

## 6. Boundary And Risk

Boundary:

- Source: host process `process.env`.
- Owner: Electron main process.
- Sink: child processes spawned for external CLIs.

Risk:

- Stripping too much may break users who intentionally use env-based provider configuration.
- Stripping too little keeps nested-agent contamination and causes quota/auth/network failures.

Mitigation:

- Use a narrow denylist focused on known parent-agent control/auth variables.
- Keep standard explicit API key variables such as `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`.
- Add contract tests for both removed and preserved variables.

## 7. Validation

Automated:

- `pnpm test -- --run tests/contract/runtime-env.spec.ts`
- `pnpm check`

Manual/real smoke after fix:

- Launch `pnpm dev` from the same shell that previously failed.
- Claude: if provider still returns quota exhausted, confirm the UI reports it as an upstream account/quota failure rather than a local runtime crash.
- Codex: send a small no-tools prompt and confirm it completes.
