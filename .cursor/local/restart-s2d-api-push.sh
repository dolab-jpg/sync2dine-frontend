#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
grep -n 'serverUrlSecret\|toolServerCfg\|webhook_entry' server/vapi-assistant.ts server/vapi-routes.ts | head -20
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
OLD=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1 || true)
if [ -n "${OLD:-}" ]; then kill -9 "$OLD" || true; sleep 1; fi
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 8
curl -sS --max-time 8 http://127.0.0.1:3011/health; echo
curl -sS --max-time 8 https://app.sync2dine.io/health; echo
