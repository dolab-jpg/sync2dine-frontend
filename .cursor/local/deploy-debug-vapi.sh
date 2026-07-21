#!/bin/bash
set -euo pipefail
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$BE"
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
OLD=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
if [ -n "${OLD:-}" ]; then kill -9 "$OLD" || true; sleep 1; fi
: > /tmp/debug-16d357.log || true
: > /tmp/vapi-webhook-audit.log || true
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 8
curl -sS --max-time 8 http://127.0.0.1:3011/health; echo
bash /tmp/probe-vapi-webhook.sh
# also EOC probe with secret
SECRET=$(grep '^VAPI_SERVER_SECRET=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//')
curl -sS -o /tmp/wh4.txt -w 'eoc_probe:%{http_code}\n' -X POST https://app.sync2dine.io/webhooks/vapi \
  -H 'Content-Type: application/json' \
  -H "x-vapi-secret: ${SECRET}" \
  -d '{"message":{"type":"end-of-call-report","endedReason":"customer-ended-call","call":{"id":"dbg-eoc-16d357","type":"outboundPhoneCall","customer":{"number":"+447464207366"}},"transcript":"AI: hi\nUser: hello","artifact":{"recordingUrl":"https://example.com/rec.wav"}}}'
echo; cat /tmp/wh4.txt; echo
echo '=== debug-16d357 ==='
cat /tmp/debug-16d357.log
# Vapi phone number serverUrl check if key present
KEY=$(grep '^VAPI_PRIVATE_KEY=' .env | head -1 | cut -d= -f2- | tr -d '\r' | sed 's/^"//;s/"$//' || true)
if [ -n "${KEY:-}" ]; then
  echo '=== vapi phone numbers serverUrl ==='
  curl -sS --max-time 20 -H "Authorization: Bearer ${KEY}" https://api.vapi.ai/phone-number 2>/dev/null | python3 -c 'import sys,json; d=json.load(sys.stdin); rows=d if isinstance(d,list) else d.get("data") or d.get("results") or [];
[print(json.dumps({k:r.get(k) for k in ("id","number","serverUrl","server","name") if k in r or True})) for r in (rows[:8] if isinstance(rows,list) else [])]' 2>/dev/null || echo 'vapi list failed'
fi
