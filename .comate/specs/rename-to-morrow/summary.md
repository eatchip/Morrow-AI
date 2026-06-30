# rename-to-morrow — Summary

## Done

- Renamed current product identity to Morrow across source, UI, docs, specs, tests, scripts, release config, and build outputs.
- Updated package/build identity:
  - package name: `morrow`
  - app id: `com.eatchip.morrow`
  - product name: `Morrow`
  - release artifact glob: `dist/Morrow-*.dmg`
- Renamed the preload bridge to `MorrowApi` / `window.morrowApi`.
- Renamed E2E controls to `MORROW_E2E` / `--morrow-e2e`.
- Renamed storage/client identifiers to the `morrow` prefix.
- Renamed previous brand-bearing SDD directories to Morrow names.
- Added `scripts/check-brand.mjs` and `pnpm brand-check`.
- Removed stale old-brand local build artifacts and rebuilt macOS DMGs.
- Renamed the GitHub repository from the previous repo path to `eatchip/Morrow`.
- Updated local `origin` to `https://github.com/eatchip/Morrow.git`.
- Prepared the user-visible rename for release as `v0.3.6`.

## Verification

Passed:

```bash
PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm brand-check
PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm check
PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm test -- --run
./node_modules/.bin/playwright test
PATH=/private/tmp/morrow-corepack-bin:$PATH pnpm dist:mac
```

Results:

- Brand check passed.
- TypeScript check passed.
- Vitest passed: 35 test files, 179 tests.
- Playwright E2E passed: 9 tests.
- macOS packaging passed and produced:
  - `dist/Morrow-0.3.5-arm64.dmg`
  - `dist/Morrow-0.3.5-x64.dmg`
  - `dist/mac-arm64/Morrow.app`
  - `dist/mac/Morrow.app`

Notes:

- Playwright Electron launch fails under the default sandbox with a macOS app registration `SIGABRT`; the same full E2E suite passed when run with unsandboxed GUI access.
- `pnpm dist:mac` requires project pnpm 9.6.0. The Codex runtime PATH had pnpm 11.x first, so a temporary Corepack shim at `/private/tmp/morrow-corepack-bin` was used for validation.
- The project `pnpm test:e2e` wrapper was not rerun after a later escalation request hit an environment usage limit. The equivalent direct Playwright suite had already passed.
- GitHub repository rename was verified: `eatchip/Morrow` resolves to the same repository ID and the previous repo path redirects.

## Real Runtime Smoke

Real Claude/Codex smoke remains opt-in because it uses account login and network access. The checklist is in:

```text
.comate/specs/rename-to-morrow/real-runtime-smoke.md
```

## Follow-ups

- Verify `https://github.com/eatchip/Morrow/releases/latest` and release asset URLs after the `v0.3.6` tag workflow finishes.
- Before external demo release, run the real runtime smoke checklist for Claude personal chat, Codex personal chat, Claude channel role mention, and Codex channel role mention.
