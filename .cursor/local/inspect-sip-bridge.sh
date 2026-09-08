#!/bin/bash
set -euo pipefail
BRIDGE=/var/www/vhosts/b-diddies.com/tradepro-sip-bridge
echo "=== bridge listing ==="
ls -la "$BRIDGE" | head -40
echo "=== docker env (masked) ==="
docker exec tradepro-sip-bridge printenv | grep -E 'SOHO66|VAPI|AI_SIP|EXTERNAL' | sed -E 's/(PASSWORD|KEY|SECRET|TOKEN|PRIVATE)=.*/\1=***/'
echo "=== registrations ==="
docker exec tradepro-sip-bridge asterisk -rx 'pjsip show registrations'
echo "=== endpoints ==="
docker exec tradepro-sip-bridge asterisk -rx 'pjsip show endpoints' | head -40
echo "=== API env candidates ==="
for f in \
  /var/www/vhosts/sync2dine.io/sync2dine-backend/.env \
  /var/www/vhosts/sync2dine.io/sync2dine-app/.env \
  /etc/tradepro-api.env \
  /etc/sync2dine-api.env
do
  if [ -f "$f" ]; then
    echo "-- $f --"
    grep -E '^(SOHO66|VAPI_|VOICE_|HOME_ORG|PORT)' "$f" | sed -E 's/(PASSWORD|KEY|SECRET|TOKEN|PRIVATE)=.*/\1=***/' || true
  else
    echo "missing $f"
  fi
done
echo "=== pm2 / systemd api ==="
pm2 list 2>/dev/null || true
systemctl list-units --type=service --all 2>/dev/null | grep -Ei 'sync2|tradepro|node' | head -20 || true
docker ps --format '{{.Names}} {{.Image}} {{.Ports}}' | grep -Ei 'sync|api|3011' || true
