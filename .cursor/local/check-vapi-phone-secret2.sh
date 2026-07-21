#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
KEY=$(grep '^VAPI_PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
curl -sS --max-time 25 -H "Authorization: Bearer ${KEY}" https://api.vapi.ai/phone-number -o /tmp/vapi-phones.json
wc -c /tmp/vapi-phones.json
python3 <<'PY'
import json
from pathlib import Path
raw = Path('/tmp/vapi-phones.json').read_text()
d = json.loads(raw)
rows = d if isinstance(d, list) else d.get('data') or d.get('results') or []
print('count', len(rows) if isinstance(rows, list) else type(d))
if not isinstance(rows, list):
    print(raw[:400])
for r in rows[:8]:
    print({
        'number': r.get('number'),
        'serverUrl': r.get('serverUrl'),
        'secretSet': bool(r.get('serverUrlSecret')),
        'serverKeys': [k for k in r.keys() if 'server' in k.lower() or 'secret' in k.lower()],
    })
PY
