#!/bin/bash
set -e
OWNER=sync2dine.io_asad090
THEME=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child
APP=/var/www/vhosts/sync2dine.io/app.sync2dine.io
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend

cp /tmp/sally-widget.js "$APP/sally-widget.js"
chown "$OWNER:psaserv" "$APP/sally-widget.js"
chmod 644 "$APP/sally-widget.js"

cp /tmp/sync2dine-dual-product.php "$THEME/sync2dine-dual-product.php"
chown "$OWNER:psacln" "$THEME/sync2dine-dual-product.php"
php -l "$THEME/sync2dine-dual-product.php"

cp /tmp/sally-web-routes.ts "$BE/server/sally-web-routes.ts"
python3 /tmp/patch-sally-api.py
grep -n handleSallyWebRoutes "$BE/server/index.ts" | head

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
cd "$BE"
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 6
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3 || true
tail -30 /tmp/sync2dine-api.log || true

sudo -u "$OWNER" /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush || true
sudo -u "$OWNER" /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs litespeed-purge all 2>&1 | tail -5 || true
rm -rf /var/www/vhosts/sync2dine.io/httpdocs/wp-content/cache/litespeed/* 2>/dev/null || true

echo '=== HEALTH ==='
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
echo '=== SALLY LOCAL ==='
curl -sS --max-time 45 -X POST http://127.0.0.1:3011/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d '{"sessionId":"web_proof1","text":"How much is Atmosphere?","page":"marketing"}' | head -c 600; echo
echo '=== SALLY PUBLIC ==='
curl -sS --max-time 45 -X POST https://app.sync2dine.io/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d '{"sessionId":"web_proof2","text":"How much is Atmosphere?","page":"marketing"}' | head -c 600; echo
echo '=== CORS ==='
curl -sI -X OPTIONS https://app.sync2dine.io/api/sally/web \
  -H 'Origin: https://sync2dine.io' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type' | tr -d '\r' | grep -iE 'HTTP/|access-control'
echo '=== WIDGET ==='
grep -c 'sally-topbar__composer' "$APP/sally-widget.js"
echo '=== HOME ==='
HTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?n=$(date +%s)")
echo "bytes=${#HTML}"
echo "$HTML" | grep -oE 'sally-widget\.js[^"'\'' ]*|data-mode="topbar"|s2d-slash-pricing|slashed|£232|£139' | sort | uniq -c | head -40
echo '=== PRICING ==='
PHTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/pricing/?n=$(date +%s)")
echo "$PHTML" | grep -oE 's2d-slash-pricing|We.?ve slashed|£232|£139|£208|£347' | sort | uniq -c | head -40
echo DONE
