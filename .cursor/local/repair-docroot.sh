#!/bin/bash
set -e
D=/var/www/vhosts/sync2dine.io
DOCROOT=$D/app.sync2dine.io
APPDIR=$D/sync2dine-app
OWNER=sync2dine.io_asad090
echo "DOCROOT listing (first 30):"
ls -la "$DOCROOT" | head -30
echo "has index? $(test -f $DOCROOT/index.html && echo yes || echo NO)"
echo "has sys? $(test -d $DOCROOT/sys && echo BAD_SYS || echo ok)"
# If corrupted, wipe and restore from tarball only
if [ -d "$DOCROOT/sys" ] || [ ! -f "$DOCROOT/index.html" ]; then
  echo "REPAIRING docroot"
  rm -rf "${DOCROOT:?}"/*
  tmpdir=$(mktemp -d)
  tar -xzf /tmp/sync2dine-deploy.tar.gz -C "$tmpdir"
  if [ -f "$tmpdir/dist/index.html" ]; then
    mkdir -p "$APPDIR/dist"
    rm -rf "$APPDIR/dist"
    mkdir -p "$APPDIR/dist"
    cp -a "$tmpdir/dist/." "$APPDIR/dist/"
    cp -a "$APPDIR/dist/." "$DOCROOT/"
  elif [ -f "$tmpdir/index.html" ]; then
    mkdir -p "$APPDIR/dist"
    rm -rf "$APPDIR/dist"
    mkdir -p "$APPDIR/dist"
    cp -a "$tmpdir/." "$APPDIR/dist/"
    cp -a "$APPDIR/dist/." "$DOCROOT/"
  else
    echo "FATAL: bad tarball"; ls -la "$tmpdir"; exit 1
  fi
  rm -rf "$tmpdir"
  cp /tmp/app-htaccess "$DOCROOT/.htaccess" 2>/dev/null || true
  chown -R "$OWNER:psaserv" "$DOCROOT"
  find "$DOCROOT" -type d -exec chmod 755 {} +
  find "$DOCROOT" -type f -exec chmod 644 {} +
  restorecon -Rv "$DOCROOT" >/dev/null || true
fi
ls -la "$DOCROOT" | head -20
curl -s -o /dev/null -w "app %{http_code}\n" https://app.sync2dine.io/
curl -s -o /dev/null -w "widget %{http_code}\n" https://app.sync2dine.io/sally-widget.js
curl -s https://app.sync2dine.io/index.html | head -15
