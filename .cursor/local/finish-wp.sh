#!/bin/bash
set -e
sed -i 's/\r$//' /tmp/sync2dine-dual-product.php
sudo cp /tmp/sync2dine-dual-product.php /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
sudo chown sync2dine.io_asad090:psacln /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
grep -n 'print_sally' /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs search-replace all1house.com sync2dine.io --all-tables --precise | tail -8
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush
echo '--- HTML CHECK ---'
curl -sL https://sync2dine.io/ | tr '"' '\n' | grep -iE 'sally|topbar|app.sync2dine' | head -20
echo 'all1house count:'
curl -sL https://sync2dine.io/ | grep -ci all1house || true
