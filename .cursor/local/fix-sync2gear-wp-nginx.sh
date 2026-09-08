#!/bin/bash
set -euo pipefail
CONFDIR=/var/www/vhosts/system/sync2gear.io/conf
HTTPS=/var/www/vhosts/sync2gear.io/https
TS=$(date +%Y%m%d-%H%M%S)

echo "=== Restore WordPress-era nginx.conf ==="
cp -a "$CONFDIR/nginx.conf" "$CONFDIR/nginx.conf.bak-spa-era-$TS"
cp -a "$CONFDIR/nginx.conf.bak-syncflow-20260529" "$CONFDIR/nginx.conf"
# Also update live plesk include if it is a copy
if [ -f /etc/nginx/plesk.conf.d/vhosts/sync2gear.io.conf ]; then
  cp -a /etc/nginx/plesk.conf.d/vhosts/sync2gear.io.conf "/etc/nginx/plesk.conf.d/vhosts/sync2gear.io.conf.bak-spa-$TS"
  # Plesk usually symlinks or regenerates from system conf � force sync from system
  cp -a "$CONFDIR/nginx.conf" /etc/nginx/plesk.conf.d/vhosts/sync2gear.io.conf
fi

echo "=== Disable Redis object-cache (was breaking WP) ==="
if [ -f "$HTTPS/wp-content/object-cache.php" ]; then
  mv "$HTTPS/wp-content/object-cache.php" "$HTTPS/wp-content/object-cache.php.disabled-$TS"
  echo "Renamed object-cache.php"
fi

echo "=== Fix ownership/permissions for Apache ==="
chown -R asad090:psacln "$HTTPS"
# parent must be traversable
chmod 755 "$HTTPS"
find "$HTTPS" -type d -exec chmod 755 {} \;
find "$HTTPS" -type f -exec chmod 644 {} \;
chmod 600 "$HTTPS/wp-config.php" 2>/dev/null || true

echo "=== nginx -t && reload ==="
nginx -t
systemctl reload nginx
# Apache may need reload for docroot content
systemctl reload httpd || true

sleep 1
echo "=== Verify apex ==="
curl -sSI --max-time 20 https://sync2gear.io/ | tr -d '\r' | head -20
echo "--- body head ---"
curl -sS --max-time 20 https://sync2gear.io/ | head -c 500
echo ""
echo "=== Verify app still redirects ==="
curl -sSI --max-time 15 https://app.sync2gear.io/ | tr -d '\r' | head -12
echo DONE
