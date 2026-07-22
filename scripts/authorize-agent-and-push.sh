#!/bin/bash
# DEPRECATED for cloud agents. Prefer: bash scripts/push-live-local.sh
# Kept as a thin wrapper so older instructions still work.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
echo "NOTE: running local push only (no cloud agent)."
exec bash "$ROOT/scripts/push-live-local.sh"
