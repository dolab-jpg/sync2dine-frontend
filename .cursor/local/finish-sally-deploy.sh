#!/bin/bash
set -eu
OWNER=sync2dine.io_asad090
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
APP=/var/www/vhosts/sync2dine.io/app.sync2dine.io
THEME=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child

cp /tmp/sally-web-routes.ts "$BE/server/sally-web-routes.ts"
cp /tmp/sally-widget.js "$APP/sally-widget.js"
chown "$OWNER:psaserv" "$APP/sally-widget.js"
cp /tmp/sync2dine-dual-product.php "$THEME/sync2dine-dual-product.php"
chown "$OWNER:psacln" "$THEME/sync2dine-dual-product.php"
php -l "$THEME/sync2dine-dual-product.php"

# Ensure index patch still present
python3 /tmp/patch-sally-api.py || true

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
cd "$BE"
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
echo "pid=$!"
sleep 7
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3 || echo NONE
ss -tlnp | grep 3011 || echo NO_PORT
curl -sS --max-time 10 http://127.0.0.1:3011/health || echo HEALTH_FAIL
echo
echo '=== SALLY ==='
curl -sS --max-time 60 -X POST http://127.0.0.1:3011/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d '{"sessionId":"web_proof3","text":"How much is Atmosphere?","page":"marketing"}' | head -c 800
echo
echo '=== PUBLIC ==='
curl -sS --max-time 60 -X POST https://app.sync2dine.io/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d '{"sessionId":"web_proof4","text":"How much is Atmosphere?","page":"marketing"}' | head -c 800
echo
echo '=== CORS ==='
curl -sI -X OPTIONS https://app.sync2dine.io/api/sally/web \
  -H 'Origin: https://sync2dine.io' \
  -H 'Access-Control-Request-Method: POST' | tr -d '\r' | grep -iE 'HTTP/|access-control' || true

sudo -u "$OWNER" /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush || true
sudo -u "$OWNER" /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs litespeed-purge all 2>&1 | tail -5 || true
rm -rf /var/www/vhosts/sync2dine.io/httpdocs/wp-content/cache/litespeed/* 2>/dev/null || true

HTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?n=$(date +%s)")
echo "home_bytes=${#HTML}"
echo "$HTML" | grep -oE 'sally-widget\.js\?v=[^"'\'' ]+|data-mode="topbar"|s2d-slash-pricing|slashed' | sort | uniq -c
PHTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/pricing/?n=$(date +%s)")
echo "$PHTML" | grep -oE 's2d-slash-pricing|slashed|£232|£139|£208|£347' | sort | uniq -c
grep -c sally-topbar__composer "$APP/sally-widget.js"
tail -20 /tmp/sync2dine-api.log || true
echo DONE
