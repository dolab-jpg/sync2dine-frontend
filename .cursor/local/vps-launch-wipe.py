#!/usr/bin/env python3
"""One-shot VPS disk wipe for launch. Keep home + Demo Kitchen phone lines."""
import json
import os
from pathlib import Path

DATA = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data")
KEEP = {
    "4fc49703-d1b0-4ac7-892d-9c32d31e9661",
    "c2887ddb-0cba-4df1-9086-e7399c92d159",
}
SMOKE_KEYS = (
    "customers",
    "contacts",
    "quotes",
    "calls",
    "builders",
    "projects",
    "changeOrders",
    "contracts",
    "recruitmentJobs",
    "recruitmentInterviews",
    "sessions",
)

orgs_path = DATA / "organizations.json"
orgs = json.loads(orgs_path.read_text(encoding="utf-8"))
kept = [o for o in orgs if o.get("id") in KEEP]
print(f"organizations.json {len(orgs)} -> {len(kept)}")
orgs_path.write_text(json.dumps(kept, indent=2) + "\n", encoding="utf-8")

removed = 0
for path in DATA.glob("synced-data-*.json"):
    org_id = path.name[len("synced-data-") : -len(".json")]
    if org_id in KEEP:
        data = json.loads(path.read_text(encoding="utf-8"))
        lines = len(data.get("phoneLines") or [])
        for key in SMOKE_KEYS:
            if isinstance(data.get(key), list):
                data[key] = []
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"cleared smoke in {path.name} phoneLines={lines}")
        continue
    path.unlink()
    removed += 1
    print(f"deleted {path.name}")

print(f"removed extra synced-data files: {removed}")

for name in ("code-fix-jobs.json", "conversation-logs.json", "phone-incidents.json", "lead-inbox.json"):
    path = DATA / name
    if not path.exists():
        continue
    try:
        parsed = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        continue
    if isinstance(parsed, list):
        path.write_text("[]\n", encoding="utf-8")
        print(f"emptied {name} ({len(parsed)} rows)")
    elif isinstance(parsed, dict):
        if "jobs" in parsed and isinstance(parsed["jobs"], list):
            parsed["jobs"] = []
            path.write_text(json.dumps(parsed, indent=2) + "\n", encoding="utf-8")
            print(f"emptied {name} jobs")
        elif "incidents" in parsed and isinstance(parsed["incidents"], list):
            parsed["incidents"] = []
            path.write_text(json.dumps(parsed, indent=2) + "\n", encoding="utf-8")
            print(f"emptied {name} incidents")

users_path = DATA / "users.json"
if users_path.exists():
    users = json.loads(users_path.read_text(encoding="utf-8"))
    if isinstance(users, list):
        kept_users = [
            u
            for u in users
            if str(u.get("email", "")).lower() == "owner@sync2dine.io"
            or str(u.get("role", "")) == "platform_owner"
        ]
        users_path.write_text(json.dumps(kept_users, indent=2) + "\n", encoding="utf-8")
        print(f"users.json {len(users)} -> {len(kept_users)}")

print("vps disk wipe done")
