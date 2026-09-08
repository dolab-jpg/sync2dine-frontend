#!/bin/bash
set -euo pipefail
# Run ON the VPS to see if GoTrue hangs from the server too.
URL='https://olpbvumayxxxqmsbfuua.supabase.co'
echo "== health no key =="
curl -sS -m 6 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" "$URL/auth/v1/health" || true
echo
echo "== health with key (key passed as arg1) =="
KEY="${1:-}"
if [ -z "$KEY" ]; then
  echo "no key"
  exit 2
fi
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  "$URL/auth/v1/health" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" || true
echo
echo "== settings =="
curl -sS -m 8 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  "$URL/auth/v1/settings" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" || true
