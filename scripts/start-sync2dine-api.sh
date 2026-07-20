#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

if ! grep -q 'getDemoKitchenOrgId' server/home-org.ts; then
  cat >> server/home-org.ts <<'EOT'

/** Alias used by call-recording store — home org for Sync2Dine. */
export function getDemoKitchenOrgId(): string {
  return getHomeOrgId();
}
EOT
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
