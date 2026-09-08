#!/bin/bash
set -euo pipefail

echo "======== 1. NGINX app.sync2gear.io ========"
cat /etc/nginx/plesk.conf.d/vhosts/app.sync2gear.io.conf

echo ""
echo "======== 2. NGINX sync2gear.io (apex) ========"
# show only server_name + root + alias lines to keep readable
grep -nE 'server_name|root |alias |try_files|proxy_pass|listen ' /etc/nginx/plesk.conf.d/vhosts/sync2gear.io.conf | head -80

echo ""
echo "======== 3. SYSTEM conf DocumentRoot ========"
echo "--- app.sync2gear.io nginx.conf ---"
grep -nE 'server_name|root |alias |try_files|DocumentRoot|proxy_pass' /var/www/vhosts/system/app.sync2gear.io/conf/nginx.conf /var/www/vhosts/system/app.sync2gear.io/conf/httpd.conf 2>/dev/null | head -80
echo "--- sync2gear.io nginx.conf ---"
grep -nE 'server_name|root |alias |try_files|DocumentRoot|proxy_pass' /var/www/vhosts/system/sync2gear.io/conf/nginx.conf /var/www/vhosts/system/sync2gear.io/conf/httpd.conf 2>/dev/null | head -80

echo ""
echo "======== 4. Plesk domain docroots (plesk bin) ========"
if command -v plesk >/dev/null 2>&1; then
  plesk bin subdomain --info app.sync2gear.io 2>/dev/null | head -40 || true
  plesk bin domain --info sync2gear.io 2>/dev/null | grep -iE 'Document root|WWW root|Name|Status|IP' | head -30 || true
fi

echo ""
echo "======== 5. DOCROOT CONTENTS ========"
for d in \
  /var/www/vhosts/sync2gear.io/httpdocs \
  /var/www/vhosts/sync2gear.io/https \
  /var/www/vhosts/system/app.sync2gear.io \
  /var/www/vhosts/app.sync2gear.io
do
  echo "--- $d ---"
  if [ -d "$d" ]; then
    ls -la "$d" | head -35
  else
    echo "(missing)"
  fi
done

# find actual DocumentRoot from live nginx -T
echo ""
echo "======== 6. nginx -T filtered for app.sync2gear ========"
nginx -T 2>/dev/null | awk '
  /server_name.*app\.sync2gear\.io/ {inblock=1}
  inblock {print}
  inblock && /^}/ {inblock=0; print "----"}
' | head -120

echo ""
echo "======== 7. Live response headers (via local curl to host) ========"
curl -sSI -H 'Host: app.sync2gear.io' https://127.0.0.1/ --resolve app.sync2gear.io:443:127.0.0.1 2>/dev/null | head -40 || \
curl -sSI https://app.sync2gear.io/ | head -40

echo ""
echo "======== 8. index.html identity ========"
for f in \
  /var/www/vhosts/sync2gear.io/httpdocs/index.html \
  /var/www/vhosts/sync2gear.io/https/index.html
do
  echo "FILE $f"
  ls -la "$f" 2>/dev/null || echo missing
  md5sum "$f" 2>/dev/null || true
  head -n 40 "$f" 2>/dev/null || true
  echo "---"
done

echo ""
echo "======== 9. Flutter markers in docroot ========"
for d in /var/www/vhosts/sync2gear.io/httpdocs /var/www/vhosts/sync2gear.io/https; do
  echo "DIR $d"
  ls "$d"/flutter* "$d"/main.dart.js "$d"/flutter_service_worker.js "$d"/flutter_bootstrap.js "$d"/canvaskit 2>/dev/null || true
  find "$d" -maxdepth 3 \( -name 'flutter.js' -o -name 'main.dart.js' -o -name 'flutter_service_worker.js' -o -name 'manifest.json' \) 2>/dev/null | head -20
  grep -l 'flutter' "$d"/index.html 2>/dev/null || echo "index.html has no 'flutter' string"
done

echo ""
echo "======== 10. Git in docroots ========"
for d in /var/www/vhosts/sync2gear.io/httpdocs /var/www/vhosts/sync2gear.io/https; do
  echo "DIR $d"
  if [ -d "$d/.git" ]; then
    git -C "$d" rev-parse HEAD
    git -C "$d" log -1 --oneline
    git -C "$d" remote -v
  else
    echo "no .git"
  fi
done

echo ""
echo "======== 11. Backup dirs that look like app/flutter/base44 ========"
ls -la /var/www/vhosts/sync2gear.io/https-base44-bak 2>/dev/null | head -30
find /var/www/vhosts/sync2gear.io -maxdepth 3 -iname '*flutter*' -o -iname '*base44*' 2>/dev/null | head -40
find /var/www/vhosts/sync2gear.io -maxdepth 2 -type d 2>/dev/null

echo ""
echo "======== 12. Compare httpdocs vs https asset names ========"
ls /var/www/vhosts/sync2gear.io/httpdocs/assets 2>/dev/null | head -20
ls /var/www/vhosts/sync2gear.io/https/assets 2>/dev/null | head -20
diff -q /var/www/vhosts/sync2gear.io/httpdocs/index.html /var/www/vhosts/sync2gear.io/https/index.html 2>/dev/null || true
md5sum /var/www/vhosts/sync2gear.io/httpdocs/assets/index-*.js 2>/dev/null | head -10
md5sum /var/www/vhosts/sync2gear.io/https/assets/index-*.js 2>/dev/null | head -10

echo ""
echo "======== 13. try_files / SPA rewrite in app conf ========"
grep -nE 'try_files|error_page|rewrite|location' /var/www/vhosts/system/app.sync2gear.io/conf/nginx.conf 2>/dev/null | head -60
grep -nE 'FallbackResource|RewriteRule|DirectoryIndex' /var/www/vhosts/system/app.sync2gear.io/conf/httpd.conf 2>/dev/null | head -40

echo DONE
