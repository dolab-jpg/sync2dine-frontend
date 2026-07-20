#!/bin/bash
# Debug Sally enqueue + clean remaining all1house
cd /var/www/vhosts/sync2dine.io/httpdocs
sudo -u sync2dine.io_asad090 /usr/local/bin/wp eval '
$scripts = wp_scripts();
do_action("wp_enqueue_scripts");
var_export(isset($scripts->registered["sync2dine-sally-widget"]));
echo "\n";
var_export(in_array("sync2dine-sally-widget", $scripts->queue, true));
echo "\n";
'
echo '--- theme file head ---'
head -5 wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
grep -n sally wp-content/themes/hello-elementor-child/sync2dine-dual-product.php | head
echo '--- search all1house remaining ---'
sudo -u sync2dine.io_asad090 /usr/local/bin/wp search-replace 'all1house.com' 'sync2dine.io' --all-tables --precise 2>&1 | tail -5
sudo -u sync2dine.io_asad090 /usr/local/bin/wp cache flush
curl -sL https://sync2dine.io/ | tr '"' '\n' | grep -iE 'sally|topbar|app.sync2dine' | head -20
