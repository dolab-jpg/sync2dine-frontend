#!/bin/bash
HTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?v=$(date +%s)")
echo "$HTML" | tail -c 4000
echo '===='
echo "$HTML" | grep -c 'sally-widget'
echo "$HTML" | grep -c 'sync2dine_print'
# Call the PHP function directly via wp eval on a front request simulation
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs eval 'ob_start(); sync2dine_print_sally_topbar_script(); echo ob_get_clean();'
