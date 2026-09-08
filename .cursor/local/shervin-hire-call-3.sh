#!/bin/bash
set -euo pipefail
API=http://127.0.0.1:3011
NUM='+447576442345'
curl -sS -m 15 -X PATCH "$API/api/agent/transfer-numbers" \
  -H 'Content-Type: application/json' \
  -d "{\"sales\":\"$NUM\",\"general\":\"$NUM\",\"recruitment\":\"$NUM\"}"
echo
curl -sS -m 45 -X POST "$API/api/calls/outbound" \
  -H 'Content-Type: application/json' \
  -d "{\"to\":\"$NUM\",\"template\":\"recruitment_interview\",\"context\":{\"aim\":\"recruitment_interview\",\"brief\":\"Founder test. Sales role in the AI business solution: Atmosphere plus Judie. Confirm they can hear you. Do not say Indeed. Do not ask for a restaurant manager.\",\"agentPersona\":\"sally\",\"source\":\"recruitment_interview\",\"candidateName\":\"Shervin Dolab\",\"cvSummary\":\"Founder test call — not an Indeed candidate. Hiring-mode rehearsal for the AI sales role selling Atmosphere and Judie.\"}}"
echo
