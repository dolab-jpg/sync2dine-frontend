#!/bin/bash
set -eu
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
OLD=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
echo "old_pid=${OLD:-none}"
if [ -n "${OLD:-}" ]; then
  kill -9 "$OLD" || true
  sleep 2
fi
# also kill any leftover node server/index for this app
pkill -f 'sync2dine-backend.*server/index.ts' || true
sleep 1
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 5
NEW=$(ss -tlnp | grep ':3011' | sed -n 's/.*pid=\([0-9]*\).*/\1/p' | head -1)
echo "new_pid=${NEW:-none}"
tail -40 /tmp/sync2dine-api.log
echo "---"
curl -sS -w "\ntemplates:%{http_code}\n" http://127.0.0.1:3011/api/messages/templates | head -c 400
echo
curl -sS -o /dev/null -w "public_templates:%{http_code}\n" https://app.sync2dine.io/api/messages/templates
curl -sS -o /dev/null -w "public_compose:%{http_code}\n" -X POST https://app.sync2dine.io/api/ai/compose-email -H 'Content-Type: application/json' -d '{}'
