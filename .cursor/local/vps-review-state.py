#!/usr/bin/env python3
import json
from pathlib import Path

root = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend")

def load(name):
    p = root / "server" / "data" / name
    if not p.exists():
        print(f"MISSING {name}")
        return None
    with p.open(encoding="utf-8") as f:
        return json.load(f)

print("=== organizations ===")
orgs = load("organizations.json")
if isinstance(orgs, dict):
    orgs = orgs.get("organizations") or orgs.get("orgs") or list(orgs.values())
if isinstance(orgs, list):
    for o in orgs:
        if isinstance(o, dict):
            print(o.get("id"), "|", o.get("name"), "|", o.get("status"), "|", o.get("plan"))
        else:
            print(type(o), o)
    print("count", len(orgs))

print("=== phone-lines ===")
phones = load("phone-lines.json")
if isinstance(phones, dict):
    lines = phones.get("lines") or phones.get("phoneLines") or phones
    if isinstance(lines, dict):
        print("keys", list(lines.keys())[:20])
        for k, v in list(lines.items())[:12]:
            if isinstance(v, dict):
                print(k, v.get("number") or v.get("did") or v.get("e164"), v.get("orgId") or v.get("organizationId"), v.get("purpose") or v.get("brain"))
            else:
                print(k, type(v))
    elif isinstance(lines, list):
        print("count", len(lines))
        for v in lines[:12]:
            if isinstance(v, dict):
                print(v.get("id"), v.get("number") or v.get("did"), v.get("orgId") or v.get("organizationId"), v.get("purpose") or v.get("label"))
else:
    print(type(phones))
