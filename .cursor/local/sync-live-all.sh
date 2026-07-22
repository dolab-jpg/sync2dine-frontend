#!/bin/bash
set -euo pipefail
ROOT=/var/www/vhosts/sync2dine.io/sync2dine-backend
cd "$ROOT"
git fetch origin master
git checkout master
git pull --ff-only origin master
# Ensure key files present
test -f server/sally-product-kb/inject.ts && echo OK_sally_kb_inject
test -f server/sales-brain/supabase-sync.ts && echo OK_sales_brain_dualwrite
test -f supabase/migrations/202607212200_sally_knowledge.sql && echo OK_sally_mig || echo MISSING_sally_mig
ls server/brains 2>/dev/null && echo OK_brains || echo NO_brains_dir
bash /tmp/restart-s2d-api-push.sh
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
curl -sS --max-time 10 https://app.sync2dine.io/api/sales-brain/status; echo
# Cloud tables smoke
/opt/plesk/node/24/bin/node --input-type=module <<'EOF'
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
for (const t of ['sales_call_insights','sally_knowledge_chunks','sally_knowledge_sources','sally_knowledge_ingest_jobs']) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(t, error ? error.message : count);
}
console.log('inject_file', existsSync('server/sally-product-kb/inject.ts'));
console.log('brains_dir', existsSync('server/brains'));
EOF
