#!/bin/bash
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs theme list --status=active
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs option get stylesheet
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs option get template
# Prove hooks run by fetching HTML with timestamp query and searching full script tags
HTML=$(curl -sL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' "https://sync2dine.io/?v=$(date +%s)")
echo "html_bytes=${#HTML}"
echo "$HTML" | grep -o '<script[^>]*sally[^>]*>' | head
echo "$HTML" | grep -o 'app.sync2dine.io[^"'"'"' ]*' | head
echo "$HTML" | grep -o 's2d-legal-footer' | head
echo "$HTML" | grep -o 's2d-dual-band' | head
# Test via wp eval that hooks are registered
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs eval 'global $wp_filter; echo isset($wp_filter["wp_footer"]) ? "footer_hooks\n" : "no_footer\n"; foreach ($wp_filter["wp_footer"]->callbacks as $priority => $cbs) { foreach ($cbs as $cb) { $n = is_string($cb["function"]) ? $cb["function"] : (is_array($cb["function"]) ? "array" : "closure"); if (strpos($n, "sync2dine") !== false || strpos($n, "sally") !== false) echo "$priority $n\n"; } }'
