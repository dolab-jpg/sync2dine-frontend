#!/usr/bin/env python3
import json
from pathlib import Path

root = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend")
data = root / "server" / "data"

print("=== data files ===")
for p in sorted(data.glob("*")):
    if p.is_file():
        print(f"{p.name:40} {p.stat().st_size:8} bytes")

print("\n=== account-auth register-org snippet ===")
auth = (root / "server" / "account-auth.ts").read_text(encoding="utf-8", errors="replace")
print("contact_phone" in auth, "saveCustomerRecord" in auth, "getHomeOrgId" in auth)

print("\n=== phone lines in synced-data ===")
for p in sorted(data.glob("synced-data-*.json")):
    d = json.loads(p.read_text(encoding="utf-8"))
    lines = d.get("phoneLines") or []
    print(p.name, "phoneLines", len(lines), "customers", len(d.get("customers") or []), "orders", len(d.get("orders") or []))
    for line in lines:
        print("  ", line.get("id"), line.get("did") or line.get("number"), line.get("label"), line.get("purpose") or line.get("brain"))

print("\n=== organizations.json names ===")
orgs = json.loads((data / "organizations.json").read_text(encoding="utf-8"))
for o in orgs:
    print(o.get("id"), o.get("name"), o.get("notes", "")[:80], "phoneDid", o.get("phoneDid") or o.get("phone_did"))
