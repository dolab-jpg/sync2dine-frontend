#!/usr/bin/env python3
"""Keep home + Demo Kitchen (and their phone lines). Drop person-named CRM-sync orgs."""
import json
from pathlib import Path

DATA = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data")
HOME = "4fc49703-d1b0-4ac7-892d-9c32d31e9661"
KITCHEN = "c2887ddb-0cba-4df1-9086-e7399c92d159"
KEEP = {HOME, KITCHEN}
SMOKE = (
    "customers",
    "contacts",
    "quotes",
    "calls",
    "orders",
    "builders",
    "projects",
    "outboundQueue",
)


def empty_smoke(path: Path) -> None:
    if not path.exists():
        return
    data = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return
    for key in SMOKE:
        if isinstance(data.get(key), list) and data[key]:
            print(f"  clear {path.name} {key}={len(data[key])}")
            data[key] = []
    if KITCHEN in path.name and isinstance(data.get("phoneLines"), list):
        for line in data["phoneLines"]:
            if isinstance(line, dict) and "Judie" in str(line.get("label") or ""):
                line["enabled"] = True
                line["label"] = "Demo Kitchen Judie"
    path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")


orgs_path = DATA / "organizations.json"
orgs = json.loads(orgs_path.read_text(encoding="utf-8"))
kept = []
for o in orgs:
    oid = o.get("id")
    if oid not in KEEP:
        print("drop org", oid, o.get("name"))
        continue
    if oid == KITCHEN:
        o["name"] = "Demo Kitchen"
        o["status"] = "active"
        o["phoneDid"] = o.get("phoneDid") or "02071128727"
        o["notes"] = "Live restaurant tenant � Dishoom menu, Judie inbound 02071128727."
        print("keep Demo Kitchen active did=", o.get("phoneDid"))
    else:
        o["name"] = "Sync2Dine"
        o["status"] = "active"
        print("keep home Sync2Dine")
    kept.append(o)
orgs_path.write_text(json.dumps(kept, indent=2) + "\n", encoding="utf-8")

for path in DATA.glob("synced-data-*.json"):
    org_id = path.name[len("synced-data-") : -len(".json")]
    if org_id in KEEP:
        empty_smoke(path)
        continue
    path.unlink()
    print("deleted", path.name)

empty_smoke(DATA / "synced-data.json")
print("keep-demo-kitchen done, orgs=", len(kept))
