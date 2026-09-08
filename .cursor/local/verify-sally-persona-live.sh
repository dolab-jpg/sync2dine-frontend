#!/bin/bash
# Confirm the Sally outbound persona fix is present on the live API host.
set -uo pipefail
ssh "${VPS_SSH:-vps}" bash -s <<'REMOTE'
BE=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$BE" || exit 1
echo "-- persona helper present --"
grep -n "SALES_ONLY_OUTBOUND_SOURCES" server/phone/phone-webhook.ts || echo "MISSING helper"
echo "-- resolveOutboundPersona wired into meta --"
grep -n "resolveOutboundPersona(context)" server/phone/phone-webhook.ts || echo "MISSING call site"
echo "-- api health --"
curl -sS -o /dev/null -w 'health=%{http_code}\n' http://127.0.0.1:3011/health || true
REMOTE
