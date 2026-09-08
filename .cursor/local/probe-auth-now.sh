#!/bin/bash
set -uo pipefail
ROOT="/c/Users/dolab/Downloads/sync2dine-frontend"
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.production.local"
set +a
URL="$VITE_SUPABASE_URL"
KEY="$VITE_SUPABASE_ANON_KEY"

echo "== no-key health =="
curl -sS -m 6 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" "$URL/auth/v1/health" || echo fail:$?

echo "== key health =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  "$URL/auth/v1/health" -H "apikey: $KEY" || echo fail:$?

echo "== settings =="
curl -sS -m 8 -o /tmp/s2d-settings.txt -w "HTTP:%{http_code} TIME:%{time_total} BYTES:%{size_download}\n" \
  "$URL/auth/v1/settings" -H "apikey: $KEY" || echo fail:$?
head -c 120 /tmp/s2d-settings.txt 2>/dev/null; echo

echo "== vps token wrong-pass =="
ssh vps "curl -sS -m 8 -o /tmp/gt.txt -w 'VPS_TOKEN HTTP:%{http_code} TIME:%{time_total} BYTES:%{size_download}\n' \
  -X POST '$URL/auth/v1/token?grant_type=password' \
  -H 'apikey: $KEY' -H 'Content-Type: application/json' \
  -d '{\"email\":\"owner@sync2dine.io\",\"password\":\"wrong\"}'" || echo fail:$?
