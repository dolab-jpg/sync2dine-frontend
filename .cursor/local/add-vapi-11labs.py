#!/usr/bin/env python3
import json
import urllib.request
from pathlib import Path

env = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/.env").read_text()
vals = {}
for line in env.splitlines():
    if "=" in line and not line.startswith("#"):
        k, v = line.split("=", 1)
        vals[k] = v.strip().strip('"')
el = vals.get("ELEVENLABS_API_KEY", "").strip()
vk = vals.get("VAPI_PRIVATE_KEY", "").strip()
print("has_eleven", bool(el), "len", len(el))
print("has_vapi", bool(vk), "len", len(vk))
req = urllib.request.Request(
    "https://api.vapi.ai/credential",
    data=json.dumps(
        {
            "provider": "11labs",
            "apiKey": el,
            "name": "Sync2Dine ElevenLabs",
        }
    ).encode(),
    headers={"Authorization": f"Bearer {vk}", "Content-Type": "application/json"},
    method="POST",
)
try:
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
        print("status", r.status)
        print(body[:400])
except Exception as e:
    if hasattr(e, "read"):
        print("err", e.read().decode()[:500])
    else:
        print("err", e)
