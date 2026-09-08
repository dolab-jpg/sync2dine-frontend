#!/bin/bash
set -euo pipefail
python3 /tmp/fix-hero-selector.py
chown sync2dine.io_asad090:psacln /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php
cd /var/www/vhosts/sync2dine.io/httpdocs
sudo -u sync2dine.io_asad090 /usr/local/bin/wp litespeed-purge all || true

echo "==== s2g index assets ===="
grep -E 'script src|stylesheet' /var/www/vhosts/sync2gear.io/httpdocs/index.html || true

echo "==== app.sync2gear nginx ===="
grep -n 'root\|proxy\|base44\|location /' /var/www/vhosts/system/app.sync2gear.io/conf/nginx.conf | head -40 || true

echo "==== dual-product hero css ===="
grep -n '3ec2799\|undefined-3ec2799\|data-mode' /var/www/vhosts/sync2dine.io/httpdocs/wp-content/themes/hello-elementor-child/sync2dine-dual-product.php | head -20

echo "==== live verify ===="
curl -sS -o /dev/null -w "s2g:%{http_code} %{size_download}\n" https://app.sync2gear.io/
curl -sS -o /dev/null -w "s2g_login:%{http_code} %{size_download}\n" https://app.sync2gear.io/login
curl -sS -o /dev/null -w "s2d:%{http_code}\n" "https://sync2dine.io/?nocache=$RANDOM"
curl -sS "https://sync2dine.io/contact/?nocache=$RANDOM" | grep -oE 'tel:\+[0-9]+' | sort | uniq -c
curl -sS "https://sync2dine.io/?nocache=$RANDOM" | grep -o 'TRANSFORM YOUR AMBI[A-Z]*' | head -3
curl -sS "https://sync2dine.io/?nocache=$RANDOM" | grep -c 'Restaurents' || true
curl -sS "https://sync2dine.io/?nocache=$RANDOM" | grep -o 'Sync2Dine � 20[0-9][0-9]' | head -3
echo DONE
