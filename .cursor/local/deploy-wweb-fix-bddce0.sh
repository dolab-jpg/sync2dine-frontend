#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

# Pass URL into WWeb routes (for ?fresh=1 reconnect)
if grep -q 'handleWWebRoutes(req, res, pathname)' server/index.ts; then
  sed -i 's/handleWWebRoutes(req, res, pathname)/handleWWebRoutes(req, res, pathname, url)/' server/index.ts
fi

rm -f /tmp/debug-bddce0.log
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
fuser -k 3011/tcp 2>/dev/null || true
sleep 1

# Wipe stuck LocalAuth session from authenticated-without-ready hang
rm -rf server/data/.wwebjs_auth
echo "auth wiped"

nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &

echo "waiting for WhatsApp status..."
for i in 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19 20; do
  sleep 3
  STATUS_JSON=$(curl -sS --max-time 10 http://127.0.0.1:3011/api/whatsapp-web/status || echo '{}')
  echo "t=$((i*3))s $STATUS_JSON"
  echo "$STATUS_JSON" | grep -q '"status":"ready"' && break
  echo "$STATUS_JSON" | grep -q '"status":"qr_pending"' && break
  echo "$STATUS_JSON" | grep -q '"status":"error"' && break
done

echo "== process =="
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3 || true
echo "== log wa =="
grep -E 'WhatsApp|dbg-bddce0|version cache' /tmp/sync2dine-api.log | tail -40 || true
echo "== dbg =="
cat /tmp/debug-bddce0.log 2>/dev/null || echo 'no dbg'
