#!/bin/bash
set -euo pipefail
curl -sS --max-time 20 -X POST https://app.sync2dine.io/api/calls/outbound \
  -H 'Content-Type: application/json' \
  -d '{"to":"+447464207366","template":"lead_callback","enqueueOnly":true,"scheduledAt":"2026-07-21T16:00:00+01:00","context":{"aim":"demo_book","agentPersona":"sally","customerId":"1784487882245","name":"Dolab","restaurant":"Pizza Go Go","postcode":"GU12 5QW","reason":"Callback tomorrow 4pm — Sally smoke"}}'
echo
sleep 1
python3 <<'PY'
import json
from pathlib import Path
p = Path('/var/www/vhosts/sync2dine.io/sync2dine-backend/server/data/synced-data-4fc49703-d1b0-4ac7-892d-9c32d31e9661.json')
d = json.loads(p.read_text())
q = d.get('outboundQueue') or []
hits = [j for j in q if str(j.get('scheduledAt') or '').startswith('2026-07-21')]
print(json.dumps([
  {
    'id': j.get('id'),
    'status': j.get('status'),
    'scheduledAt': j.get('scheduledAt'),
    'aim': (j.get('context') or {}).get('aim'),
    'restaurant': (j.get('context') or {}).get('restaurant'),
  }
  for j in hits
], indent=2))
cust = next(c for c in d['customers'] if str(c.get('id')) == '1784487882245')
print('nextFollowUp', cust.get('nextFollowUp'), 'address', cust.get('address'))
PY
