#!/bin/bash
set -euo pipefail
echo "== openai-key =="
curl -sS -m 12 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  -H "X-Org-Id: 4fc49703-d1b0-4ac7-892d-9c32d31e9661" \
  https://app.sync2dine.io/api/org/openai-key
echo
echo "== supabase auth health =="
curl -sS -m 12 -w "\nHTTP:%{http_code} TIME:%{time_total}\n" \
  https://olpbvumayxxxqmsbfuua.supabase.co/auth/v1/health
echo
echo "== supabase rest =="
curl -sS -m 12 -o /dev/null -w "HTTP:%{http_code} TIME:%{time_total}\n" \
  https://olpbvumayxxxqmsbfuua.supabase.co/rest/v1/
