#!/bin/bash
set -eu
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 1
timeout 12 /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  > /tmp/sync2dine-api-fg.log 2>&1 || true
echo '=== FG LOG ==='
cat /tmp/sync2dine-api-fg.log
echo '=== files ==='
ls -la server/saas-packages.ts server/saas-products.ts server/saas-contracts.ts server/sally-web-routes.ts
