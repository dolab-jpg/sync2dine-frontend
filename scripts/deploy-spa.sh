#!/bin/bash
# Publish Sync2Dine SPA to app.sync2dine.io only.
# Does NOT touch marketing httpdocs.
set -euo pipefail

D=/var/www/vhosts/sync2dine.io
APPDIR=$D/sync2dine-app
DOCROOT=$D/app.sync2dine.io
MARKETING=$D/httpdocs
TARBALL=${TARBALL:-/tmp/sync2dine-deploy.tar.gz}
OWNER=${DOCROOT_OWNER:-sync2dine.io_asad090}

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
rm -rf "${APPDIR:?}/dist"
# Accept either `tar czf … dist` (preferred) or flat `tar czf … -C dist .`
tmpdir=$(mktemp -d)
tar -xzf "$TARBALL" -C "$tmpdir"
if [ -f "$tmpdir/dist/index.html" ]; then
  mkdir -p "$APPDIR/dist"
  cp -a "$tmpdir/dist/." "$APPDIR/dist/"
elif [ -f "$tmpdir/index.html" ]; then
  mkdir -p "$APPDIR/dist"
  cp -a "$tmpdir/." "$APPDIR/dist/"
else
  echo "ERROR: tarball has neither dist/index.html nor index.html"
  rm -rf "$tmpdir"
  exit 1
fi
rm -rf "$tmpdir"

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

# nginx (psaserv) must be able to traverse dirs and read files.
# A mode-700 assets/ directory returns 403 and a blank page.
chown -R "$OWNER:psaserv" "$DOCROOT"
find "$DOCROOT" -type d -exec chmod 755 {} +
find "$DOCROOT" -type f -exec chmod 644 {} +
restorecon -Rv "$DOCROOT" >/dev/null 2>&1 || true

echo "== Local smoke test =="
# Prefer public HTTPS — Host-header curl to 127.0.0.1 can fail on this Plesk box.
SMOKE_BASE="${SMOKE_BASE_URL:-https://app.sync2dine.io}"
HEADERS=$(curl -sI --max-time 15 "$SMOKE_BASE/" | head -5 || true)
echo "$HEADERS"
TITLE=$(curl -s --max-time 15 "$SMOKE_BASE/" | grep -oiE '<title>[^<]+</title>' | head -1 || true)
echo "Title: ${TITLE:-unknown}"
ASSET=$(curl -sI --max-time 15 "$SMOKE_BASE/assets/" | head -1 || true)
echo "Assets probe: $ASSET"
JS_BASE=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$DOCROOT/index.html" | head -1 | xargs -n1 basename 2>/dev/null || true)
if [ -z "$JS_BASE" ]; then
  JS_BASE=$(find "$DOCROOT/assets" -name 'index-*.js' -printf '%f\n' 2>/dev/null | head -1 || true)
fi
if [ -n "$JS_BASE" ]; then
  CODE=$(curl -sI --max-time 15 "$SMOKE_BASE/assets/$JS_BASE" | head -1 || true)
  echo "JS probe ($JS_BASE): $CODE"
  if ! echo "$CODE" | grep -q '200'; then
    echo "ERROR: JS asset not publicly readable — check directory modes (need 755 on assets/)"
    exit 1
  fi
fi
if ! echo "$TITLE" | grep -qiE 'Sync2Dine|TradePro|AI Phone'; then
  echo "WARN: unexpected HTML title — verify this is the SPA docroot, not marketing"
fi
echo "DONE (SPA only — httpdocs untouched)"
