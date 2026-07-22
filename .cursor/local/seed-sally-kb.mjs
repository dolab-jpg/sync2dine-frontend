import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});
const home =
  env.HOME_ORG_ID ||
  env.SYNC2DINE_HOME_ORG_ID ||
  '4fc49703-d1b0-4ac7-892d-9c32d31e9661';

const { data: existing } = await sb
  .from('sally_knowledge_chunks')
  .select('id')
  .eq('org_id', home)
  .eq('title', 'Atmosphere England USP')
  .maybeSingle();

if (existing?.id) {
  console.log('seed exists', existing.id);
} else {
  const { data, error } = await sb
    .from('sally_knowledge_chunks')
    .insert({
      org_id: home,
      category: 'usp',
      title: 'Atmosphere England USP',
      body: 'Only strategic venue audio of its kind in England — advertise to guests already in the restaurant, not a music stream. Easy app + connect phone/audio.',
      source_url: 'https://sync2dine.io',
      status: 'approved',
      active: true,
      approved_at: new Date().toISOString(),
    })
    .select('id')
    .maybeSingle();
  if (error) console.error(error.message);
  else console.log('seeded', data?.id);
}

const { count } = await sb
  .from('sally_knowledge_chunks')
  .select('*', { count: 'exact', head: true })
  .eq('status', 'approved');
console.log('approved_chunks', count);
