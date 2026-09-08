#!/bin/bash
set -euo pipefail
HTTPS=/var/www/vhosts/sync2gear.io/https
cd "$HTTPS"

echo "=== maintenance artifacts ==="
ls -la .maintenance wp-content/maintenance.php 2>/dev/null || true
rm -f .maintenance
# Plesk/WordPress maintenance drop-in can still force 503
if [ -f wp-content/maintenance.php ]; then
  mv wp-content/maintenance.php "wp-content/maintenance.php.disabled-$(date +%Y%m%d-%H%M%S)"
  echo "disabled maintenance.php"
fi

# Redis object cache drop-in already disabled; also deactivate redis-cache plugin if WP boots
if command -v /usr/local/bin/wp >/dev/null; then
  sudo -u asad090 /usr/local/bin/wp plugin deactivate redis-cache --path="$HTTPS" 2>/dev/null || true
  sudo -u asad090 /usr/local/bin/wp cache flush --path="$HTTPS" 2>/dev/null || true
fi

# Clear any remaining .maintenance
find "$HTTPS" -maxdepth 2 -name '.maintenance' -print -delete 2>/dev/null || true

sleep 1
echo "=== HTTP status ==="
curl -sSI --max-time 20 https://sync2gear.io/ | tr -d '\r' | head -20
echo "=== HTML head ==="
curl -sS --max-time 20 https://sync2gear.io/ | head -c 900
echo
echo "=== app redirect ==="
curl -sSI --max-time 15 https://app.sync2gear.io/ | tr -d '\r' | head -10
