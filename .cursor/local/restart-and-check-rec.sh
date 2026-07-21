#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
fuser -k 3011/tcp 2>/dev/null || true
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' 2>/dev/null || true
sleep 3
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env \
  server/index.ts > /tmp/sync2dine-api.log 2>&1 &
sleep 8
curl -sS --max-time 8 http://127.0.0.1:3011/health; echo
CODE=$(curl -sS -o /tmp/rec.out -w '%{http_code}' --max-time 20 'http://127.0.0.1:3011/api/calls/out-1784646013205/recording' || true)
echo "recording_http=$CODE"
head -c 180 /tmp/rec.out; echo
tail -20 /tmp/sync2dine-api.log
