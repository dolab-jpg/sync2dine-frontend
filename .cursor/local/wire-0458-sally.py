#!/usr/bin/env python3
"""Add legacy 02034750458 as a Sally Soho66 line and sync the Asterisk bridge."""
import json
import urllib.request
import urllib.error
import sys

API = "http://127.0.0.1:3011"
HOME = "4fc49703-d1b0-4ac7-892d-9c32d31e9661"
BILLING = "/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data/phone-billing.json"

def req(method, path, body=None, timeout=180):
    data = None if body is None else json.dumps(body).encode()
    headers = {
        "Content-Type": "application/json",
        "X-Org-Id": HOME,
    }
    r = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode()
            return resp.status, json.loads(raw) if raw else {}
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            parsed = json.loads(raw)
        except Exception:
            parsed = {"error": raw[:800]}
        return e.code, parsed

billing = json.load(open(BILLING))
cfg = billing.get(HOME) or next(iter(billing.values()))
pwd = str(cfg.get("soho66SipPassword") or "").strip()
user = str(cfg.get("soho66SipUsername") or "").strip()
did = str(cfg.get("soho66FromNumber") or "").strip()
if user != "1006090093" or did.replace(" ", "") != "02034750458" or not pwd:
    print("REFUSING: billing row is not 1006090093 / 02034750458 or password missing")
    sys.exit(1)

# Skip if line already exists
st, lines = req("GET", "/api/agent/lines")
existing = []
for row in (lines.get("lines") if isinstance(lines, dict) else []) or []:
    existing.append((row.get("did"), row.get("sipUsername"), row.get("purpose")))
    if str(row.get("did") or "").replace(" ", "") in ("02034750458", "+442034750458") or str(row.get("sipUsername")) == "1006090093":
        print("line already present", row.get("id"), row.get("label"), row.get("did"), row.get("purpose"), row.get("status"))
        line_id = row.get("id")
        break
else:
    line_id = None

if not line_id:
    st, created = req("POST", "/api/agent/lines", {
        "label": "Sally sales (020 3475 0458)",
        "sipUsername": user,
        "sipPassword": pwd,
        "sipDomain": "sbc.soho66.co.uk",
        "did": did,
        "purpose": "sally",
        "enabled": True,
        "connectionType": "soho66",
    })
    print("create_line", st, json.dumps({k: created.get(k) if k != "line" else {kk: vv for kk, vv in (created.get("line") or {}).items() if kk != "sipPassword"} for k in created}, default=str)[:1200])
    if st >= 400:
        sys.exit(1)

print("== sync asterisk bridge ==")
st, sync = req("POST", "/api/platform/phone-lines/sync-asterisk-bridge", {"apply": True}, timeout=180)
# Strip any accidental secrets from nested line copies
if isinstance(sync, dict) and "lines" in sync:
    for l in sync["lines"]:
        if isinstance(l, dict) and "sipPassword" in l:
            l["sipPassword"] = "••••••"
print("sync_status", st)
print("sync_ok", sync.get("ok"))
print("sync_message", sync.get("message"))
print("sync_count", sync.get("count"))
print("registrations")
print(sync.get("registrations") or "")
byo = sync.get("byo") or {}
print("byo_ok", byo.get("ok"), "configured", byo.get("configured"))
for r in byo.get("results") or []:
    print(" byo", r.get("did"), r.get("action"), r.get("ok"), r.get("message"))
print("apply_ok", (sync.get("apply") or {}).get("ok"))
