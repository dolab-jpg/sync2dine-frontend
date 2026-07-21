#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
python3 <<'PY'
import json
from pathlib import Path
p = Path('server/data/synced-data-4fc49703-d1b0-4ac7-892d-9c32d31e9661.json')
d = json.loads(p.read_text())
jobs = d.get('outboundJobs') or d.get('outbound_jobs') or d.get('callQueue') or []
print('job_keys', [k for k in d.keys() if 'out' in k.lower() or 'job' in k.lower() or 'queue' in k.lower()])
hits = [j for j in jobs if '1784585135490' in str(j.get('id','')) or 'GU12' in str(j) or '2026-07-21T16:00' in str(j.get('scheduledAt',''))]
print('hits', len(hits))
print(json.dumps(hits[-3:] if hits else (jobs[-2:] if jobs else []), indent=2)[:1500])
cust = next((c for c in d.get('customers', []) if str(c.get('id')) == '1784487882245'), None)
if cust:
    print('cust', {k: cust.get(k) for k in ('id','name','address','email','nextFollowUp')})
PY

curl -sS --max-time 45 -X POST https://app.sync2dine.io/api/calls/outbound \
  -H 'Content-Type: application/json' \
  -d '{"to":"+447464207366","template":"lead_callback","context":{"aim":"sales_outreach","agentPersona":"sally","customerId":"1784487882245","customerName":"Dolab","company":"Pizza Go Go","brief":"Smoke: getOfferTerms packages, speak demo clearly, offer email, ask shall I sign you up. Venue Pizza Go Go GU12 5QW."}}'
echo
