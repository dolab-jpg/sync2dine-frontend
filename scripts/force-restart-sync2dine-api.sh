#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

# Force kill anything on 3011 / sync2dine API
fuser -k 3011/tcp 2>/dev/null || true
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 3

nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &

sleep 6
echo PROCESS:
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -5 || true
echo LOG:
tail -30 /tmp/sync2dine-api.log || true
echo HEALTH:
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
echo AI:
curl -sS --max-time 10 -X POST https://app.sync2dine.io/api/ai/health -H 'Content-Type: application/json' -d '{"provider":"deepseek"}'; echo
# Confirm new health message on disk and in response
grep -n 'AI brain not connected' server/openai-health.ts | head -2
