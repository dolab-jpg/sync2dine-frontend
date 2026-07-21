#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
python3 <<'PY'
import json
from pathlib import Path
p = Path('server/data/synced-data-4fc49703-d1b0-4ac7-892d-9c32d31e9661.json')
d = json.loads(p.read_text())
q = d.get('outboundQueue') or []
print('latest_jobs:')
for j in q[:8]:
    print(json.dumps({
        'id': j.get('id'),
        'to': j.get('to'),
        'status': j.get('status'),
        'scheduledAt': j.get('scheduledAt'),
        'template': j.get('template'),
        'aim': (j.get('context') or {}).get('aim') if isinstance(j.get('context'), dict) else None,
        'restaurant': (j.get('context') or {}).get('restaurant') if isinstance(j.get('context'), dict) else None,
    }))
target = [j for j in q if '1784585135490' in str(j.get('id'))]
print('target', json.dumps(target, indent=2)[:1500])
PY
# cynthia staff store file?
ls -la server/data/*cynthia* server/data/*staff* 2>/dev/null || true
python3 <<'PY'
from pathlib import Path
import json
for p in Path('server/data').glob('*'):
    if 'cynthia' in p.name.lower() or 'staff' in p.name.lower():
        print('file', p)
        try:
            raw = p.read_text()[:500]
            print(raw[:300])
        except Exception as e:
            print(e)
PY
