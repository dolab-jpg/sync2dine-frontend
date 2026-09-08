#!/bin/bash
set -euo pipefail
API=http://127.0.0.1:3011
NUM='+447576442345'

echo '== transfers after restart =='
curl -sS -m 8 "$API/api/agent/transfer-numbers"
echo

echo '== re-patch transfers + overflow =='
curl -sS -m 15 -X PATCH "$API/api/agent/transfer-numbers" \
  -H 'Content-Type: application/json' \
  -d "{\"sales\":\"$NUM\",\"general\":\"$NUM\",\"recruitment\":\"$NUM\"}"
echo
curl -sS -m 15 -X PATCH "$API/api/agent/settings" \
  -H 'Content-Type: application/json' \
  -d "{\"overflowNumber\":\"$NUM\"}" | python3 -c 'import sys,json; d=json.load(sys.stdin); print("overflow", d.get("overflowNumber")); print("transfers", d.get("transferNumbers"))'

echo '== place recruitment interview =='
curl -sS -m 45 -X POST "$API/api/calls/outbound" \
  -H 'Content-Type: application/json' \
  -d "{\"to\":\"$NUM\",\"template\":\"recruitment_interview\",\"context\":{\"aim\":\"recruitment_interview\",\"brief\":\"Test hiring interview for Shervin Dolab. You are Sally from Sync Two Dine interviewing for restaurant field sales covering Woking, Surrey and London. Sell Atmosphere plus Judie in the live pitch exercise. This call is recorded.\",\"agentPersona\":\"sally\",\"source\":\"recruitment_interview\",\"candidateName\":\"Shervin Dolab\",\"cvSummary\":\"Founder test call — not an Indeed candidate. Confirm hiring mode, Atmosphere plus Judie pitch exercise, then scoreInterview.\"}}"
echo
