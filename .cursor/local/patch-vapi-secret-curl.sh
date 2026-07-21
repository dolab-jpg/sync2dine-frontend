#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
KEY=$(grep '^VAPI_PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
SECRET=$(grep '^VAPI_SERVER_SECRET=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
PHONE_ID=a09912e1-9d13-4a91-8789-7cb3eacd26ca
UA='Mozilla/5.0 (compatible; Sync2DineBot/1.0)'

for BASE in https://api.vapi.ai https://api.eu.vapi.ai; do
  echo "try $BASE"
  CODE=$(curl -sS -o /tmp/vapi-patch-out.json -w '%{http_code}' --max-time 25 \
    -X PATCH "${BASE}/phone-number/${PHONE_ID}" \
    -H "Authorization: Bearer ${KEY}" \
    -H "Content-Type: application/json" \
    -H "User-Agent: ${UA}" \
    -d "{\"serverUrl\":\"https://app.sync2dine.io/webhooks/vapi\",\"serverUrlSecret\":\"${SECRET}\"}" || echo fail)
  echo "code=$CODE"
  head -c 400 /tmp/vapi-patch-out.json; echo
  if [ "$CODE" = "200" ]; then
    python3 - <<'PY'
import json
d=json.load(open('/tmp/vapi-patch-out.json'))
print('OK secretSet=', bool(d.get('serverUrlSecret')), 'serverUrl=', d.get('serverUrl'))
PY
    exit 0
  fi
done
exit 1
