# famou-channel-projection — Spec

## Context

FaMou experiment `exp-20260526184047-4fua42` found a better projection strategy for Morrow's channel workspace long-history path. The user asked to open a new branch/worktree and integrate the final strategy into the current codebase.

Approval: user explicitly requested implementation after reviewing the FaMou result summary.

## Goal

Move `ChannelWorkspace` derived data calculation out of render-local repeated scans and into a testable renderer view-model helper.

## Adopted Strategy

The final FaMou strategy:

1. Find the active channel.
2. Build `rolesById` because roles are reused by member role projection, available role filtering, event role names, and handoff names.
3. Scan events once for the active channel.
4. During that scan, collect only `runId` and `handoffId` values used by active-channel events.
5. Build selective `runsById` / `handoffsById` maps only for those referenced ids.
6. Sort active events by `createdAt`, preserving the existing stable-order behavior for equal timestamps.

This keeps behavior equivalent while reducing repeated linear lookups in long channel histories.

## Affected Files

- Add `src/app/renderer/src/lib/channel-view-model.ts`
- Edit `src/app/renderer/src/screens/ChannelWorkspace.tsx`
- Add `tests/unit/channel-view-model.spec.ts`
- Edit `CHANGELOG.md`
- Add this SDD and summary files

## State Ownership

- Source truth remains `ChannelSnapshot`, owned by the channel store/orchestrator in main/application layers.
- The new helper owns only a renderer-side UI projection. It does not mutate `snapshot` and does not write durable state.
- `ChannelWorkspace` remains the renderer consumer of the projection.

## Invariants

1. Missing or null active channel still renders the existing empty channel state.
2. Rendered event order remains active-channel events sorted by `createdAt`, with equal timestamps preserving snapshot order.
3. Missing role/run/handoff references degrade to the same null/hidden UI behavior as before.

## Boundaries

- No IPC changes.
- No persistence changes.
- No dependency changes.
- No visual design changes.
- No user data leaves the machine.

## Verification

- Unit test the projection helper for member order, active event order, missing references, handoff/run resolution, and snapshot immutability.
- Run targeted Vitest for the new unit test.
- Run TypeScript check.

## Non-goals

- Do not introduce virtualization or DOM rendering changes.
- Do not change channel store or persistence.
- Do not port the FaMou Python output verbatim; adapt the strategy to TypeScript and existing React structure.
