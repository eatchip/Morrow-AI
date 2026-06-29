def project(snapshot, active_channel_id):
    channels_by_id = {channel["id"]: channel for channel in snapshot["channels"]}
    roles_by_id = {role["id"]: role for role in snapshot["roles"]}
    runs_by_id = {run["id"]: run for run in snapshot["runs"]}
    handoffs_by_id = {handoff["id"]: handoff for handoff in snapshot["handoffs"]}

    channel = channels_by_id.get(active_channel_id)
    if channel is None:
        return {
            "active_channel": None,
            "channel_roles": [],
            "ordered_events": [],
            "available_roles": snapshot["roles"][:],
        }

    member_ids = set(channel["memberRoleIds"])
    active_events = [
        event for event in snapshot["events"] if event.get("channelId") == active_channel_id
    ]
    active_events.sort(key=lambda event: (event.get("createdAt", 0), event.get("_inputIndex", 0)))

    event_views = []
    for event in active_events:
        role = roles_by_id.get(event.get("roleId")) if event.get("roleId") else None
        run = runs_by_id.get(event.get("runId")) if event.get("runId") else None
        handoff = handoffs_by_id.get(event.get("handoffId")) if event.get("handoffId") else None
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
        "channel_roles": [
            roles_by_id[role_id] for role_id in channel["memberRoleIds"] if role_id in roles_by_id
        ],
        "ordered_events": event_views,
        "available_roles": [role for role in snapshot["roles"] if role["id"] not in member_ids],
    }
