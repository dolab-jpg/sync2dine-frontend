#!/bin/bash
set -uo pipefail
ROOT="/c/Users/dolab/Downloads/sync2dine-frontend"
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.production.local"
set +a
URL="$VITE_SUPABASE_URL"
KEY="$VITE_SUPABASE_ANON_KEY"

echo "== query-param apikey health =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  "$URL/auth/v1/health?apikey=$KEY" || echo fail:$?

echo "== apikey header only, no Authorization =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  "$URL/auth/v1/settings" \
  -H "apikey: $KEY" || echo fail:$?

echo "== vps rest with apikey header only =="
ssh vps "curl -sS -m 8 -o /dev/null -w 'VPS_REST HTTP:%{http_code} TIME:%{time_total}\n' \
  '$URL/rest/v1/profiles?select=id&limit=1' \
  -H 'apikey: $KEY'" || echo fail:$?

echo "== vps token grant =="
ssh vps "curl -sS -m 8 -o /dev/null -w 'VPS_TOKEN HTTP:%{http_code} TIME:%{time_total}\n' \
  -X POST '$URL/auth/v1/token?grant_type=password' \
  -H 'apikey: $KEY' \
  -H 'Content-Type: application/json' \
  -d '{\"email\":\"owner@sync2dine.io\",\"password\":\"x\"}'" || echo fail:$?
