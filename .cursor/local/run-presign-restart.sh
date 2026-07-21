#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
/opt/plesk/node/24/bin/node --import tsx --env-file=.env smoke-presign.mts
fuser -k 3011/tcp 2>/dev/null || true
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' 2>/dev/null || true
sleep 2
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env \
  server/index.ts >> /tmp/sync2dine-api.log 2>&1 &
sleep 7
curl -sS --max-time 8 http://127.0.0.1:3011/health; echo
curl -sS --max-time 8 https://app.sync2dine.io/health; echo
