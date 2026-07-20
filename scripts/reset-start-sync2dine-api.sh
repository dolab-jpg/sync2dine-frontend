#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

echo "== Reset to last known running backend commit =="
git reset --hard 34531b7

# Restore runtime files that were present when API was healthy
if [ -d /tmp/s2d-bak ]; then
  cp -a /tmp/s2d-bak/. server/ 2>/dev/null || true
fi

# Drop broken org-integrations copies if they break boot (optional features)
# Keep them if index does not import them yet.
if ! grep -q org-integrations-routes server/index.ts; then
  rm -f server/org-integrations-routes.ts server/org-integrations-store.ts server/integration-secret-fields.ts
fi

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2

nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &

sleep 6
echo PROCESS:
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -5 || true
echo LOG:
tail -40 /tmp/sync2dine-api.log || true
echo HEALTH:
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
