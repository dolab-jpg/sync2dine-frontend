#!/bin/bash
set -euo pipefail
F=/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data/mailbox-data.json
ls -la "$F"
python3 - <<'PY'
import json
d=json.load(open("/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data/mailbox-data.json"))
conns=d.get("connections") if isinstance(d, dict) else d
if not isinstance(conns, list):
    conns=[]
print("connections", len(conns))
for c in conns:
    if not isinstance(c, dict):
        continue
    print({k:c.get(k) for k in ("id","email","status","provider","userId","orgId","accountEmail")})
PY
