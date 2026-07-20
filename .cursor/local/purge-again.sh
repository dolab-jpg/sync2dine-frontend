#!/bin/bash
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs eval 'if (class_exists("LiteSpeed\Purge")) { \LiteSpeed\Purge::purge_all(); echo "lsc purged\n"; } else { echo "no lsc class\n"; }'
sudo rm -rf /var/www/vhosts/sync2dine.io/httpdocs/wp-content/cache/litespeed 2>/dev/null || true
sudo -u sync2dine.io_asad090 /usr/local/bin/wp --path=/var/www/vhosts/sync2dine.io/httpdocs cache flush
# Bypass cache with cookie / query / headers that guests get
for i in 1 2 3; do
  HTML=$(curl -sL -H 'Cache-Control: no-cache' -H 'Pragma: no-cache' -A "VerifyBot/$i" "https://sync2dine.io/?purge=$RANDOM$i")
  c=$(echo "$HTML" | grep -c sally-widget || true)
  echo "try$i count=$c bytes=${#HTML}"
  if [ "$c" -gt 0 ]; then
    echo "$HTML" | grep -o '<script[^>]*sally-widget[^>]*>' | head -2
    break
  fi
  sleep 1
done
