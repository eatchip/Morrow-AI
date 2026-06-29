# Real Runtime Smoke Checklist

This checklist is intentionally opt-in. It uses local Claude/Codex credentials and network access, so it should run before demo release rather than on every pre-commit.

## Preconditions

- `claude --version` succeeds.
- `codex --version` succeeds.
- Both tools are logged in and can answer a small prompt from the terminal.
- Build output is current: `corepack pnpm build`.

## Manual Smoke Cases

1. Launch Morrow in development mode.
2. Confirm Splash detects Claude Code and Codex CLI.
3. Personal chat with Claude:
   - Select Claude Code.
   - Send: `Reply with exactly MORROW_CLAUDE_OK.`
   - Pass if the assistant message contains that token and the composer re-enables.
4. Personal chat with Codex:
   - Select Codex CLI.
   - Send: `Reply with exactly MORROW_CODEX_OK. Do not inspect files. Do not run commands.`
   - Pass if the assistant message contains that token and the composer re-enables.
5. Channel role with Claude:
   - Create a channel.
   - Add or select a Claude-backed role.
   - Send `@<role> Reply with exactly MORROW_CHANNEL_CLAUDE_OK.`
   - Pass if a role message completes with that token.
6. Channel role with Codex:
   - Add or select a Codex-backed role.
   - Send `@<role> Reply with exactly MORROW_CHANNEL_CODEX_OK. Do not inspect files. Do not run commands.`
   - Pass if a role message completes with that token.
7. Keep the existing mocked timeout/cancel E2E green; real smoke does not replace automated stability tests.

## Evidence To Capture

- CLI versions.
- Whether both runtimes were detected in Morrow.
- Screenshots or copied visible output for the four token checks.
- Any failure mode, including login prompts, model rejection, timeout, or approval prompts.
