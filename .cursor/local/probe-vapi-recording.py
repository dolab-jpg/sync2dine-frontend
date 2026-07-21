#!/usr/bin/env python3
import json, os, urllib.request
from pathlib import Path

env = {}
for line in Path('/var/www/vhosts/sync2dine.io/sync2dine-backend/.env').read_text(errors='ignore').splitlines():
    if '=' in line and not line.strip().startswith('#'):
        k,v = line.split('=',1)
        env[k.strip()] = v.strip().strip('"').strip("'")
key = env.get('VAPI_PRIVATE_KEY') or env.get('VAPI_API_KEY') or ''
cid = '019f8531-150c-7dd4-b88a-8678dfbedeb4'
paths = [
    f'/call/{cid}',
    f'/call/{cid}/artifact',
    f'/call/{cid}/recording',
    f'/call/{cid}/artifact/recording',
]
for path in paths:
    req = urllib.request.Request(
        f'https://api.vapi.ai{path}',
        headers={'Authorization': f'Bearer {key}', 'Accept': '*/*'},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            ct = r.headers.get('content-type','')
            data = r.read(500)
            print(path, r.status, ct, data[:120])
            if 'json' in ct:
                j = json.loads(data + r.read())
                art = j.get('artifact') or {}
                rec = art.get('recording')
                print('  recording type', type(rec).__name__, str(rec)[:200] if not isinstance(rec, dict) else {k: str(v)[:60] for k,v in rec.items()})
    except Exception as e:
        print(path, 'FAIL', e)
