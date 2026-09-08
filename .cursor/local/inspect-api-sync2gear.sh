#!/bin/bash
set -uo pipefail
echo "======== api.sync2gear.io nginx ========"
cat /etc/nginx/plesk.conf.d/vhosts/api.sync2gear.io.conf 2>/dev/null | head -120 || \
  ls /etc/nginx/plesk.conf.d/vhosts/ | grep -i api
grep -RIl 'api.sync2gear' /etc/nginx /var/www/vhosts/system 2>/dev/null | head -20

echo ""
echo "======== follow api.sync2gear.io ========"
curl -sSI --max-time 15 https://api.sync2gear.io/ | tr -d '\r' | head -30
curl -sSI --max-time 15 https://api.sync2gear.io/sign-in/ | tr -d '\r' | head -30
curl -sS --max-time 15 https://api.sync2gear.io/sign-in/ | head -40
curl -sSI --max-time 15 https://api.sync2gear.io/api/v1/ | tr -d '\r' | head -20
curl -sS --max-time 15 https://api.sync2gear.io/api/v1/ | head -40
curl -sSI --max-time 15 https://api.sync2gear.io/admin/ | tr -d '\r' | head -20

echo ""
echo "======== find django for api host ========"
# plesk domain
plesk bin subdomain --info api -domain sync2gear.io 2>/dev/null | head -40 || \
plesk bin site --info api.sync2gear.io 2>/dev/null | head -40 || true

# find docroot
for conf in /var/www/vhosts/system/api.sync2gear.io/conf/nginx.conf /var/www/vhosts/system/api.sync2gear.io/conf/httpd.conf; do
  [ -f "$conf" ] || continue
  echo "--- $conf ---"
  grep -nE 'root |DocumentRoot|proxy_pass|unix:' "$conf" | head -40
done

# search for sync2gear django project
find /var/www /home /opt /srv /root -name 'settings.py' 2>/dev/null | while read -r f; do
  if grep -qiE 'sync2gear|SYNC2GEAR' "$f" 2>/dev/null; then
    echo "SETTINGS $f"
  fi
done | head -30

find /var/www /home /opt -name 'wsgi.py' 2>/dev/null | head -30
ss -lntp 2>/dev/null | grep -E ':8000|:8001|:8080|gunicorn|uvicorn|daphne' || true
ps aux | grep -iE 'gunicorn|uwsgi|daphne|manage.py|celery' | grep -v grep | head -20

echo DONE_API
