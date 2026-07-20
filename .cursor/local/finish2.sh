#!/bin/bash
set -eu
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
APP=/var/www/vhosts/sync2dine.io/app.sync2dine.io
OWNER=sync2dine.io_asad090

cp /tmp/saas-packages.ts "$BE/server/saas-packages.ts"
cp /tmp/saas-products.ts "$BE/server/saas-products.ts"
cp /tmp/saas-contracts.ts "$BE/server/saas-contracts.ts"
cp /tmp/sally-web-routes.ts "$BE/server/sally-web-routes.ts"
cp /tmp/sally-widget.js "$APP/sally-widget.js"
chown "$OWNER:psaserv" "$APP/sally-widget.js"
python3 /tmp/patch-orch-model.py || true

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
cd "$BE"
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
echo "pid=$!"
sleep 8
ss -tlnp | grep 3011 || echo NO_PORT
curl -sS --max-time 10 http://127.0.0.1:3011/health || echo HEALTH_FAIL
echo
echo '=== SALLY CHAT ==='
curl -sS --max-time 90 -X POST https://app.sync2dine.io/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d '{"sessionId":"web_proof6","text":"How much is Atmosphere?","page":"marketing"}' | head -c 1000
echo
echo '=== CORS ==='
curl -sI -X OPTIONS https://app.sync2dine.io/api/sally/web \
  -H 'Origin: https://sync2dine.io' \
  -H 'Access-Control-Request-Method: POST' | tr -d '\r' | grep -iE 'HTTP/|access-control'
tail -25 /tmp/sync2dine-api.log || true
echo DONE
