#!/bin/bash
set -euo pipefail

echo "======== A. Apache DocumentRoot + Rewrite for app.sync2gear.io ========"
sed -n '1,260p' /var/www/vhosts/system/app.sync2gear.io/conf/httpd.conf

echo ""
echo "======== B. .htaccess in httpdocs ========"
ls -la /var/www/vhosts/sync2gear.io/httpdocs/.htaccess /var/www/vhosts/sync2gear.io/https/.htaccess 2>/dev/null || true
echo "--- httpdocs .htaccess ---"
cat /var/www/vhosts/sync2gear.io/httpdocs/.htaccess 2>/dev/null || echo "(none)"
echo "--- https .htaccess ---"
cat /var/www/vhosts/sync2gear.io/https/.htaccess 2>/dev/null || echo "(none)"

echo ""
echo "======== C. Apex nginx base44_upstream + location blocks ========"
grep -nE 'base44|location |try_files|proxy_pass|root ' /var/www/vhosts/system/sync2gear.io/conf/nginx.conf | head -100
# show full custom snippets if any
ls -la /var/www/vhosts/system/sync2gear.io/conf/ /var/www/vhosts/system/app.sync2gear.io/conf/ 2>/dev/null
echo "--- vhost_nginx custom ---"
cat /var/www/vhosts/system/sync2gear.io/conf/vhost_nginx.conf 2>/dev/null || true
cat /var/www/vhosts/system/app.sync2gear.io/conf/vhost_nginx.conf 2>/dev/null || true
cat /var/www/vhosts/system/sync2gear.io/conf/vhost_nginx.conf_custom 2>/dev/null || true
cat /var/www/vhosts/system/app.sync2gear.io/conf/vhost_nginx.conf_custom 2>/dev/null || true

echo ""
echo "======== D. HTTP behaviour: /login vs /pricing vs missing file ========"
for path in / /login /login/ /pricing /pricing/ /does-not-exist-xyz /dashboard /app; do
  code=$(curl -sS -o /tmp/s2g-body.txt -w "%{http_code}" --max-time 15 "https://app.sync2gear.io$path")
  size=$(wc -c </tmp/s2g-body.txt)
  title=$(grep -oE '<title>[^<]+</title>' /tmp/s2g-body.txt | head -1)
  has404=$(grep -c 'Page Not Found\|404' /tmp/s2g-body.txt || true)
  echo "PATH=$path HTTP=$code BYTES=$size TITLE=$title HAS404TEXT=$has404"
done

echo ""
echo "======== E. Compare apex vs app response for /login ========"
for host in app.sync2gear.io sync2gear.io; do
  code=$(curl -sS -o /tmp/s2g-body.txt -w "%{http_code}" --max-time 15 "https://$host/login")
  size=$(wc -c </tmp/s2g-body.txt)
  title=$(grep -oE '<title>[^<]+</title>' /tmp/s2g-body.txt | head -1)
  echo "HOST=$host /login HTTP=$code BYTES=$size TITLE=$title"
  head -c 200 /tmp/s2g-body.txt; echo
done

echo ""
echo "======== F. bak-mission from today ========"
ls -la /var/www/vhosts/sync2gear.io/httpdocs/.bak-mission-20260723145915 2>/dev/null | head -20
if [ -d /var/www/vhosts/sync2gear.io/httpdocs/.bak-mission-20260723145915 ]; then
  ls -la /var/www/vhosts/sync2gear.io/httpdocs/.bak-mission-20260723145915 | head -30
  head -30 /var/www/vhosts/sync2gear.io/httpdocs/.bak-mission-20260723145915/index.html 2>/dev/null || true
  wc -c /var/www/vhosts/sync2gear.io/httpdocs/.bak-mission-20260723145915/index.html 2>/dev/null || true
fi

echo ""
echo "======== G. base44 bak index ========"
head -40 /var/www/vhosts/sync2gear.io/https-base44-bak/index.html
ls -la /var/www/vhosts/sync2gear.io/https-base44-bak/assets | head -20

echo ""
echo "======== H. Flutter anywhere under sync2gear vhost ========"
find /var/www/vhosts/sync2gear.io -name 'flutter.js' -o -name 'main.dart.js' -o -name 'flutter_service_worker.js' 2>/dev/null | head -20
find /var/www/vhosts -maxdepth 4 -name 'main.dart.js' 2>/dev/null | head -20

echo ""
echo "======== I. Cloudflare / cache headers ========"
curl -sSI https://app.sync2gear.io/ | tr -d '\r' | grep -iE 'HTTP/|server:|cf-|x-cache|x-served|via:|age:|x-powered|content-type|location:|strict-transport'

echo ""
echo "======== J. Plesk subdomain www-root ========"
plesk bin subdomain --info app -domain sync2gear.io 2>/dev/null | head -50 || \
plesk bin site --info app.sync2gear.io 2>/dev/null | head -50 || true

echo ""
echo "======== K. index.html script tags + vite markers ========"
grep -nE 'script|vite|react|flutter|base44|module' /var/www/vhosts/sync2gear.io/httpdocs/index.html | head -40

echo ""
echo "======== L. Does SPA router know /login? (string search) ========"
# use python to avoid shell quote hell
python3 - <<'PY'
from pathlib import Path
js = Path('/var/www/vhosts/sync2gear.io/httpdocs/assets/index-1_y1ouK9.js').read_text(errors='ignore')
needles = ['/login', 'Login', 'SignIn', 'sign-in', 'dashboard', 'Page Not Found', 'get-quote', 'Pricing', 'flutter', 'Firebase', 'supabase', 'base44']
for n in needles:
    print(f'{n!r}: count={js.count(n)}')
# extract nearby route path literals that look like app paths
import re
paths = sorted(set(re.findall(r'"/(?:login|dashboard|admin|app|home|pricing|solutions|about|contact|get-quote|privacy|terms|cookies)[^"]*"', js)))
print('path literals:', paths[:50])
# 404 message
for m in re.finditer(r'.{0,40}Page Not Found.{0,40}', js):
    print('404 ctx:', m.group(0)[:120])
    break
PY

echo DONE
