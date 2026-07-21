#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
export KEY=$(grep '^VAPI_PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
export SECRET=$(grep '^VAPI_SERVER_SECRET=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
export PHONE_ID=a09912e1-9d13-4a91-8789-7cb3eacd26ca

python3 <<'PY'
import json, os, urllib.request, urllib.error

key = os.environ['KEY']
secret = os.environ['SECRET']
phone_id = os.environ['PHONE_ID']
bases = ['https://api.vapi.ai', 'https://api.eu.vapi.ai']
body = json.dumps({
    'serverUrl': 'https://app.sync2dine.io/webhooks/vapi',
    'serverUrlSecret': secret,
}).encode()

for base in bases:
    req = urllib.request.Request(
        f'{base}/phone-number/{phone_id}',
        data=body,
        headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
        method='PATCH',
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode())
            print(json.dumps({
                'base': base,
                'status': resp.status,
                'serverUrl': data.get('serverUrl'),
                'secretSet': bool(data.get('serverUrlSecret')),
            }))
            break
    except urllib.error.HTTPError as e:
        print(json.dumps({'base': base, 'status': e.code, 'err': e.read().decode()[:200]}))
    except Exception as e:
        print(json.dumps({'base': base, 'error': str(e)[:200]}))
PY

# restart API with new assistant secret wiring
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
: > /tmp/debug-16d357.log || true
: > /tmp/vapi-webhook-audit.log || true
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 8
curl -sS http://127.0.0.1:3011/health; echo
grep -n 'serverUrlSecret\|toolServerCfg' server/vapi-assistant.ts | head -10
