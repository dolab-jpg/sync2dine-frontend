#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/httpdocs
WP=/usr/local/bin/wp

echo "=== all options with old telephone format ==="
$WP db query "SELECT option_name, LEFT(option_value,120) AS v FROM lYVnVu_options WHERE option_value LIKE '%3475-0458%' OR option_value LIKE '%+44-20-3475%' OR option_value LIKE '%all1house%' LIMIT 50" --allow-root

echo "=== all postmeta with old telephone ==="
$WP db query "SELECT post_id, meta_key, LEFT(meta_value,120) AS v FROM lYVnVu_postmeta WHERE meta_value LIKE '%3475-0458%' OR meta_value LIKE '%+44-20-3475%' OR meta_value LIKE '%all1house%' LIMIT 50" --allow-root

echo "=== search serialized/escaped variants ==="
$WP db query "SELECT option_name FROM lYVnVu_options WHERE option_value LIKE '%3475%0458%' OR option_value LIKE '%all1house%' LIMIT 50" --allow-root

echo "=== yoast local / company options ==="
for o in wpseo wpseo_titles wpseo_social wpseo_local wpseo_taxonomy_meta wpseo_premium; do
  echo "-- $o --"
  $WP option get "$o" --format=json --allow-root 2>/dev/null | tr ',' '\n' | grep -iE 'phone|telephone|email|3475|3745|all1|org-|company|schema' | head -30 || true
done

echo "=== footer template 36695 content sample ==="
$WP post get 36695 --field=post_content --allow-root 2>/dev/null | grep -oE '.{0,40}Copyright.{0,40}|.{0,40}2025.{0,40}' | head -20 || true
$WP post meta get 36695 _elementor_data --allow-root 2>/dev/null | grep -oE '.{0,50}Copyright.{0,50}|.{0,50}2025.{0,50}' | head -20 || true

echo "=== homepage schema context ==="
curl -sS "https://sync2dine.io/?nocache=$(date +%s)" | grep -n '3475-0458\|all1house\|Organization\|LocalBusiness' | head -30

echo "=== litespeed / cache dirs ==="
ls -la wp-content/litespeed 2>/dev/null | head -5 || true
ls -d wp-content/cache/* 2>/dev/null | head -10 || true
