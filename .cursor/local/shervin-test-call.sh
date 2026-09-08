#!/bin/bash
set -euo pipefail
API=http://127.0.0.1:3011
NUM='+447576442345'

echo '== patch transfer numbers =='
curl -sS -m 15 -X PATCH "$API/api/agent/transfer-numbers" \
  -H 'Content-Type: application/json' \
  -d "{\"sales\":\"$NUM\",\"general\":\"$NUM\",\"recruitment\":\"$NUM\"}"
echo

echo '== patch overflow number =='
curl -sS -m 15 -X PATCH "$API/api/agent/settings" \
  -H 'Content-Type: application/json' \
  -d "{\"overflowNumber\":\"$NUM\"}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("overflow", d.get("overflowNumber")); print("transfers", d.get("transferNumbers"))'
echo

echo '== confirm transfers =='
curl -sS -m 8 "$API/api/agent/transfer-numbers"
echo

echo '== place outbound test =='
curl -sS -m 45 -X POST "$API/api/calls/outbound" \
  -H 'Content-Type: application/json' \
  -d "{\"to\":\"$NUM\",\"template\":\"sally_sales\",\"context\":{\"aim\":\"sales_outreach\",\"brief\":\"This is a Sync Two Dine sales-line test for Shervin. Confirm he can hear you. Do not pitch a restaurant. Keep it to two sentences.\",\"agentPersona\":\"sally\",\"source\":\"call_centre\"}}"
echo
