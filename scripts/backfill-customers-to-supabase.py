#!/usr/bin/env python3
"""Backfill Node disk customers into Supabase customers table for the home org."""
import json
import os
import urllib.request
from pathlib import Path

env = {}
for line in open("/etc/tradepro-api.env"):
    line = line.strip()
    if not line or line.startswith("#") or "=" not in line:
        continue
    k, v = line.split("=", 1)
    env[k] = v

url = env.get("SUPABASE_URL", "").rstrip("/")
key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
home = env.get("HOME_ORG_ID", "4fc49703-d1b0-4ac7-892d-9c32d31e9661").strip()
data_dir = Path("/var/www/vhosts/b-diddies.com/tradepro-app/server/data")

customers = {}
for name in [
    f"synced-data-{home}.json",
    "synced-data.json",
    "synced-data-bdiddies.json",
]:
    path = data_dir / name
    if not path.exists():
        continue
    payload = json.loads(path.read_text())
    for c in payload.get("customers") or []:
        cid = str(c.get("id") or "")
        if not cid:
            continue
        # Prefer named rows over empty stubs
        prev = customers.get(cid)
        if not prev or (c.get("name") and not prev.get("name")):
            customers[cid] = c

print(f"candidates={len(customers)} home={home}")
headers = {
    "apikey": key,
    "Authorization": f"Bearer {key}",
    "Content-Type": "application/json",
    "Prefer": "resolution=merge-duplicates",
}

rows = []
for cid, c in customers.items():
    data = {k: v for k, v in c.items() if k != "id"}
    rows.append({
        "id": cid,
        "org_id": home,
        "data": data,
        "updated_at": c.get("updatedAt") or c.get("createdAt") or "2026-07-15T00:00:00Z",
    })

# Upsert in chunks
CHUNK = 50
ok = 0
for i in range(0, len(rows), CHUNK):
    chunk = rows[i:i + CHUNK]
    req = urllib.request.Request(
        url + "/rest/v1/customers?on_conflict=org_id,id",
        data=json.dumps(chunk).encode(),
        headers=headers,
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            r.read()
            ok += len(chunk)
            print(f"upserted {ok}/{len(rows)}")
    except Exception as e:
        body = e.read().decode() if hasattr(e, "read") else str(e)
        print("ERROR", body)
        raise

# Verify
req = urllib.request.Request(
    url + f"/rest/v1/customers?org_id=eq.{home}&select=id",
    headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact"},
)
with urllib.request.urlopen(req, timeout=30) as r:
    data = json.loads(r.read().decode())
    print("supabase_count", len(data), "content-range", r.headers.get("content-range"))
