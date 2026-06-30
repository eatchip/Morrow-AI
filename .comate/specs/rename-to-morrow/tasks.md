# rename-to-morrow — Plan

> Status: Implemented.

- [x] Task 1: Preflight and workspace hygiene
  - Confirmed old generated build outputs were ignored and removed before rebuild.
  - Renamed the pre-existing performance experiment directory to a Morrow name.
  - Ensured `.pnpm-store/` is ignored and not staged.

- [x] Task 2: Rename product identity and release config
  - Updated `package.json` name and repository metadata.
  - Updated `electron-builder.yml` app id and product name.
  - Updated `src/app/main/index.ts` app user model id.
  - Updated `.github/workflows/release.yml` artifact glob.

- [x] Task 3: Rename preload bridge contract
  - Renamed the preload API type to `MorrowApi`.
  - Renamed the global bridge to `window.morrowApi` across preload, renderer, tests, and docs.

- [x] Task 4: Rename E2E mode controls
  - Replaced the previous env flag with `MORROW_E2E`.
  - Replaced the previous argv flag with `--morrow-e2e`.
  - Updated E2E launcher comments and tests.

- [x] Task 5: Rename storage keys, MCP/client identities, and internal labels
  - Replaced the previous storage key with `morrow:agent-prefs:v1`.
  - Replaced Codex MCP `clientInfo` names and benchmark result labels with Morrow identifiers.
  - Replaced temp path prefixes in tests where they included the previous brand.

- [x] Task 6: Rename user-visible UI strings and default role prompts
  - Updated `index.html` title, splash wordmark, sidebar title, install page, home placeholder, role context envelope, and default channel role prompts.
  - Kept interaction behavior unchanged.

- [x] Task 7: Rename docs, specs, prototypes, and old-name directories
  - Updated README, CHANGELOG, docs, playbooks, ADRs, SDD text, prototype HTML, and issue templates.
  - Renamed SDD directories that contained previous-brand tokens.

- [x] Task 8: Add brand-check guard
  - Added a script that fails on previous-brand spellings in current repository content.
  - Added `pnpm brand-check` to `package.json`.
  - Kept it as a release-readiness command for now rather than adding more work to `pre-commit`.

- [x] Task 9: Full automated verification
  - Ran `pnpm check`.
  - Ran `pnpm test -- --run`.
  - Ran the full Playwright suite directly with unsandboxed GUI access.
  - Ran `pnpm brand-check`.

- [x] Task 10: Build verification
  - Ran `pnpm dist:mac`.
  - Confirmed output artifacts use `Morrow-*` and app bundle is `Morrow.app`.
  - Confirmed no current build output exposes previous-brand spellings.

- [x] Task 11: Real runtime smoke plan
  - Documented opt-in smoke coverage for real Claude personal chat, Codex personal chat, Claude role mention, and Codex role mention.
  - Did not include real network smoke in default pre-commit.

- [x] Task 12: Handoff
  - Updated `CHANGELOG.md [Unreleased]`.
  - Wrote `.comate/specs/rename-to-morrow/summary.md`.
  - Verified final brand scan over current content returns no previous-brand matches.
