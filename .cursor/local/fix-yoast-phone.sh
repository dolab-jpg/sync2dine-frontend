#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/httpdocs
WP="sudo -u sync2dine.io_asad090 /usr/local/bin/wp"

# Fix remaining Yoast/org schema phones
$WP search-replace '+44-20-3475-0458' '+44-20-3745-3233' --all-tables --precise --recurse-objects --report-changed-only || true
$WP search-replace 'info@all1house.com' 'info@sync2dine.io' --all-tables --precise --recurse-objects --report-changed-only || true

# Copyright year / wording (handle encoding variants)
$WP search-replace '2025. All Copyrights Reserved' '2026. All rights reserved' --all-tables --precise --recurse-objects --report-changed-only || true
$WP search-replace 'All Copyrights Reserved' 'All rights reserved' --all-tables --precise --recurse-objects --report-changed-only || true

$WP litespeed-purge all || true
$WP cache flush || true

echo "schema phone check:"
curl -sS "https://sync2dine.io/?nocache=$RANDOM" | grep -oE 'telephone.:[^,]+' | head -10
echo "footer check:"
curl -sS "https://sync2dine.io/?nocache=$RANDOM" | grep -oE 'Sync2Dine .{0,5}20[0-9][0-9].{0,40}' | head -5
echo DONE
