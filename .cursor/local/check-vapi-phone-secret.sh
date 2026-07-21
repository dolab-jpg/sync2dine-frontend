#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
KEY=$(grep '^VAPI_PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
curl -sS --max-time 25 -H "Authorization: Bearer ${KEY}" https://api.vapi.ai/phone-number \
  | python3 - <<'PY'
import sys,json
raw=sys.stdin.read()
d=json.loads(raw)
rows=d if isinstance(d,list) else d.get('data') or d.get('results') or []
for r in rows[:10]:
    print(json.dumps({
      'number': r.get('number'),
      'serverUrl': r.get('serverUrl'),
      'serverUrlSecretSet': bool(r.get('serverUrlSecret')),
      'server': r.get('server'),
      'name': r.get('name'),
    }, indent=2))
PY
