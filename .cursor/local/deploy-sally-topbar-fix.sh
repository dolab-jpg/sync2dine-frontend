#!/bin/bash
set -euo pipefail
BACKEND=/var/www/vhosts/sync2dine.io/sync2dine-backend
THEME=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child
APP=/var/www/vhosts/sync2dine.io/app.sync2dine.io

cp /tmp/orchestrator-handler.ts "$BACKEND/server/orchestrator-handler.ts"
cp /tmp/sally-web-routes.ts "$BACKEND/server/sally-web-routes.ts" 2>/dev/null || true
cp /tmp/saas-products.ts "$BACKEND/server/saas-products.ts" 2>/dev/null || true
cp /tmp/saas-packages.ts "$BACKEND/server/saas-packages.ts" 2>/dev/null || true
cp /tmp/sync2dine-dual-product.php "$THEME/sync2dine-dual-product.php"
cp /tmp/sally-widget.js "$APP/sally-widget.js"

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
cd "$BACKEND"
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 5

printf '%s' '{"sessionId":"deploy-test","text":"Tell me about Judie phone AI","page":"/"}' > /tmp/sally-test.json
echo "=== Sally API ==="
curl -s -w "\nHTTP:%{http_code}\n" -X POST http://127.0.0.1:3011/api/sally/web \
  -H 'Content-Type: application/json' -H 'Origin: https://sync2dine.io' \
  -d @/tmp/sally-test.json | head -c 400
echo

sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs eval 'if (class_exists("LiteSpeed\Purge")) { \LiteSpeed\Purge::purge_all(); }' 2>/dev/null || true

echo "=== Live checks ==="
curl -s https://app.sync2dine.io/sally-widget.js | grep -c 'Venue audio'
curl -sL https://sync2dine.io/ | grep -c 's2d-slash-pricing\|sally-widget'
echo DONE
