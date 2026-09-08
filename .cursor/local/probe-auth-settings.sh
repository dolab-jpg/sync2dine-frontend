#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
set -a
# shellcheck disable=SC1091
source "$ROOT/.env.production.local"
set +a
echo "== auth settings =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  "$VITE_SUPABASE_URL/auth/v1/settings" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
echo
echo "== token grant missing password (expect 400 fast) =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  -X POST "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@sync2dine.io"}'
echo
echo "== token grant wrong password =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  -X POST "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"owner@sync2dine.io","password":"definitely-wrong-password"}'
