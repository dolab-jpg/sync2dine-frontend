#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
KEY=$(grep '^VAPI_PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
SECRET=$(grep '^VAPI_SERVER_SECRET=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
PHONE_ID=a09912e1-9d13-4a91-8789-7cb3eacd26ca
UA='Mozilla/5.0 (compatible; Sync2DineBot/1.0)'

# Try nested server object (current Vapi shape)
CODE=$(curl -sS -o /tmp/vapi-patch2.json -w '%{http_code}' --max-time 25 \
  -X PATCH "https://api.vapi.ai/phone-number/${PHONE_ID}" \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -H "User-Agent: ${UA}" \
  -d "{\"server\":{\"url\":\"https://app.sync2dine.io/webhooks/vapi\",\"secret\":\"${SECRET}\"},\"serverUrl\":\"https://app.sync2dine.io/webhooks/vapi\",\"serverUrlSecret\":\"${SECRET}\"}")
echo "code=$CODE"
python3 <<'PY'
import json
d=json.load(open('/tmp/vapi-patch2.json'))
print('keys', sorted(d.keys()))
print({k:d.get(k) for k in d if 'server' in k.lower() or 'secret' in k.lower()})
PY
