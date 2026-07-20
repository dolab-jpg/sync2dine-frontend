#!/bin/bash
set -eu
echo '=== SALLY CHAT ==='
curl -sS --max-time 90 -X POST https://app.sync2dine.io/api/sally/web \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://sync2dine.io' \
  -d '{"sessionId":"web_proof7","text":"How much is Atmosphere?","page":"marketing"}' | head -c 1200
echo
echo '=== CORS ==='
curl -sI -X OPTIONS https://app.sync2dine.io/api/sally/web \
  -H 'Origin: https://sync2dine.io' \
  -H 'Access-Control-Request-Method: POST' | tr -d '\r' | grep -iE 'HTTP/|access-control'
echo '=== HOME ==='
HTML=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/?n=$(date +%s)")
echo "bytes=${#HTML}"
echo "$HTML" | grep -oE 'sally-widget.js\?v=[^" ]+|data-mode="topbar"|s2d-slash|slashed|£232|£139' | sort | uniq -c
echo '=== PRICING ==='
P=$(curl -sL -H 'Cache-Control: no-cache' "https://sync2dine.io/pricing/?n=$(date +%s)")
echo "$P" | grep -oE 's2d-slash-pricing|slashed|£232|£139|£208|£347|sally-widget|data-mode="topbar"' | sort | uniq -c
echo '=== WIDGET ==='
grep -c sally-topbar__composer /var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js
grep -c 'display:none!important' /var/www/vhosts/sync2dine.io/app.sync2dine.io/sally-widget.js || true
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs litespeed-purge all 2>&1 | tail -3 || true
echo DONE
