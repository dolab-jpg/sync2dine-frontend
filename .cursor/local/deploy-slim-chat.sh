#!/bin/bash
set -e
cp /tmp/sally-widget.js /var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js
cp /tmp/sync2dine-dual-product.php /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
chown sync2dine.io_asad090:psaserv /var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush
echo "composer:" $(grep -c sally-chat__composer /var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js)
echo "chips:" $(grep -c 'data-q' /var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js)
echo "topbar-brand:" $(grep -c sally-topbar__brand /var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js)
curl -sL 'https://sync2dine.io/?v=e' | grep -o 'sally-widget.js?v=[^"]*' | head -1
