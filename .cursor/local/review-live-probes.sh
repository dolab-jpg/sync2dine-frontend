#!/bin/bash
set -uo pipefail
echo "== health =="
curl -sS -m 10 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" https://app.sync2dine.io/health
echo "== vapi health =="
curl -sS -m 10 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" https://app.sync2dine.io/api/vapi/health
echo "== orders unauth =="
curl -sS -m 10 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" https://app.sync2dine.io/api/orders
echo "== campaigns queue-crm unauth =="
curl -sS -m 10 -o /tmp/s2d-qc.txt -w "HTTP:%{http_code} TIME:%{time_total}\n" \
  -X POST https://app.sync2dine.io/api/campaigns/queue-crm \
  -H "Content-Type: application/json" \
  -d '{"allCrm":true}'
head -c 180 /tmp/s2d-qc.txt; echo
echo "== spa asset =="
curl -sS -m 10 https://app.sync2dine.io/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1
echo "== live spoken brand on VPS =="
ssh vps 'grep -n "spokenCompanyName\|SYNC2DINE_SPOKEN" /var/www/vhosts/sync2dine.io/sync2dine-backend/server/home-org.ts | head -5'
echo "== live allCrm on VPS =="
ssh vps 'grep -n "allCrm" /var/www/vhosts/sync2dine.io/sync2dine-backend/server/ai/agent-routes.ts | head -8'
echo "== live quiet skip gone =="
ssh vps 'grep -n "quietHours\|inQuietHours\|quiet" /var/www/vhosts/sync2dine.io/sync2dine-backend/server/outbound-worker.ts | head -15'
echo "== login timeout in live SPA =="
ASSET=$(curl -sS -m 10 https://app.sync2dine.io/ | grep -oE 'assets/index-[A-Za-z0-9_-]+\.js' | head -1)
curl -sS -m 20 "https://app.sync2dine.io/$ASSET" | grep -o 'signin-timeout\|Signing in' | sort | uniq -c
