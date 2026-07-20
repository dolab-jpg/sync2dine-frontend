#!/bin/bash
set -e
cp /tmp/sync2dine-dual-product.php /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
php -l /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush
rm -rf /var/www/vhosts/sync2dine.io/httpdocs/wp-content/cache/litespeed/* 2>/dev/null || true
echo "home_inject_bandHtml:" $(curl -sL 'https://sync2dine.io/?trim=1' | grep -c 'bandHtml\|s2d-dual-products' || true)
echo "home_trim_script:" $(curl -sL 'https://sync2dine.io/?trim=1' | grep -c 's2d-home-trim\|Who we serve' || true)
echo "pricing_slash:" $(curl -sL 'https://sync2dine.io/pricing/?trim=1' | grep -c 's2d-slash-pricing' || true)
echo "pricing_fare_code:" $(curl -sL 'https://sync2dine.io/pricing/?trim=1' | grep -c 's2d-fare' || true)
