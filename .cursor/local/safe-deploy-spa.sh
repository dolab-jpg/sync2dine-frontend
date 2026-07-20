#!/bin/bash
set -euo pipefail
D=/var/www/vhosts/sync2dine.io
DOCROOT=$D/app.sync2dine.io
APPDIR=$D/sync2dine-app
OWNER=sync2dine.io_asad090
MARKETING=$D/httpdocs

if [ "$DOCROOT" = "$MARKETING" ]; then
  echo "ERROR: refuse marketing httpdocs"
  exit 1
fi

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT
tar -xzf /tmp/sync2dine-deploy.tar.gz -C "$tmpdir"
rm -rf "${APPDIR:?}/dist"
mkdir -p "$APPDIR/dist"
if [ -f "$tmpdir/dist/index.html" ]; then
  cp -a "$tmpdir/dist/." "$APPDIR/dist/"
elif [ -f "$tmpdir/index.html" ]; then
  cp -a "$tmpdir/." "$APPDIR/dist/"
else
  echo "ERROR: tarball missing index.html"
  exit 1
fi

if [ ! -f "$APPDIR/dist/index.html" ]; then
  echo "ERROR: staging dist incomplete"
  exit 1
fi

rm -rf "${DOCROOT:?}"/*
cp -a "$APPDIR/dist/." "$DOCROOT/"
if [ -f /tmp/app-htaccess ]; then
  cp /tmp/app-htaccess "$DOCROOT/.htaccess"
fi
if [ -f /tmp/sally-widget.js ]; then
  cp /tmp/sally-widget.js "$DOCROOT/sally-widget.js"
fi

chown -R "$OWNER:psaserv" "$DOCROOT"
find "$DOCROOT" -type d -exec chmod 755 {} +
find "$DOCROOT" -type f -exec chmod 644 {} +
restorecon -Rv "$DOCROOT" >/dev/null 2>&1 || true

echo "index:"
head -12 "$DOCROOT/index.html"
echo "docroot entries:"
ls "$DOCROOT"
echo "junk check:"
ls "$DOCROOT" | grep -E '^(bin|lib|usr|var|sys|proc|etc|dev)$' && echo BAD || echo NO_SYSTEM_JUNK
curl -s -o /dev/null -w "app %{http_code}\n" https://app.sync2dine.io/
JS=$(grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' "$DOCROOT/index.html" | head -1)
curl -s -o /dev/null -w "js %{http_code}\n" "https://app.sync2dine.io/$JS"
echo DONE
