#!/usr/bin/env python3
"""Restore Demo Kitchen identity and re-empty smoke that legacy merge resurrected."""
import json
from pathlib import Path

DATA = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data")
HOME = "4fc49703-d1b0-4ac7-892d-9c32d31e9661"
KITCHEN = "c2887ddb-0cba-4df1-9086-e7399c92d159"
SMOKE = (
    "customers",
    "contacts",
    "quotes",
    "calls",
    "orders",
    "builders",
    "projects",
    "changeOrders",
    "contracts",
    "recruitmentJobs",
    "recruitmentInterviews",
    "sessions",
    "outboundQueue",
)


def empty_smoke(path: Path) -> None:
    if not path.exists():
        print("missing", path.name)
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        print("skip non-dict", path.name)
        return
    changed = []
    for key in SMOKE:
        if isinstance(data.get(key), list) and data[key]:
            changed.append(f"{key}:{len(data[key])}")
            data[key] = []
    if "phoneLines" in data and isinstance(data["phoneLines"], list):
        for line in data["phoneLines"]:
            if not isinstance(line, dict):
                continue
            label = str(line.get("label") or "")
            if KITCHEN in path.name and "Judie" in label:
                line["label"] = "Demo Kitchen Judie"
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"cleared {path.name} {changed or 'already empty'} phoneLines={len(data.get('phoneLines') or [])}")


orgs_path = DATA / "organizations.json"
orgs = json.loads(orgs_path.read_text(encoding="utf-8"))
for o in orgs:
    if o.get("id") == KITCHEN:
        o["name"] = "Demo Kitchen"
        o["notes"] = "Live restaurant tenant � Dishoom menu, Judie inbound 02071128727."
        o["contactName"] = o.get("contactName") or "Demo Kitchen"
        print("renamed kitchen org -> Demo Kitchen did=", o.get("phoneDid"))
    elif o.get("id") == HOME:
        o["name"] = "Sync2Dine"
        o["notes"] = "Platform home org (Sync2Dine). Staff invited by platform_owner land here."
        print("kept home org Sync2Dine")
orgs_path.write_text(json.dumps(orgs, indent=2) + "\n", encoding="utf-8")

empty_smoke(DATA / "synced-data.json")
empty_smoke(DATA / f"synced-data-{HOME}.json")
empty_smoke(DATA / f"synced-data-{KITCHEN}.json")

inbox = DATA / "lead-inbox.json"
if inbox.exists():
    parsed = json.loads(inbox.read_text(encoding="utf-8"))
    if isinstance(parsed, list):
        inbox.write_text("[]\n", encoding="utf-8")
        print(f"emptied lead-inbox.json ({len(parsed)})")
    elif isinstance(parsed, dict):
        for key, val in list(parsed.items()):
            if isinstance(val, list):
                parsed[key] = []
        inbox.write_text(json.dumps(parsed, indent=2) + "\n", encoding="utf-8")
        print("emptied lead-inbox.json dict lists")

print("launch repair done")
