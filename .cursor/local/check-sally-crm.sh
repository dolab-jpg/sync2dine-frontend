#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
python3 <<'PY'
import json
from pathlib import Path
p = Path('server/data/synced-data-4fc49703-d1b0-4ac7-892d-9c32d31e9661.json')
d = json.loads(p.read_text())
q = d.get('outboundQueue') or []
hits = [j for j in q if '1784585135490' in str(j.get('id','')) or str(j.get('scheduledAt','')).startswith('2026-07-21T16')]
print('queue_len', len(q))
print('callback_hits', json.dumps(hits[-5:], indent=2)[:2000])
# staff cards / sessions
sess = d.get('sessions') or {}
card_hits = []
for uid, s in (sess.items() if isinstance(sess, dict) else []):
    msgs = (s or {}).get('cynthiaMessages') or (s or {}).get('messages') or []
    for m in msgs[-20:]:
        if isinstance(m, dict) and ('Sally' in str(m) or 'demo' in str(m).lower()):
            card_hits.append({'uid': uid, 'snippet': str(m)[:300]})
print('card_hits', len(card_hits))
print(json.dumps(card_hits[-5:], indent=2)[:1500])
PY

# check recent call
python3 <<'PY'
import json
from pathlib import Path
p = Path('server/data/synced-data-4fc49703-d1b0-4ac7-892d-9c32d31e9661.json')
d = json.loads(p.read_text())
calls = d.get('calls') or []
recent = [c for c in calls if str(c.get('id','')).startswith('out-1784585')][-5:]
print('recent_calls', json.dumps([{k:c.get(k) for k in ('id','status','endedAt','contactName','metadata')} for c in recent], indent=2)[:2000])
PY
