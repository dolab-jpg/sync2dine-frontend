#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
SECRET=$(grep '^VAPI_SERVER_SECRET=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
echo "secret_len=${#SECRET}"
curl -sS -o /tmp/wh3.txt -w 'with_secret:%{http_code}\n' -X POST https://app.sync2dine.io/webhooks/vapi \
  -H 'Content-Type: application/json' \
  -H "x-vapi-secret: ${SECRET}" \
  -d '{"message":{"type":"status-update","status":"in-progress","call":{"id":"dbg-probe-16d357","type":"outboundPhoneCall","customer":{"number":"+447464207366"}}}}'
echo BODY:; cat /tmp/wh3.txt; echo
echo '--- audit ---'
tail -10 /tmp/vapi-webhook-audit.log
echo '--- debug ---'
tail -10 /tmp/debug-16d357.log 2>/dev/null || echo 'no debug log yet'
