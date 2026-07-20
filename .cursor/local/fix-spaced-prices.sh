#!/bin/bash
set -e
WP=/var/www/vhosts/sync2dine.io/httpdocs
run() {
  sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" search-replace "$1" "$2" --all-tables --precise 2>&1 | tail -3
  echo "DONE: $1 -> $2"
}
# Elementor splits currency with a space: "£ 399"
run '£ 399' '£139'
run '£ 799' '£208'
run '£ 60' '£139'
run '£ 300' '£0 setup'
run '/Per Month' '/week launch'
run 'Per Month' 'week launch'
run 'Then Just £60 Per Week' 'Atmosphere from £139/week launch'
run 'One-Time Professional Setup: £300, Then Just £60 Per Week' 'Atmosphere from £139/week launch (fare s2d-fare-2026-07-19)'
# Also without space variants
run '£399' '£139'
run '£799' '£208'
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" cache flush
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" eval 'if (class_exists("LiteSpeed\Purge")) { \LiteSpeed\Purge::purge_all(); echo "lsc purged\n"; }'
sudo rm -rf "$WP/wp-content/cache/litespeed" 2>/dev/null || true
# Verify DB still has spaced prices?
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path="$WP" db query "SELECT COUNT(*) AS c FROM lYVnVu_postmeta WHERE meta_value LIKE '%£ 399%' OR meta_value LIKE '%£ 799%';" 2>/dev/null || true
curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?fix=$(date +%s)" | grep -oE '£ ?399|£ ?799|£139|£208|Basic Plan|Atmosphere' | sort | uniq -c | head -30
