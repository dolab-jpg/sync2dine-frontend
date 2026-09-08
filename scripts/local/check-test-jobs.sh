#!/bin/bash
# Report the status of queued outbound jobs for the CV-upload test number on the live VPS.
set -uo pipefail
ssh vps 'bash -s' <<'REMOTE'
cd /var/www/vhosts/sync2dine.io/sync2dine-backend/server/data || exit 1
FILE=$(ls -1 synced-data-*.json | head -1)
export PATH="/opt/plesk/node/24/bin:$PATH"
node -e '
const fs = require("fs");
const file = process.argv[1];
const data = JSON.parse(fs.readFileSync(file, "utf8"));
const jobs = (data.outboundQueue || []).filter((j) => String(j.to || "").includes("447700900456"));
console.log("test jobs:", jobs.length);
for (const j of jobs) console.log(j.id, j.status, j.template, j.error || "");
const cands = (data.recruitmentCandidates || []).filter((c) => /test candidate/i.test(String(c.name || "")));
console.log("test candidates:", cands.map((c) => `${c.id}:${c.name}`).join(", "));
' "$FILE"
REMOTE
