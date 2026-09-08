#!/bin/bash
set -euo pipefail
BASE=/var/www/vhosts/sync2dine.io/httpdocs/wp-content
CACHE=$BASE/cache
OWNER=sync2dine.io_asad090
GROUP=psacln

# Recreate LiteSpeed cache tree with correct ownership (PHP-FPM cannot write as root).
rm -rf "$CACHE/ls"
mkdir -p \
  "$CACHE/ls/css" \
  "$CACHE/ls/js" \
  "$CACHE/ls/ucss" \
  "$CACHE/ls/vpi" \
  "$CACHE/ls/cloud" \
  "$CACHE/ls/debug" \
  "$CACHE/ls/locallog"

# Guest mode conf stub (warnings only if missing; empty JSON object is fine).
if [ ! -f "$BASE/.litespeed_conf.dat" ]; then
  echo '{}' > "$BASE/.litespeed_conf.dat"
fi

chown -R "$OWNER:$GROUP" "$CACHE" "$BASE/.litespeed_conf.dat"
chmod -R ug+rwX "$CACHE"
chmod 644 "$BASE/.litespeed_conf.dat"

# Ensure dual-product is the pre-audit working copy.
cp -a "$BASE/themes/hello-elementor-child/sync2dine-dual-product.php.bak-audit-20260723" \
  "$BASE/themes/hello-elementor-child/sync2dine-dual-product.php"
chown "$OWNER:$GROUP" "$BASE/themes/hello-elementor-child/sync2dine-dual-product.php"

/usr/local/bin/wp --allow-root --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush || true

echo "cache tree:"
ls -la "$CACHE" "$CACHE/ls"
echo "owner check:"
stat -c '%U:%G %n' "$CACHE/ls" "$CACHE/ls/css" "$BASE/.litespeed_conf.dat"
