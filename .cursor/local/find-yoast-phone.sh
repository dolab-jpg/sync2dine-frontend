#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/httpdocs
WP=/usr/local/bin/wp

echo "=== yoast options ==="
$WP option list --search='*yoast*' --fields=option_name --allow-root 2>/dev/null | head -50

echo "=== wpseo_titles phone-ish ==="
$WP option get wpseo_titles --format=json --allow-root 2>/dev/null | tr ',' '\n' | grep -iE 'phone|telephone|3475|3745|all1house|organization|email' | head -50 || true

echo "=== options containing old phone ==="
$WP db query "SELECT option_name FROM lYVnVu_options WHERE option_value LIKE '%3475%' OR option_value LIKE '%all1house%' LIMIT 40" --allow-root 2>/dev/null || true

echo "=== posts with Copyrights / old schema phone ==="
$WP db query "SELECT ID, post_type, LEFT(post_title,60) AS title FROM lYVnVu_posts WHERE post_content LIKE '%Copyrights Reserved%' OR post_content LIKE '%3475-0458%' OR post_content LIKE '%All Copyrights%' LIMIT 30" --allow-root 2>/dev/null || true

echo "=== postmeta with old phone ==="
$WP db query "SELECT post_id, meta_key FROM lYVnVu_postmeta WHERE meta_value LIKE '%3475-0458%' OR meta_value LIKE '%all1house.com%' LIMIT 40" --allow-root 2>/dev/null || true

echo "=== elementor library footer ==="
$WP post list --post_type=elementor_library --fields=ID,post_title,post_status --allow-root 2>/dev/null | head -40

echo "=== live homepage schema snippet ==="
curl -sS "https://sync2dine.io/" | grep -oE 'telephone":"[^"]+"' | head -5
curl -sS "https://sync2dine.io/" | grep -oE 'email":"[^"]+"' | head -5
curl -sS "https://sync2dine.io/" | grep -oE 'Sync2Dine .{0,40}Copyright' | head -5
