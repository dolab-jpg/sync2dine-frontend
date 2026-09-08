#!/bin/bash
# Confirm the live API is serving the retrained hiring brain (owner ops + HR prompt + CV intake).
set -uo pipefail
ssh vps 'bash -s' <<'REMOTE'
cd /var/www/vhosts/sync2dine.io/sync2dine-backend || exit 1
echo "ownerHiringOps: $(grep -c ownerHiringOps server/phone/sally-sales-phone.ts server/brains/sally/index.ts | tr '\n' ' ')"
echo "hiringInstruction: $(grep -c hiringInstruction server/data-store.ts server/phone/tools/execute.ts | tr '\n' ' ')"
echo "woking f2f: $(grep -c -i woking server/sally/recruitment-interview.ts)"
echo "cv routes: $(grep -c 'api/recruitment/cvs' server/sally/recruitment-routes.ts)"
echo "api pid: $(pgrep -f 'server/index.ts' | head -1)"
REMOTE
