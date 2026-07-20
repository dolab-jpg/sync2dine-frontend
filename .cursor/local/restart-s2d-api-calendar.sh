#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

fuser -k 3011/tcp 2>/dev/null || true
pkill -9 -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 3

# Verify critical imports resolve before daemonizing
/opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env \
  -e "Promise.all([import('./server/calendar-routes.ts'),import('./server/org-integrations-routes.ts'),import('./server/sally-web-routes.ts')]).then(()=>{console.log('imports-ok');process.exit(0)}).catch((e)=>{console.error(e);process.exit(1)})" \
  2>&1 | tee /tmp/sync2dine-import-check.log

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
curl -sS --max-time 10 https://app.sync2dine.io/health || true
echo
echo ORG:
curl -sS --max-time 10 -H 'X-Org-Id: c2887ddb-0cba-4df1-9086-e7399c92d159' https://app.sync2dine.io/api/org/integrations | head -c 300 || true
echo
echo CAL:
curl -sS --max-time 10 https://app.sync2dine.io/api/calendar/connection | head -c 300 || true
echo
