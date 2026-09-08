#!/bin/bash
# DISABLED — legacy Builder Diddies nginx rewrite.
# Hardcodes app.b-diddies.com and proxy to :3001 — wrong for Sync2Dine.
#
# Live deploy: bash scripts/push-live-local.sh
# SPA → app.sync2dine.io; API from ../sync2dine-backend on VPS :3011.
set -euo pipefail
echo "ERROR: deploy-nginx.sh is disabled."
echo "Use: bash scripts/push-live-local.sh"
echo "Do not rewire nginx to app.b-diddies.com or port 3001."
exit 1
