#!/bin/bash
# DISABLED — legacy Builder Diddies / tradepro-app deploy.
# Rewrites tradepro-api WorkingDirectory onto a frontend extract and breaks the
# Sync2Dine backend SoT. Do not run.
#
# Live deploy: bash scripts/push-live-local.sh
set -euo pipefail
echo "ERROR: deploy-vps.sh is disabled."
echo "Use: bash scripts/push-live-local.sh"
echo "SPA → app.sync2dine.io; API from ../sync2dine-backend."
exit 1
