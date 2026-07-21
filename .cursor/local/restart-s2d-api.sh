#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
OLD=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
if [ -n "${OLD:-}" ]; then kill -9 "$OLD" || true; sleep 1; fi
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 14
echo '---health---'
curl -sS --max-time 8 http://127.0.0.1:3011/health; echo
echo '---wa---'
curl -sS --max-time 8 http://127.0.0.1:3011/api/whatsapp-web/status; echo
echo '---sb---'
curl -sS --max-time 8 http://127.0.0.1:3011/api/sales-brain/status; echo
echo '---log---'
grep -E 'WhatsApp|sales-brain|running on|SyntaxError|already live' /tmp/sync2dine-api.log | tail -20
