#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
KEY=$(grep '^VAPI_PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
SECRET=$(grep '^VAPI_SERVER_SECRET=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
PHONE_ID=a09912e1-9d13-4a91-8789-7cb3eacd26ca

# Detect API host that works
BASE=https://api.vapi.ai
code=$(curl -sS -o /tmp/vapi-pn.json -w '%{http_code}' --max-time 20 -H "Authorization: Bearer ${KEY}" "${BASE}/phone-number/${PHONE_ID}" || true)
if [ "$code" != "200" ]; then
  BASE=https://api.eu.vapi.ai
  curl -sS -o /tmp/vapi-pn.json -w 'eu:%{http_code}\n' --max-time 20 -H "Authorization: Bearer ${KEY}" "${BASE}/phone-number/${PHONE_ID}" || true
fi
echo "using_base=$BASE get_code=$code"
python3 - <<'PY'
import json
from pathlib import Path
p=Path('/tmp/vapi-pn.json')
print('get_body', p.read_text()[:300])
PY

curl -sS -o /tmp/vapi-pn-patch.json -w 'patch:%{http_code}\n' --max-time 25 \
  -X PATCH "${BASE}/phone-number/${PHONE_ID}" \
  -H "Authorization: Bearer ${KEY}" \
  -H 'Content-Type: application/json' \
  -d "{\"serverUrl\":\"https://app.sync2dine.io/webhooks/vapi\",\"serverUrlSecret\":$(python3 -c 'import json,os; print(json.dumps(os.environ.get(\"SECRET\",\"\")))' )}" 
# pass secret via env
SECRET="$SECRET" python3 <<'PY'
import json, os, urllib.request
base=os.environ.get('BASE') or open('/tmp/vapi-base.txt').read().strip() if False else None
PY

# simpler patch with python
SECRET="$SECRET" KEY="$KEY" BASE="$BASE" PHONE_ID="$PHONE_ID" python3 <<'PY'
import json, os, urllib.request
base = os.environ['BASE']
key = os.environ['KEY']
secret = os.environ['SECRET']
phone_id = os.environ['PHONE_ID']
body = json.dumps({
  'serverUrl': 'https://app.sync2dine.io/webhooks/vapi',
  'serverUrlSecret': secret,
}).encode()
req = urllib.request.Request(
  f'{base}/phone-number/{phone_id}',
  data=body,
  headers={'Authorization': f'Bearer {key}', 'Content-Type': 'application/json'},
  method='PATCH',
)
try:
  with urllib.request.urlopen(req, timeout=25) as resp:
    data = resp.read().decode()
    print('patch_status', resp.status)
    d = json.loads(data)
    print('secretSet', bool(d.get('serverUrlSecret')))
    print('serverUrl', d.get('serverUrl'))
except Exception as e:
    print('patch_error', e)
    if hasattr(e, 'read'):
        print(e.read().decode()[:400])
PY
