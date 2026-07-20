#!/bin/bash
# Patch dual-product to mark Sally as no-optimize + purge LiteSpeed
FILE=/var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
sudo sed -i 's|<script src="https://app.sync2dine.io/sally-widget.js"|<script data-no-optimize="1" data-cfasync="false" src="https://app.sync2dine.io/sally-widget.js"|g' "$FILE"
grep -n sally-widget "$FILE" | head
# Purge LiteSpeed
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs litespeed-purge all 2>&1 | tail -10
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush
sudo rm -rf /var/www/vhosts/sync2dine.io/httpdocs/wp-content/cache/litespeed/* 2>/dev/null || true
# Hit homepage to regenerate
sleep 1
HTML=$(curl -sL -H 'Cache-Control: no-cache' -A 'Mozilla/5.0' "https://sync2dine.io/?nocache=$(date +%s)")
echo "bytes=${#HTML}"
echo "$HTML" | grep -o 'sally-widget[^"]*' | head
echo "$HTML" | grep -c 'data-mode="topbar"'
echo "$HTML" | grep -c 's2d-legal-footer'
