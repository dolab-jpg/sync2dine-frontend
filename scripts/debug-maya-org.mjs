import { readFileSync } from 'fs';
import { resolve } from 'path';

const DEBUG = 'http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5';

function loadEnv(path) {
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const i = line.indexOf('=');
    if (i < 0) continue;
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

async function dbg(hypothesisId, message, data) {
  // #region agent log
  await fetch(DEBUG, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'b8f319' },
    body: JSON.stringify({
      sessionId: 'b8f319',
      runId: 'maya-fix-1',
      hypothesisId,
      location: 'debug-maya-org.mjs',
      message,
      data,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
}

const env = loadEnv(resolve('c:/Users/dolab/Downloads/sync2dine-backend/.env'));
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY;
const anon = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const HOME = 'c2887ddb-0cba-4df1-9086-e7399c92d159';

const orgs = await (await fetch(`${url}/rest/v1/organizations?select=id,name,plan,contact_email,status`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})).json();

const login = await (await fetch(`${url}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'maya@demo.sync2dine.io', password: 'Sync2DineDemo1!' }),
})).json();

const prof = await (await fetch(`${url}/rest/v1/profiles?id=eq.${login.user.id}&select=id,email,role,org_id,username`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})).json();

const mayaOrg = prof[0]?.org_id || null;
const data = {
  orgs,
  maya: prof[0],
  homeFallback: HOME,
  mayaOrgIsHome: mayaOrg === HOME,
  experienceToday: mayaOrg && mayaOrg !== HOME ? 'restaurant' : 'sales',
};

await dbg('H6', 'maya org vs home', data);
console.log(JSON.stringify(data, null, 2));
