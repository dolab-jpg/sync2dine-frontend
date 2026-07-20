#!/bin/bash
set -e
rm -f /tmp/debug-bddce0.log
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
PID=$(pgrep -f 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -1 || true)
echo "old_pid=${PID:-none}"
if [ -n "${PID:-}" ]; then
  kill "$PID" || true
  sleep 2
fi
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 6
echo "== process =="
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3 || true
echo "== status =="
curl -sS --max-time 10 http://127.0.0.1:3011/api/whatsapp-web/status || true
echo
echo "== log =="
grep -n WhatsApp /tmp/sync2dine-api.log | tail -20 || true
echo "== dbg =="
wc -l /tmp/debug-bddce0.log 2>/dev/null || echo 'no dbg yet'
