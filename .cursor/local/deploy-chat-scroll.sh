#!/bin/bash
cp /tmp/sally-widget.js /var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js
cp /tmp/sync2dine-dual-product.php /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush >/dev/null
W=/var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js
echo "scrollToBottom:" $(grep -c scrollToBottom "$W")
echo "msgs_overflow:" $(grep -c 'overflow-y:auto' "$W")
curl -sL 'https://sync2dine.io/' | grep -o 'sally-widget.js?v=[^"]*' | head -1
