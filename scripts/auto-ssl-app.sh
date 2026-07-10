#!/bin/bash
# Auto-issue Let's Encrypt cert for app.b-diddies.com once public DNS resolves.
# Installed as a cron job; removes itself after success.
LOG=/root/auto-ssl-app.log
D=app.b-diddies.com

IP=$(dig +short A "$D" @8.8.8.8 | head -1)
if [ "$IP" != "77.68.51.27" ]; then
  echo "$(date -u '+%F %T') DNS not ready (got: ${IP:-none})" >> "$LOG"
  exit 0
fi

echo "$(date -u '+%F %T') DNS resolved, issuing cert..." >> "$LOG"
if plesk bin extension --exec letsencrypt cli.php -d "$D" -m admin@b-diddies.com >> "$LOG" 2>&1; then
  plesk bin site -u "$D" -ssl true -ssl-redirect true >> "$LOG" 2>&1
  echo "$(date -u '+%F %T') SUCCESS - cert issued, removing cron" >> "$LOG"
  rm -f /etc/cron.d/auto-ssl-app /root/auto-ssl-app.sh
else
  echo "$(date -u '+%F %T') cert issuance failed, will retry" >> "$LOG"
fi
