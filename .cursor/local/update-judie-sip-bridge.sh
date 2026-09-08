#!/bin/bash
# DEPRECATED / RETIRED � do not use.
#
# This script rewrote the Asterisk bridge .env to a SINGLE SIP user and recreated
# the container. That is exactly what knocked Sally offline whenever a Judie line
# was saved (one .env = one REGISTER). The bridge is now driven by lines.json and
# registers N SIP accounts concurrently (Sally + every customer Judie).
#
# Correct path now:
#   - UI: Platform clients / Sally offer -> "Go live (all lines)"
#   - API: POST https://app.sync2dine.io/api/platform/phone-lines/sync-asterisk-bridge {"apply":true}
#   Both rebuild lines.json from ALL enabled aria+sally lines and also ensure the
#   Vapi BYO number for each DID, so nothing displaces anything else.
set -euo pipefail
echo "ERROR: update-judie-sip-bridge.sh is retired (single-line .env swap causes REGISTER displacement)." >&2
echo "Use 'Go live (all lines)' in the UI, or POST /api/platform/phone-lines/sync-asterisk-bridge {\"apply\":true}." >&2
exit 1
