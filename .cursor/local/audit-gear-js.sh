#!/bin/bash
cd /var/www/vhosts/sync2gear.io/httpdocs
JS=assets/index-1_y1ouK9.js
echo "=== login/password hits ==="
grep -oiE '.{0,30}password.{0,30}|.{0,30}demo@.{0,30}|.{0,30}test@.{0,30}|sk_live|sk_test|AIza' "$JS" | head -20 || echo none
echo "=== has /login string ==="
grep -c '/login' "$JS" || true
echo "=== GBP USD ==="
grep -oE 'GBP|USD|�[0-9]+|\$[0-9]+' "$JS" | sort | uniq -c | sort -rn | head -20
echo "=== emails phones ==="
grep -oE 'info@[a-z0-9.-]+|0333[[:space:]0-9]+' "$JS" | sort -u | head -20
