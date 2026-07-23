#!/bin/bash
# DISABLED — do not SCP frontend Sally files onto the live API.
# Sally SoT: ../sync2dine-backend/server/sally-sales.ts (+ phone/sally-sales-phone.ts)
# Live deploy: bash scripts/push-live-local.sh
set -euo pipefail

echo "ERROR: deploy-sally-cockney.sh is disabled."
echo ""
echo "Frontend server/ is legacy and must not overwrite sync2dine-backend on the VPS."
echo "1. Edit prompts in: ../sync2dine-backend/server/sally-sales.ts"
echo "2. Deploy API with:  bash scripts/push-live-local.sh"
echo "   (or SKIP_SPA=1 bash scripts/push-live-local.sh for API-only)"
exit 1
