#!/bin/bash
set -euo pipefail

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
curl -s --max-time 10 http://127.0.0.1:3001/health || echo "direct health check failed"
echo ""
curl -sI --max-time 10 -H "Host: app.b-diddies.com" http://127.0.0.1/ | head -5
curl -s --max-time 10 -H "Host: app.b-diddies.com" http://127.0.0.1/health || echo "proxied health check failed"
echo ""
echo "DONE"
