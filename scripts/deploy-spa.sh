#!/bin/bash
# Publish TradePro SPA to app.b-diddies.com only.
# Does NOT touch marketing httpdocs or rewrite tradepro-api (lives in tradepro-backend).
set -euo pipefail

D=/var/www/vhosts/b-diddies.com
APPDIR=$D/tradepro-app
DOCROOT=$D/app.b-diddies.com
MARKETING=$D/httpdocs
TARBALL=${TARBALL:-/tmp/tradepro-deploy.tar.gz}

if [ "$DOCROOT" = "$MARKETING" ] || [ "$DOCROOT" = "$D/httpdocs" ]; then
  echo "ERROR: DOCROOT must not be marketing httpdocs — aborting"
  exit 1
fi
case "$DOCROOT" in
  */httpdocs|*/httpdocs/)
    echo "ERROR: DOCROOT resolves to an httpdocs path ($DOCROOT) — aborting"
    exit 1
    ;;
esac

echo "== Extract staging tree =="
mkdir -p "$APPDIR"
tar -xzf "$TARBALL" -C "$APPDIR"

echo "== Publish SPA to app docroot =="
if [ ! -f "$APPDIR/dist/index.html" ]; then
  echo "ERROR: $APPDIR/dist/index.html missing after extract — aborting before wiping docroot"
  exit 1
fi
rm -rf "${DOCROOT:?}"/*
cp -a "$APPDIR/dist/." "$DOCROOT/"
if [ ! -f "$DOCROOT/index.html" ]; then
  echo "ERROR: docroot publish failed (no index.html)"
  exit 1
fi

cat > "$DOCROOT/.htaccess" <<'EOF'
RewriteEngine On
RewriteBase /
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteCond %{REQUEST_URI} !^/api/
RewriteCond %{REQUEST_URI} !^/webhooks/
RewriteRule . /index.html [L]

# Never cache the HTML shell so new deploys are picked up immediately;
# hashed assets in /assets are safe to cache forever.
<IfModule mod_headers.c>
  <Files "index.html">
    Header set Cache-Control "no-cache"
  </Files>
  <FilesMatch "\.(js|css|woff2)$">
    Header set Cache-Control "public, max-age=31536000"
  </FilesMatch>
</IfModule>
EOF

chown -R bdiddies:psaserv "$DOCROOT"
restorecon -Rv "$DOCROOT" >/dev/null 2>&1 || true

echo "== Local smoke test =="
HEADERS=$(curl -sI --max-time 10 -H "Host: app.b-diddies.com" http://127.0.0.1/ | head -5 || true)
echo "$HEADERS"
TITLE=$(curl -s --max-time 10 -H "Host: app.b-diddies.com" http://127.0.0.1/ | grep -oiE '<title>[^<]+</title>' | head -1 || true)
echo "Title: ${TITLE:-unknown}"
if ! echo "$TITLE" | grep -qiE 'Builder Diddies|TradePro|Estimation'; then
  echo "WARN: unexpected HTML title — verify this is the SPA docroot, not marketing"
fi
echo "DONE (SPA only — tradepro-api and httpdocs untouched)"
