#!/bin/bash
set -uo pipefail
ROOT="/c/Users/dolab/Downloads/sync2dine-frontend"
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.production.local"
set +a
URL="$VITE_SUPABASE_URL"
KEY="$VITE_SUPABASE_ANON_KEY"

echo "== local health with key =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  "$URL/auth/v1/health" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" || echo "local_health_fail:$?"

echo "== local rest profiles =="
curl -sS -m 8 -o /tmp/s2d-rest.txt -w "HTTP:%{http_code} TIME:%{time_total} BYTES:%{size_download}\n" \
  "$URL/rest/v1/profiles?select=id&limit=1" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" || echo "local_rest_fail:$?"

echo "== vps health no key =="
ssh vps 'curl -sS -m 8 -w "\nVPS_HEALTH HTTP:%{http_code} TIME:%{time_total}\n" https://olpbvumayxxxqmsbfuua.supabase.co/auth/v1/health' || echo "vps_health_fail:$?"

echo "== vps settings with key =="
ssh vps "curl -sS -m 8 -w '\nVPS_SETTINGS HTTP:%{http_code} TIME:%{time_total}\n' \
  https://olpbvumayxxxqmsbfuua.supabase.co/auth/v1/settings \
  -H 'apikey: $KEY' \
  -H 'Authorization: Bearer $KEY'" || echo "vps_settings_fail:$?"
