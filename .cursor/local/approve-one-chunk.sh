#!/bin/bash
set -euo pipefail
CHUNK=$(curl -sS https://app.sync2dine.io/api/sally-knowledge/chunks | python3 -c 'import sys,json;d=json.load(sys.stdin);print(next(c["id"] for c in d["chunks"] if c.get("status")=="pending"))')
echo "chunk=$CHUNK"
curl -sS -X POST https://app.sync2dine.io/api/sally-knowledge/chunks/decide \
  -H 'Content-Type: application/json' \
  -d "{\"id\":\"$CHUNK\",\"decision\":\"approve\"}"
echo
curl -sS https://app.sync2dine.io/api/sally-knowledge/status
echo
