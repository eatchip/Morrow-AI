# morrow-famou-performance — Summary

## Outcome

FaMou experiment `exp-20260526184047-4fua42` completed its EVOLVE stage and results were fetched locally.

- Experiment name: `morrow_perf_01`
- Package id: `file-20260526184047-9p00rhtwciqv`
- Remote initial score: `179.78`
- Remote best score: `206.59`
- Best iteration: `2`
- Results file: `famou/build/results.json.py`

## Best Strategy

The best candidate keeps the same projection contract as `init.py`, but avoids building full lookup maps for all secondary collections.

Key changes:

- Find the active channel first.
- Build `roles_by_id` once because roles are used for member roles, available roles, and event role names.
- Scan active-channel events once and collect only the `runId` and `handoffId` values needed by those events.
- Build `run_statuses` and `handoff_to_roles` only for referenced ids.
- Sort active events by `(createdAt, _inputIndex)` to preserve Morrow semantics.

This is a better fit than the initial indexed solution because `runs` and `handoffs` can grow independently of the active channel. Selective indexing keeps the large-history path fast without paying full-map memory cost for irrelevant records.

## Local Recheck

After fetching the result, the best candidate was re-evaluated locally:

- `validity`: `1.0`
- local score: `224.54`
- weighted speedup: `3.74x`
- small workload: `1.44x`
- medium workload: `3.33x`
- large workload: `6.45x`

Command used:

```bash
python3 .comate/specs/morrow-famou-performance/famou/evaluator.py .comate/specs/morrow-famou-performance/famou/build/results.json.py
```

## Recommended Next Step

Open a separate Morrow implementation SDD to port this projection strategy into TypeScript.

Likely target:

- `src/app/renderer/src/screens/ChannelWorkspace.tsx`

Implementation should not blindly paste the Python output. It should introduce a small local projection helper or memoized view-model builder, then verify:

- unit tests for semantic equivalence on unsorted events, missing role/run/handoff references, and missing active channel
- renderer test for long-history channel state
- E2E or perf scenario showing no regression in channel long-history rendering

## Notes

- No Morrow application source was changed in this FaMou experiment task.
- Experiment inputs used synthetic data only; no real user conversation or project data was uploaded.
- `famou/build/` contains scratch candidates and fetched results for local inspection.
