# famou-channel-projection — Summary

## Done

- Created isolated worktree `/Users/songhuiyu/Morrow-famou-projection` on branch `codex/famou-projection`.
- Added `buildChannelViewModel` in `src/app/renderer/src/lib/channel-view-model.ts`.
- Wired `ChannelWorkspace` to consume the view model instead of repeatedly scanning `roles`, `runs`, and `handoffs` while rendering timeline items.
- Added unit tests for projection semantics and snapshot immutability.
- Updated `CHANGELOG.md`, `README.md`, and `package.json` for the `v0.3.5` release.

## Strategy Ported From FaMou

The TypeScript implementation adapts the FaMou result:

- build one `rolesById` map because role lookups are used across multiple UI projections;
- scan active-channel events once;
- collect only run/handoff ids referenced by those active events;
- build selective run/handoff lookup maps instead of indexing all records;
- keep event ordering equivalent to the prior stable `createdAt` sort.

## Verification

Targeted checks run:

```bash
pnpm test -- --run tests/unit/channel-view-model.spec.ts tests/unit/channel-composer.spec.tsx
pnpm check
pnpm lint
pnpm test:e2e tests/e2e/channel-role-mvp.spec.ts
```

All passed.

## Follow-up

This does not add DOM virtualization. If future real-world channels reach tens of thousands of rendered messages, the next optimization should measure and address DOM/render cost separately from projection cost.
