#!/bin/bash
# Check PHP errors and force inject in head too
php -l /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
php -l /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/functions.php
# Append head inject if missing
if ! grep -q 'sync2dine_print_sally_topbar_script_head' /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php; then
  cat >> /tmp/sally-head-patch.php <<'PHP'

function sync2dine_print_sally_topbar_script_head() {
	if ( is_admin() ) {
		return;
	}
	echo '<script src="https://app.sync2dine.io/sally-widget.js" data-api="https://app.sync2dine.io" data-mode="topbar" data-page="marketing" async></script>' . "\n";
}
add_action( 'wp_head', 'sync2dine_print_sally_topbar_script_head', 99 );
PHP
  sudo tee -a /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php < /tmp/sally-head-patch.php > /dev/null
fi
# Bust elementor / WP cache plugins if present
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush || true
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs elementor flush-css 2>/dev/null || true
sudo rm -rf /var/www/vhosts/sync2dine.io/httpdocs/wp-content/cache/* 2>/dev/null || true
# Find remaining all1house contexts
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs db query "SELECT option_name FROM lYVnVu_options WHERE option_value LIKE '%all1house%' LIMIT 20"
curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?nocache=$(date +%s)" | tr '"' '\n' | grep -iE 'sally-widget|data-mode' | head
echo '--- tail of functions require ---'
tail -5 /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/functions.php
