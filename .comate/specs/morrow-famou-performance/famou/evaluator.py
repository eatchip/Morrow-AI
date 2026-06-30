#!/usr/bin/env python3
import ast
import copy
import importlib.util
import json
import math
import random
import sys
import time
import tracemalloc
from pathlib import Path


WORKLOADS = [
    {"name": "small", "channels": 5, "roles": 8, "events": 100, "runs": 40, "handoffs": 20},
    {"name": "medium", "channels": 20, "roles": 40, "events": 2000, "runs": 400, "handoffs": 160},
    {"name": "large", "channels": 80, "roles": 200, "events": 20000, "runs": 3000, "handoffs": 1200},
]

ALLOWED_IMPORT_ROOTS = {
    "bisect",
    "collections",
    "functools",
    "heapq",
    "itertools",
    "math",
    "operator",
    "typing",
}

BANNED_CALL_NAMES = {
    "__import__",
    "compile",
    "eval",
    "exec",
    "input",
    "open",
}

BANNED_IMPORT_ROOTS = {
    "builtins",
    "ctypes",
    "importlib",
    "io",
    "os",
    "pathlib",
    "pickle",
    "requests",
    "shutil",
    "socket",
    "subprocess",
    "sys",
    "tempfile",
}


def generate_snapshot(seed, channels_count, roles_count, events_count, runs_count, handoffs_count):
    rng = random.Random(seed)
    roles = [
        {
            "id": f"role-{i}",
            "name": f"Role {i}",
            "intro": f"Intro {i}",
            "instruction": f"Instruction {i}",
            "defaultRuntime": "codex" if i % 2 else "claude",
            "createdAt": 1000 + i,
            "updatedAt": 2000 + i,
        }
        for i in range(roles_count)
    ]

    channels = []
    for i in range(channels_count):
        width = 1 + (i % max(1, min(8, roles_count)))
        member_ids = [roles[(i * 7 + j * 3) % roles_count]["id"] for j in range(width)]
        channels.append(
            {
                "id": f"channel-{i}",
                "name": f"channel-{i}",
                "description": "",
                "folderProjectId": None,
                "memberRoleIds": member_ids,
                "createdAt": 3000 + i,
                "updatedAt": 4000 + i,
            }
        )

    runs = [
        {
            "id": f"run-{i}",
            "channelId": channels[i % channels_count]["id"],
            "roleId": roles[(i * 5) % roles_count]["id"],
            "trigger": "mention" if i % 3 else "handoff_accept",
            "triggerEventId": f"event-{max(0, i - 1)}",
            "inputText": f"input {i}",
            "status": ["running", "done", "failed", "canceled"][i % 4],
            "runtime": "codex" if i % 2 else "claude",
            "createdAt": 5000 + i,
            "updatedAt": 6000 + i,
        }
        for i in range(runs_count)
    ]

    handoffs = [
        {
            "id": f"handoff-{i}",
            "channelId": channels[i % channels_count]["id"],
            "fromRoleId": roles[(i * 2) % roles_count]["id"],
            "toRoleId": roles[(i * 2 + 1) % roles_count]["id"],
            "sourceRunId": runs[i % runs_count]["id"] if runs else "",
            "reason": f"reason {i}",
            "instruction": f"instruction {i}",
            "status": ["proposed", "accepted", "canceled"][i % 3],
            "createdAt": 7000 + i,
            "updatedAt": 8000 + i,
        }
        for i in range(handoffs_count)
    ]

    event_types = [
        "message_posted",
        "role_run_started",
        "role_message_posted",
        "role_run_failed",
        "handoff_proposed",
        "handoff_accepted",
        "role_joined",
        "folder_bound",
    ]
    events = []
    for i in range(events_count):
        event_type = event_types[i % len(event_types)]
        event = {
            "id": f"event-{i}",
            "channelId": channels[rng.randrange(channels_count)]["id"],
            "type": event_type,
            "authorType": "role" if event_type.startswith("role") else "user",
            "createdAt": 9000 + rng.randrange(max(1, events_count // 2)),
            "_inputIndex": i,
        }
        if event_type.startswith("role"):
            event["roleId"] = roles[(i * 11) % roles_count]["id"]
            if runs:
                event["runId"] = runs[(i * 13) % runs_count]["id"]
        if event_type.startswith("handoff") and handoffs:
            event["handoffId"] = handoffs[(i * 17) % handoffs_count]["id"]
        if event_type in ("message_posted", "role_message_posted", "role_run_failed"):
            event["text"] = f"message {i}"
        events.append(event)

    rng.shuffle(events)
    return {
        "channels": channels,
        "roles": roles,
        "events": events,
        "runs": runs,
        "handoffs": handoffs,
    }


def find_by_id(items, item_id):
    for item in items:
        if item.get("id") == item_id:
            return item
    return None


def baseline_project(snapshot, active_channel_id):
    channel = find_by_id(snapshot["channels"], active_channel_id)
    if channel is None:
        return {
            "active_channel": None,
            "channel_roles": [],
            "ordered_events": [],
            "available_roles": snapshot["roles"][:],
        }

    member_ids = set(channel["memberRoleIds"])
    channel_roles = []
    for role_id in channel["memberRoleIds"]:
        role = find_by_id(snapshot["roles"], role_id)
        if role is not None:
            channel_roles.append(role)

    active_events = [
        event for event in snapshot["events"] if event.get("channelId") == active_channel_id
    ]
    active_events.sort(key=lambda event: (event.get("createdAt", 0), event.get("_inputIndex", 0)))

    event_views = []
    for event in active_events:
        role = find_by_id(snapshot["roles"], event.get("roleId")) if event.get("roleId") else None
        run = find_by_id(snapshot["runs"], event.get("runId")) if event.get("runId") else None
        handoff = (
            find_by_id(snapshot["handoffs"], event.get("handoffId"))
            if event.get("handoffId")
            else None
        )
        event_views.append(
            {
                "eventId": event["id"],
                "type": event["type"],
                "createdAt": event["createdAt"],
                "roleName": role["name"] if role else None,
                "runStatus": run["status"] if run else None,
                "handoffToRoleId": handoff["toRoleId"] if handoff else None,
                "text": event.get("text"),
            }
        )

    return {
        "active_channel": channel,
        "channel_roles": channel_roles,
        "ordered_events": event_views,
        "available_roles": [role for role in snapshot["roles"] if role["id"] not in member_ids],
    }


def validate_candidate_source(candidate_path):
    source = candidate_path.read_text(encoding="utf-8")
    tree = ast.parse(source, filename=str(candidate_path))
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            for alias in node.names:
                root = alias.name.split(".")[0]
                if root in BANNED_IMPORT_ROOTS or root not in ALLOWED_IMPORT_ROOTS:
                    raise ValueError(f"disallowed import: {alias.name}")
        elif isinstance(node, ast.ImportFrom):
            root = (node.module or "").split(".")[0]
            if node.module is None or root in BANNED_IMPORT_ROOTS or root not in ALLOWED_IMPORT_ROOTS:
                raise ValueError(f"disallowed import: {node.module}")
            if any(alias.name == "*" for alias in node.names):
                raise ValueError("wildcard imports are not allowed")
        elif isinstance(node, ast.Call):
            if isinstance(node.func, ast.Name) and node.func.id in BANNED_CALL_NAMES:
                raise ValueError(f"disallowed call: {node.func.id}")
            if isinstance(node.func, ast.Attribute):
                root = node.func.value
                if isinstance(root, ast.Name) and root.id in BANNED_IMPORT_ROOTS:
                    raise ValueError(f"disallowed call root: {root.id}.{node.func.attr}")
    return source.count("\n") + 1


def load_candidate(path_user_py):
    path = Path(path_user_py).resolve()
    if not path.exists():
        raise ValueError(f"candidate not found: {path}")
    source_lines = validate_candidate_source(path)
    spec = importlib.util.spec_from_file_location("candidate_solution", path)
    if spec is None or spec.loader is None:
        raise ValueError(f"cannot import candidate from {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    fn = getattr(module, "project", None)
    if not callable(fn):
        raise ValueError("candidate must expose project(snapshot, active_channel_id)")
    return fn, source_lines


def p95(values):
    if not values:
        return 0.0
    ordered = sorted(values)
    index = min(len(ordered) - 1, math.ceil(len(ordered) * 0.95) - 1)
    return ordered[index]


def timed_call(fn, snapshot, active_channel_id, repeats):
    elapsed = []
    peak_bytes = 0
    result = None
    for _ in range(repeats):
        local_snapshot = copy.deepcopy(snapshot)
        tracemalloc.start()
        start = time.perf_counter()
        result = fn(local_snapshot, active_channel_id)
        elapsed.append((time.perf_counter() - start) * 1000)
        _, peak = tracemalloc.get_traced_memory()
        peak_bytes = max(peak_bytes, peak)
        tracemalloc.stop()
        if local_snapshot != snapshot:
            raise ValueError("candidate mutated evaluator-owned input")
    return result, p95(elapsed), peak_bytes


def evaluate(path_user_py, task_name="default", timeout=3600):
    started = time.perf_counter()
    try:
        candidate, source_lines = load_candidate(path_user_py)
        details = []
        speedups = []
        memory_peaks = []

        for index, workload in enumerate(WORKLOADS):
            if time.perf_counter() - started > timeout:
                raise TimeoutError(f"evaluation timed out after {timeout}s")

            snapshot = generate_snapshot(
                seed=20260526 + index,
                channels_count=workload["channels"],
                roles_count=workload["roles"],
                events_count=workload["events"],
                runs_count=workload["runs"],
                handoffs_count=workload["handoffs"],
            )
            active_channel_id = snapshot["channels"][index % len(snapshot["channels"])]["id"]
            expected = baseline_project(copy.deepcopy(snapshot), active_channel_id)
            actual = candidate(copy.deepcopy(snapshot), active_channel_id)
            if actual != expected:
                return {
                    "validity": 0.0,
                    "combined_score": 0.0,
                    "cost_time": time.perf_counter() - started,
                    "error_info": f"semantic mismatch on {workload['name']}",
                    "task_name": task_name,
                }

            repeats = 7 if workload["events"] <= 2000 else 3
            _, baseline_ms, _ = timed_call(baseline_project, snapshot, active_channel_id, repeats)
            _, candidate_ms, peak_bytes = timed_call(
                candidate, snapshot, active_channel_id, repeats
            )
            speedup = baseline_ms / max(candidate_ms, 0.001)
            speedups.append(speedup)
            memory_peaks.append(peak_bytes)
            details.append(
                {
                    "workload": workload["name"],
                    "baseline_p95_ms": round(baseline_ms, 4),
                    "candidate_p95_ms": round(candidate_ms, 4),
                    "speedup": round(speedup, 4),
                    "peak_bytes": peak_bytes,
                }
            )

        weighted_speedup = sum(speedups) / len(speedups)
        memory_penalty = max(memory_peaks) / 5_000_000
        complexity_penalty = max(0, source_lines - 140) * 0.05
        score = max(
            0.01,
            100 * math.log2(weighted_speedup + 1) - memory_penalty - complexity_penalty,
        )
        return {
            "validity": 1.0,
            "combined_score": score,
            "cost_time": time.perf_counter() - started,
            "error_info": "",
            "task_name": task_name,
            "weighted_speedup": weighted_speedup,
            "details": details,
            "source_lines": source_lines,
        }
    except Exception as exc:
        return {
            "validity": 0.0,
            "combined_score": 0.0,
            "cost_time": time.perf_counter() - started,
            "error_info": str(exc),
            "task_name": task_name,
        }


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: evaluator.py <candidate.py>", file=sys.stderr)
        sys.exit(2)
    print(json.dumps(evaluate(sys.argv[1]), ensure_ascii=False, indent=2))
