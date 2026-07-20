#!/bin/bash
set -eu
THEME=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child
OWNER=sync2dine.io_asad090
cp /tmp/sync2dine-dual-product.php "$THEME/sync2dine-dual-product.php"
chown "$OWNER:psacln" "$THEME/sync2dine-dual-product.php"
php -l "$THEME/sync2dine-dual-product.php"
grep -n 'sync2dine_print_home_band_inject\|data-no-optimize' "$THEME/sync2dine-dual-product.php" | head
sudo -u "$OWNER" /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush || true
rm -rf /var/www/vhosts/sync2dine.io/httpdocs/wp-content/cache/litespeed/* 2>/dev/null || true
HTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?n=$(date +%s)")
echo "bytes=${#HTML}"
echo "$HTML" | grep -c bandHtml || true
echo "$HTML" | grep -c s2d-slash-pricing || true
echo "$HTML" | grep -c 'sync2dine_print_home\|data-no-optimize' || true
echo "$HTML" | tr '"' '\n' | grep -E 'bandHtml|s2d-slash|sally-widget|data-mode' | head -20
echo DONE
