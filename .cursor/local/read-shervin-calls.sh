#!/bin/bash
python3 - <<'PY'
import json,urllib.request
raw=urllib.request.urlopen('http://127.0.0.1:3011/api/calls?limit=6', timeout=10).read()
data=json.loads(raw)
for c in data.get('calls',[]):
    cid=str(c.get('id') or '')
    if not cid.startswith('out-178888'):
        continue
    print('id', cid)
    print(' status', c.get('status'), 'dur', c.get('durationSec'), 'from', c.get('from'), 'rec', c.get('hasRecording'))
    print(' aim', (c.get('metadata') or {}).get('aim'), 'ended', (c.get('metadata') or {}).get('vapiEndedReason'))
    print(' template', c.get('campaignTemplate'))
    for t in (c.get('transcript') or [])[:8]:
        print(' ', t.get('role'), ':', str(t.get('content',''))[:140])
    print('---')
PY
