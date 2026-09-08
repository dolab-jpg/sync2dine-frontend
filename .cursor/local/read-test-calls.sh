#!/bin/bash
python3 - <<'PY'
import json,urllib.request
url='http://127.0.0.1:3011/api/calls?limit=3'
raw=urllib.request.urlopen(url, timeout=10).read()
data=json.loads(raw)
for c in data.get('calls',[]):
    if str(c.get('id','')).startswith('out-178888'):
        print('id', c.get('id'))
        print('status', c.get('status'))
        print('outcome', c.get('outcome'))
        print('template', c.get('campaignTemplate'))
        print('from', c.get('from'))
        print('to', c.get('to'))
        print('duration', c.get('durationSec'))
        print('endedReason', (c.get('metadata') or {}).get('vapiEndedReason'))
        print('hasRecording', c.get('hasRecording'))
        print('aim', (c.get('metadata') or {}).get('aim'))
        trans=c.get('transcript') or []
        print('turns', len(trans))
        for t in trans[:20]:
            print(t.get('role'), ':', str(t.get('content',''))[:180])
        print('---')
PY
