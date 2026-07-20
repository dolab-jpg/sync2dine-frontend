#!/bin/bash
set -e
rm -f /tmp/debug-bddce0.log
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
# also free port 3011 if something else holds it
fuser -k 3011/tcp 2>/dev/null || true
sleep 1
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 8
echo "== process =="
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3 || true
echo "== status =="
curl -sS --max-time 15 http://127.0.0.1:3011/api/whatsapp-web/status || true
echo
echo "== log =="
tail -40 /tmp/sync2dine-api.log || true
echo "== dbg =="
wc -l /tmp/debug-bddce0.log 2>/dev/null || echo 'no dbg yet'
cat /tmp/debug-bddce0.log 2>/dev/null || true
