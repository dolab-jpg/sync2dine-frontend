#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
# shellcheck disable=SC1091
set -a
# load only URL + anon; password from env
source "$ROOT/.env.production.local"
set +a
EMAIL="${S2D_LOGIN_EMAIL:-owner@sync2dine.io}"
if [ -z "${S2D_LOGIN_PASSWORD:-}" ]; then
  echo "missing password env"
  exit 2
fi
echo "== token grant max 8s =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  -X POST "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"$S2D_LOGIN_PASSWORD\"}" \
  | python -c "import sys,json,re; t=sys.stdin.read();
print(re.sub(r'\"access_token\":\"[^\"]+\"','\"access_token\":\"[redacted]\"', t));
print(re.sub(r'\"refresh_token\":\"[^\"]+\"','\"refresh_token\":\"[redacted]\"', ''))"
echo "== signup settings =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  "$VITE_SUPABASE_URL/auth/v1/settings" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" \
  -H "Authorization: Bearer $VITE_SUPABASE_ANON_KEY"
