#!/bin/bash
# LEGACY / FULL deploy — do not use for routine SPA updates.
# Rewrites tradepro-api WorkingDirectory to tradepro-app (breaks production API on tradepro-backend).
# For SPA-only publish to app.b-diddies.com (never marketing httpdocs), use: scripts/deploy-spa.sh
set -euo pipefail

echo "WARN: deploy-vps.sh is obsolete for production API. Prefer deploy-spa.sh for UI-only deploys."
echo "Press Ctrl-C within 5s to abort, or wait to continue with the legacy full path..."
sleep 5

D=/var/www/vhosts/b-diddies.com
APPDIR=$D/tradepro-app
DOCROOT=$D/app.b-diddies.com
NODE_BIN=/opt/plesk/node/24/bin

echo "== Extract app =="
mkdir -p "$APPDIR"
tar -xzf /tmp/tradepro-deploy.tar.gz -C "$APPDIR"

echo "== Publish frontend to docroot =="
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

echo "== API env file =="
# SELinux blocks systemd from reading httpd-labeled files under the vhost.
# Keep the live EnvironmentFile at /etc/tradepro-api.env (etc_t).
ENV_FILE=/etc/tradepro-api.env
if [ ! -f "$ENV_FILE" ]; then
  cat > "$ENV_FILE" <<EOF
PORT=3001
APP_BASE_URL=https://app.b-diddies.com
WEBHOOK_BASE_URL=https://app.b-diddies.com
INTEGRATIONS_MOCK_MODE=true
JWT_SECRET=$(openssl rand -hex 32)
ORG_ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF
  chmod 600 "$ENV_FILE"
fi

chown -R bdiddies:psacln "$APPDIR"
# Docroot must be readable by the web server group used by Plesk.
chown -R bdiddies:psaserv "$DOCROOT"
# Tarball extracted from /tmp lands as user_tmp_t; Apache needs httpd_sys_content_t.
restorecon -Rv "$APPDIR" "$DOCROOT" >/dev/null 2>&1 || true

echo "== npm install (prod deps + tsx) =="
cd "$APPDIR"
sudo -u bdiddies PATH="$NODE_BIN:$PATH" "$NODE_BIN/npm" install --omit=dev --no-audit --no-fund 2>&1 | tail -3
sudo -u bdiddies PATH="$NODE_BIN:$PATH" "$NODE_BIN/npm" install tsx --no-audit --no-fund 2>&1 | tail -2

echo "== systemd service =="
cat > /etc/systemd/system/tradepro-api.service <<EOF
[Unit]
Description=TradePro API (app.b-diddies.com)
After=network.target

[Service]
User=bdiddies
Group=psacln
WorkingDirectory=$APPDIR
EnvironmentFile=$ENV_FILE
ExecStart=$NODE_BIN/node $APPDIR/node_modules/tsx/dist/cli.mjs server/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable tradepro-api
systemctl restart tradepro-api
sleep 3
systemctl status tradepro-api --no-pager | head -8

echo "== nginx proxy for API routes =="
mkdir -p /var/www/vhosts/system/app.b-diddies.com/conf
cat > /var/www/vhosts/system/app.b-diddies.com/conf/vhost_nginx.conf <<'EOF'
location ~ ^/(api|webhooks|health)(/|$) {
    proxy_pass http://127.0.0.1:3001;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 300;
    client_max_body_size 25m;
}
EOF
plesk sbin httpdmng --reconfigure-domain app.b-diddies.com

echo "== Local smoke test =="
curl -s --max-time 10 http://127.0.0.1:3001/health || echo "health check failed"
echo ""
curl -sI --max-time 10 -H "Host: app.b-diddies.com" http://127.0.0.1/ | head -5
echo "DONE"
