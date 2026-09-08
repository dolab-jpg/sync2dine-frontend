#!/bin/bash
set -euo pipefail
TS=$(date +%Y%m%d-%H%M%S)
BASE=/var/www/vhosts/sync2gear.io
HTTPS=$BASE/https
HTTPDOCS=$BASE/httpdocs
WPBAK=$BASE/wordpress-backups/wp-before-sync-flow-gear-20260529-110025/full-https-copy
SPABAK=$BASE/wordpress-backups/spa-before-wp-restore-$TS
APPBAK=$BASE/wordpress-backups/app-httpdocs-before-offline-$TS

echo "=== 1. Backup current apex SPA (https/) ==="
mkdir -p "$SPABAK"
rsync -a --delete "$HTTPS/" "$SPABAK/"
echo "SPA backed up to $SPABAK"
du -sh "$SPABAK"

echo "=== 2. Backup current app httpdocs ==="
mkdir -p "$APPBAK"
rsync -a "$HTTPDOCS/" "$APPBAK/"
echo "App httpdocs backed up to $APPBAK"

if [ ! -f "$WPBAK/wp-config.php" ]; then
  echo "ERROR: WordPress backup missing at $WPBAK"
  exit 1
fi

echo "=== 3. Restore WordPress into https/ ==="
# Keep a safety copy of current index before wipe
find "$HTTPS" -mindepth 1 -maxdepth 1 ! -name '.well-known' -exec rm -rf {} +
rsync -a "$WPBAK/" "$HTTPS/"
# Ensure .well-known preserved if backup lacked it
mkdir -p "$HTTPS/.well-known"
chown -R asad090:psacln "$HTTPS"
# Fix perms for web
find "$HTTPS" -type d -exec chmod 755 {} \;
find "$HTTPS" -type f -exec chmod 644 {} \;
chmod 600 "$HTTPS/wp-config.php" 2>/dev/null || true
echo "WordPress restored. index:"
head -5 "$HTTPS/index.php"
ls "$HTTPS" | head -20

echo "=== 4. Take app.sync2gear.io offline (301 to apex) ==="
# Replace httpdocs with redirect-only site
mkdir -p "$HTTPDOCS-offline-staging-$TS"
cat > "$HTTPDOCS-offline-staging-$TS/.htaccess" <<'HTA'
# app.sync2gear.io offline � redirect all traffic to marketing apex
RewriteEngine On
RewriteRule ^(.*)$ https://sync2gear.io/$1 [R=301,L]
HTA
cat > "$HTTPDOCS-offline-staging-$TS/index.html" <<'HTML'
<!DOCTYPE html>
<html lang="en-GB">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="refresh" content="0;url=https://sync2gear.io/" />
  <title>Moved</title>
  <link rel="canonical" href="https://sync2gear.io/" />
</head>
<body>
  <p>This subdomain is not in use. <a href="https://sync2gear.io/">Continue to sync2gear.io</a>.</p>
</body>
</html>
HTML

# Clear httpdocs except backups/hidden we want to keep outside
# Move current aside then install offline
find "$HTTPDOCS" -mindepth 1 -maxdepth 1 ! -name '.bak-mission-20260723145915' ! -name '.well-known' -exec rm -rf {} +
cp -a "$HTTPDOCS-offline-staging-$TS/." "$HTTPDOCS/"
rm -rf "$HTTPDOCS-offline-staging-$TS"
chown -R asad090:psacln "$HTTPDOCS"
chmod 644 "$HTTPDOCS/index.html" "$HTTPDOCS/.htaccess"
echo "App offline redirect installed:"
ls -la "$HTTPDOCS"

echo "=== 5. Soft cache / verify ==="
# Do not reload nginx unless needed � Apache .htaccess handles redirect
curl -sSI --max-time 15 https://app.sync2gear.io/ | tr -d '\r' | head -15
echo "---"
curl -sSI --max-time 15 https://sync2gear.io/ | tr -d '\r' | head -15
echo "---"
curl -sS --max-time 15 https://sync2gear.io/ | head -c 400
echo ""
echo "DONE backups: SPA=$SPABAK APP=$APPBAK"
