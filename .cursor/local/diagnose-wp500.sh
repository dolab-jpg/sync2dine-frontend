#!/bin/bash
set -e
echo "=== theme files ==="
ls -la /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/
echo "=== php lint ==="
php -l /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
php -l /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/functions.php
php -l /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/page-ai-phone-ordering.php
echo "=== error logs ==="
for f in \
  /var/www/vhosts/system/sync2dine.io/logs/error_log \
  /var/www/vhosts/sync2dine.io/logs/error_log \
  /var/www/vhosts/sync2dine.io/httpdocs/wp-content/debug.log
do
  if [ -f "$f" ]; then
    echo "-- $f --"
    tail -n 60 "$f"
  fi
done
echo "=== cache dir ==="
ls -la /var/www/vhosts/sync2dine.io/httpdocs/wp-content/cache/ || true
echo "=== curl local ==="
curl -sS -o /tmp/s2d-home.html -w "status:%{http_code}\n" -H 'Host: sync2dine.io' http://127.0.0.1/ || true
head -c 400 /tmp/s2d-home.html || true
echo
echo "=== wp option ==="
/usr/local/bin/wp --allow-root --path=/var/www/vhosts/sync2dine.io/httpdocs option get home 2>&1 | head -5
/usr/local/bin/wp --allow-root --path=/var/www/vhosts/sync2dine.io/httpdocs plugin list --status=active 2>&1 | head -30
