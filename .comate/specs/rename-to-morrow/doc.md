# rename-to-morrow — Spec

> Status: Implemented.
> Date: 2026-06-29

## 1. Goal

Rename the product from the previous Mate-era brand to Morrow across the current repository and new build outputs.

The target state is strict:

- User-visible product name is `Morrow`.
- Lowercase technical identifier is `morrow`.
- Current source, tests, docs, specs, release config, and generated build outputs must not contain any previous-brand spelling.
- The app should still pass the existing automated checks after the rename.
- The demo-readiness path must include real Claude and Codex smoke tests before external release.

The user explicitly requested a full replacement, not a compatibility layer. This includes normally protected files such as `AGENTS.md`, `DEVELOPMENT.md`, and release workflow/config files when they contained the previous name.

## 2. Name Decision

Chosen name: `Morrow`.

Rationale:

- It connects naturally to "tomorrow" and the user's stated direction: a system for future-facing collaboration.
- It is broader than "Mate"; it can cover personal chat, group rooms, workflow-like task rooms, and future agent coordination.
- It avoids positioning the product as only a companion or chatbot.

Naming convention:

| Surface | Previous | New |
|---|---|---|
| Product display name | previous display brand | `Morrow` |
| Lowercase package / storage prefix | previous lowercase brand | `morrow` |
| Main app id | previous development app id | `com.eatchip.morrow` |
| macOS app | previous app bundle name | `Morrow.app` |
| DMG artifact | previous artifact prefix | `Morrow-<version>-<arch>.dmg` |
| Preload API | previous bridge name | `window.morrowApi` |
| API type | previous bridge type | `MorrowApi` |
| E2E env flag | previous E2E env flag | `MORROW_E2E` |
| E2E argv flag | previous E2E argv flag | `--morrow-e2e` |
| localStorage prefix | previous storage prefix | `morrow:*` |

## 3. Scope

In scope:

- `package.json`, `electron-builder.yml`, `.github/workflows/release.yml`.
- Main/preload/renderer source code.
- Shared IPC types and global window API.
- Tests and scripts.
- README, CHANGELOG, docs, playbooks, ADRs, and SDD files.
- Prototype HTML and text artifacts under `.comate/specs`.
- Directory names under `.comate/specs` that included previous-brand tokens.
- Local build outputs under `dist/`, rebuilt to `Morrow-*`.
- A repeatable brand-check command to prevent reintroducing the old name.
- A release-readiness smoke test plan for real Claude and Codex.

Out of scope:

- Rewriting Git commit history.
- Modifying old Git tags or already-published GitHub Release assets.
- Claiming trademark clearance. The name should be treated as provisional until a real legal/domain check is done.
- Migrating old local user data. The user requested no old-name compatibility; Morrow starts with Morrow-owned storage.
- Renaming the physical local workspace path during the code edit. The repository directory can be renamed manually after the branch is clean; tests must not depend on the old absolute path.

## 4. Implementation Summary

The previous name appeared in many surfaces:

- Product config: `electron-builder.yml`, `package.json`, release workflow.
- Runtime identity: the development app id.
- Preload bridge type and global API.
- E2E mode controls.
- User storage keys.
- Codex MCP client identity and performance benchmark labels.
- User-visible UI: title, splash wordmark, install page, sidebar, home placeholder, default role prompts.
- Docs, SDD history, and prototype files.
- Local build artifacts.

These surfaces were renamed to Morrow, and stale old-brand build outputs were removed before rebuilding.

## 5. State Ownership And Invariants

State ownership:

- Product identity is owned by build config and app source constants.
- Renderer access to privileged APIs is owned by preload; after the rename, the only exposed bridge is `window.morrowApi`.
- Runtime detection and session execution ownership does not change.
- Channel durable truth remains owned by `ChannelsStore` / `ChannelOrchestrator`.
- User-facing brand text is owned by UI/docs/source content and must not keep old fallback wording.

Invariants:

1. Current source, docs, tests, scripts, specs, and release config contain no previous-brand spelling after the rename, except inside `.git` history if scanned externally.
2. The preload bridge remains a strict allowlist. Renaming the bridge to `morrowApi` must not widen any IPC capability.
3. The rename must not change runtime semantics: Claude, Codex, personal chat, channel creation, `@role` triggering, and run supervision keep the same behavior.

## 6. Boundary And Risk Review

Boundary changes:

- Renderer global API changes from the previous bridge name to `window.morrowApi`.
- E2E launcher and app E2E mode change from the previous controls to `MORROW_E2E` / `--morrow-e2e`.
- App identity changes from the previous development id to `com.eatchip.morrow`.

Main risks:

| Risk | Impact | Mitigation |
|---|---|---|
| Mechanical rename misses a string | Old brand leaks into UI/docs/release | Added `brand-check` and ran hidden-directory scan |
| API rename breaks tests or preload bridge | App does not load or renderer cannot call IPC | Typecheck + E2E smoke |
| App ID change creates fresh userData | Existing local data not visible | Accepted as intended: no old-name compatibility |
| Release workflow still uploads old artifact pattern | Release lacks DMG | Updated workflow pattern to `Morrow-*.dmg`; verified `pnpm dist:mac` |
| Historical SDD files contain old name | Brand check fails or history remains confusing | Updated current SDD text and renamed old-name SDD directories |
| Generated `dist/` noise mixed into source commit | Large unrelated diff | Kept generated outputs ignored; used build only for validation |

## 7. Validation Plan

Automated:

- `pnpm brand-check` returns no current-file previous-brand matches.
- `pnpm check`.
- `pnpm test -- --run`.
- Playwright E2E suite.
- `pnpm dist:mac` produces `Morrow-<version>-arm64.dmg` and `Morrow-<version>-x64.dmg`.

Release-readiness smoke, opt-in because it uses real CLIs/network:

- Detect real Claude and Codex.
- Claude personal chat: send a constrained prompt and assert assistant output.
- Codex personal chat: send a constrained prompt and assert assistant output.
- Channel role run using Claude role: create channel, mention role, assert role message completes.
- Channel role run using Codex role: create channel, mention role, assert role message completes.
- Verify runtime timeout/cancel behavior still works in mock E2E.

## 8. Acceptance Criteria

- No current repository file contains previous-brand spellings.
- App UI shows `Morrow` in title/splash/sidebar/install/home surfaces.
- Preload contract exposes `morrowApi`; the previous bridge name no longer remains in source/tests.
- Build config creates `Morrow.app` and `Morrow-*.dmg`.
- Existing mocked E2E suite passes after the rename.
- Real runtime smoke checklist is documented and ready to run before demo release.
- `CHANGELOG.md` records the rename under `[Unreleased]`.
