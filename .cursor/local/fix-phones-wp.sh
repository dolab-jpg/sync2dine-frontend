#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/httpdocs
WP="sudo -u sync2dine.io_asad090 /usr/local/bin/wp"

echo "=== before live counts ==="
curl -sS https://sync2dine.io/contact/ | grep -oE 'tel:\+[0-9]+' | sort | uniq -c || true

echo "=== DB hits ==="
$WP db query "SELECT COUNT(*) AS posts FROM lYVnVu_posts WHERE post_content LIKE '%3475%';"
$WP db query "SELECT COUNT(*) AS meta FROM lYVnVu_postmeta WHERE meta_value LIKE '%3475%';"
$WP db query "SELECT COUNT(*) AS opts FROM lYVnVu_options WHERE option_value LIKE '%3475%';"

# Elementor often stores as unicode-escaped or without spaces
$WP search-replace '442034750458' '442037453233' --all-tables --precise --recurse-objects --report-changed-only
$WP search-replace '020 3475 0458' '020 3745 3233' --all-tables --precise --recurse-objects --report-changed-only
$WP search-replace '02034750458' '02037453233' --all-tables --precise --recurse-objects --report-changed-only
$WP search-replace '+44-20-3475-0458' '+44-20-3745-3233' --all-tables --precise --recurse-objects --report-changed-only
$WP search-replace 'tel:+442034750458' 'tel:+442037453233' --all-tables --precise --recurse-objects --report-changed-only
# HTML entity / encoded forms
$WP search-replace 'tel%3A%2B442034750458' 'tel%3A%2B442037453233' --all-tables --precise --recurse-objects --report-changed-only || true
$WP search-replace '\u002b442034750458' '\u002b442037453233' --all-tables --precise --recurse-objects --report-changed-only || true

# Typos
$WP search-replace 'Restaurents' 'Restaurants' --all-tables --precise --recurse-objects --report-changed-only || true
$WP search-replace "Sync2DIne's" "Sync2Dine's" --all-tables --precise --recurse-objects --report-changed-only || true
$WP search-replace "Spa's & Wellness" 'Spas & Wellness' --all-tables --precise --recurse-objects --report-changed-only || true
$WP search-replace 'TRANSFORM YOUR AMBIANCE' 'TRANSFORM YOUR AMBIENCE' --all-tables --precise --recurse-objects --report-changed-only || true
$WP search-replace 'Sync2Dine � 2025' 'Sync2Dine � 2026' --all-tables --precise --recurse-objects --report-changed-only || true

# Flush caches safely
$WP cache flush || true
$WP litespeed-purge all || true
$WP elementor flush-css || true

echo "=== after live (may need cache) ==="
sleep 1
curl -sS -H 'Cache-Control: no-cache' "https://sync2dine.io/contact/?nocache=$RANDOM" | grep -oE 'tel:\+[0-9]+' | sort | uniq -c || true
curl -sS -H 'Cache-Control: no-cache' "https://sync2dine.io/?nocache=$RANDOM" | grep -c 'Restaurents' || true
curl -sS -H 'Cache-Control: no-cache' "https://sync2dine.io/?nocache=$RANDOM" | grep -c 'Restaurants' || true
echo DONE
