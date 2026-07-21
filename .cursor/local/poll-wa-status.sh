#!/bin/bash
set -euo pipefail
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 8
  S=$(curl -sS --max-time 12 https://app.sync2dine.io/api/whatsapp-web/status || echo '{}')
  echo "t=$((i*8))s $S"
  echo "$S" | grep -q '"status":"ready"' && { echo READY; break; }
  echo "$S" | grep -q '"status":"qr_pending"' && { echo QR; break; }
  echo "$S" | grep -q '"status":"error"' && { echo ERR; break; }
done
echo '---LOG---'
grep -E 'post-fix|pre-init|orphan|ready|init settled' /tmp/debug-d0f60a.log | tail -n 25 || true
echo '---API---'
grep -E 'WhatsApp|orphan|reclaim|QR|ready|Singleton' /tmp/sync2dine-api.log | tail -n 35 || true
