#!/bin/bash
# Deploy TradePro to app.b-diddies.com on the Plesk VPS.
set -euo pipefail

D=/var/www/vhosts/b-diddies.com
APPDIR=$D/tradepro-app
DOCROOT=$D/app.b-diddies.com
NODE_BIN=/opt/plesk/node/24/bin

echo "== Extract app =="
mkdir -p "$APPDIR"
tar -xzf /tmp/tradepro-deploy.tar.gz -C "$APPDIR"

echo "== Publish frontend to docroot =="
rm -rf "${DOCROOT:?}"/*
cp -r "$APPDIR/dist/." "$DOCROOT/"
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
    Header set Cache-Control "no-cache, must-revalidate"
  </Files>
  <FilesMatch "\.(js|css|woff2?)$">
    Header set Cache-Control "public, max-age=31536000, immutable"
  </FilesMatch>
</IfModule>
EOF

echo "== API env file =="
if [ ! -f "$APPDIR/.env" ]; then
  cat > "$APPDIR/.env" <<EOF
PORT=3001
APP_BASE_URL=https://app.b-diddies.com
WEBHOOK_BASE_URL=https://app.b-diddies.com
INTEGRATIONS_MOCK_MODE=true
JWT_SECRET=$(openssl rand -hex 32)
ORG_ENCRYPTION_KEY=$(openssl rand -hex 32)
EOF
  chmod 600 "$APPDIR/.env"
fi

chown -R bdiddies:psacln "$APPDIR" "$DOCROOT"

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
EnvironmentFile=$APPDIR/.env
ExecStart=$NODE_BIN/node $APPDIR/node_modules/tsx/dist/cli.mjs server/index.ts
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now tradepro-api
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
