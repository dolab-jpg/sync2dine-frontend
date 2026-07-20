#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

# Backend layout uses server/playbooks, not src/app/config/trades/playbooks
sed -i "s|from '../src/app/config/trades/playbooks/bathroom'|from './playbooks/bathroom'|g" server/vision-handler.ts
sed -i "s|from '../src/app/config/trades/playbooks'|from './playbooks'|g" server/vision-handler.ts

# Kill any leftover API
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2

nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &

sleep 5
echo "PROCESS:"
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -5 || true
echo "LOG:"
tail -40 /tmp/sync2dine-api.log || true
echo "HEALTH:"
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
echo "AI HEALTH:"
curl -sS --max-time 10 -X POST https://app.sync2dine.io/api/ai/health -H 'Content-Type: application/json' -d '{"provider":"deepseek"}'; echo
echo "ORG INTEGRATIONS:"
curl -sS --max-time 10 -o /tmp/oi.json -w "%{http_code}" https://app.sync2dine.io/api/org/integrations; echo
head -c 200 /tmp/oi.json; echo
