# Role

You are optimizing a pure data projection strategy for Morrow, an Electron + React desktop app.

# Task

Implement a Python function:

```python
def project(snapshot, active_channel_id):
    ...
```

The function must return exactly the same view model as the reference solution, while reducing projection latency for large channel histories.

# Data

`snapshot` is a dict with:

- `channels`: each item has `id`, `name`, `description`, `folderProjectId`, `memberRoleIds`, `createdAt`, `updatedAt`.
- `roles`: each item has `id`, `name`, `intro`, `instruction`, `defaultRuntime`, `createdAt`, `updatedAt`.
- `events`: each item has `id`, `channelId`, `type`, `authorType`, optional `roleId`, optional `runId`, optional `handoffId`, optional `text`, `createdAt`, `_inputIndex`.
- `runs`: each item has `id`, `channelId`, `roleId`, `trigger`, `triggerEventId`, `inputText`, `status`, `runtime`, `createdAt`, `updatedAt`.
- `handoffs`: each item has `id`, `channelId`, `fromRoleId`, `toRoleId`, `sourceRunId`, `reason`, `instruction`, `status`, `createdAt`, `updatedAt`.

# Required Output

Return a dict with:

- `active_channel`
- `channel_roles`
- `ordered_events`
- `available_roles`

`ordered_events` must contain one item per event in the active channel, sorted by `(createdAt, _inputIndex)`, with fields:

- `eventId`
- `type`
- `createdAt`
- `roleName`
- `runStatus`
- `handoffToRoleId`
- `text`

# Hard Constraints

- Preserve exact semantics.
- Do not mutate `snapshot`.
- Do not read or write files.
- Do not use network, subprocesses, dynamic import, eval, or exec.
- Keep the solution portable to TypeScript/React.
- Expose only the `project` function; helper functions are allowed.

# Scoring

Correctness is mandatory. Invalid output receives score 0.

Valid solutions are scored by p95 latency speedup over the baseline, with penalties for extra memory and excessive code size.

# Reference Feasible Direction

The baseline filters all events, sorts active channel events, and repeatedly performs linear lookups in roles, runs, and handoffs. A stronger approach usually builds id indexes first, then uses O(1) lookups during event projection.
