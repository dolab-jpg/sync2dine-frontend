#!/bin/bash
set -euo pipefail
echo '== from-number keys =='
grep -E '^(VAPI_FROM_NUMBER|SOHO66_FROM_NUMBER|SALLY_DID|SOHO66_SALLY)=' /var/www/vhosts/sync2dine.io/sync2dine-backend/.env | sed 's/=.*/=SET/' || true
echo '== did grep =='
grep -E '4750458|37453233|37732809' /var/www/vhosts/sync2dine.io/sync2dine-backend/.env | sed 's/\(.\{24\}\).*/\1.../' || true
echo '== latest api log hire =='
grep -E 'recruitment_interview|assistant-request|out-1788881469906|Shervin' /tmp/sync2dine-api.log | tail -40 || true
echo '== first+second calls =='
python3 - <<'PY'
import json,urllib.request
raw=urllib.request.urlopen('http://127.0.0.1:3011/api/calls?limit=8', timeout=10).read()
data=json.loads(raw)
for c in data.get('calls',[]):
    to=str(c.get('to') or '')
    cid=str(c.get('id') or '')
    if '7576442345' in to or cid.startswith('out-178888'):
        print('id', cid, 'status', c.get('status'), 'dur', c.get('durationSec'), 'template', c.get('campaignTemplate'), 'from', c.get('from'), 'rec', c.get('hasRecording'))
        print(' aim', (c.get('metadata') or {}).get('aim'), 'ended', (c.get('metadata') or {}).get('vapiEndedReason'))
        for t in (c.get('transcript') or [])[:12]:
            print(' ', t.get('role'), ':', str(t.get('content',''))[:160])
        print('---')
PY
