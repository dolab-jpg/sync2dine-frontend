#!/bin/bash
set -euo pipefail
php /tmp/fix-footer-copyright.php
cd /var/www/vhosts/sync2dine.io/httpdocs
/usr/local/bin/wp --allow-root cache flush || true
find wp-content/cache/ls -type f \( -name '*.html' -o -name '*.html.gz' \) -delete 2>/dev/null || true
sleep 1
HTML=$(curl -sS -H 'Cache-Control: no-cache' -A 's2d-verify' "https://sync2dine.io/?nocache=$(date +%s)")
echo "=== schema ==="
echo "$HTML" | grep -oE 'telephone":"[^"]+"' | sort -u
echo "$HTML" | grep -oE '"email":"[^"]+"' | sort -u
echo "=== footer ==="
echo "$HTML" | grep -oE 'Sync2Dine .{0,60}[Rr]eserved\.?' | head -5
echo "old_phone=$(echo "$HTML" | grep -c '3475-0458' || true)"
echo "all1house=$(echo "$HTML" | grep -c 'all1house' || true)"
echo DONE
