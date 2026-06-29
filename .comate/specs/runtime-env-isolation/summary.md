# runtime-env-isolation - Summary

## Done

- Added `src/app/main/runtime-env.ts` as the single runtime child-process environment policy.
- Stripped parent-agent Anthropic/Codex control variables before launching:
  - runtime detection probes
  - Claude/Codex exec sessions
  - Codex MCP server
  - Codex PTY sessions
- Preserved normal shell essentials and explicit standard API key variables such as `PATH`, `HOME`, `ANTHROPIC_API_KEY`, and `OPENAI_API_KEY`.
- Added contract coverage in `tests/contract/runtime-env.spec.ts`.
- Prepared the fix for patch release `v0.3.7`.

## Verification

Passed:

```bash
PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm test -- --run tests/contract/runtime-env.spec.ts tests/contract/runtime-build-cmd.spec.ts tests/contract/runtime-detect.spec.ts
PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm check
PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm brand-check
PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm pre-commit
CSC_IDENTITY_AUTO_DISCOVERY=false PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm dist:mac
```

Real smoke:

- Codex clean-env `exec --json` completed with `MORROW_CODEX_OK`.
- Codex clean-env MCP completed with `MORROW_MCP_OK`.
- Claude clean-env no longer used the inherited quota-limited token/base URL; in this shell it reported `Not logged in`, so the remaining Claude action is to log in with the intended Claude account.

Build outputs:

- `dist/Morrow-0.3.7-arm64.dmg`
- `dist/Morrow-0.3.7-x64.dmg`

## Notes

- This fix cannot bypass a real provider-side quota exhaustion. It prevents Morrow from accidentally using parent-agent credentials or network policy when spawning local runtimes.
- If Claude still reports quota after this fix, that is the selected Claude account/provider quota, not Morrow inheriting the Codex parent environment.
