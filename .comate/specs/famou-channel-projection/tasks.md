# famou-channel-projection — Tasks

- [x] Task 1: Add projection tests
  - Cover active channel lookup, member role order, available role filtering, event order, resolved run/handoff/role references, missing references, and immutability.

- [x] Task 2: Add renderer view-model helper
  - Implement selective indexing strategy in `src/app/renderer/src/lib/channel-view-model.ts`.
  - Keep it framework-free and deterministic.

- [x] Task 3: Wire `ChannelWorkspace`
  - Replace render-local repeated scans with `buildChannelViewModel`.
  - Keep rendered UI behavior unchanged.

- [x] Task 4: Document and verify
  - Update `CHANGELOG.md`.
  - Run targeted unit test and typecheck.
  - Write `summary.md`.
