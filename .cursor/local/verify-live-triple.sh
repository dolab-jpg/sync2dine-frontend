#!/bin/bash
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
ls server/data/.wwebjs_auth >/dev/null 2>&1 && echo WA_AUTH_OK || echo WA_AUTH_MISSING
/opt/plesk/node/24/bin/node --input-type=module <<'EOF'
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';
const env = Object.fromEntries(readFileSync('.env','utf8').split('\n').filter(l=>l&&!l.startsWith('#')&&l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim().replace(/^["']|["']$/g,'')]}));
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
for (const t of ['sales_call_insights','sally_knowledge_chunks','sally_knowledge_sources']) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true });
  console.log(t, error ? error.message : count);
}
console.log('brains', existsSync('server/brains'));
console.log('kb_inject', existsSync('server/sally-product-kb/inject.ts'));
EOF
curl -sS -o /dev/null -w 'pricing:%{http_code}\n' https://app.sync2dine.io/pricing
