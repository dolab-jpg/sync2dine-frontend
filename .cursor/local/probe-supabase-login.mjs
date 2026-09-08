import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const envPath = resolve(process.cwd(), '.env.production.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const i = line.indexOf('=');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);

const url = env.VITE_SUPABASE_URL;
const anon = env.VITE_SUPABASE_ANON_KEY;
const email = process.env.S2D_LOGIN_EMAIL || 'owner@sync2dine.io';
const password = process.env.S2D_LOGIN_PASSWORD || '';
if (!url || !anon || !password) {
  console.error('missing_env');
  process.exit(2);
}

const started = Date.now();
const ac = new AbortController();
const t = setTimeout(() => ac.abort(), 20000);
try {
  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: anon,
      Authorization: `Bearer ${anon}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
    signal: ac.signal,
  });
  const text = await res.text();
  let err = '';
  try {
    const json = JSON.parse(text);
    err = json.error_description || json.error || json.msg || json.message || '';
  } catch {
    err = text.slice(0, 80);
  }
  console.log(
    JSON.stringify({
      email,
      status: res.status,
      ms: Date.now() - started,
      ok: res.ok,
      error: err || null,
      hasAccessToken: /"access_token"/.test(text),
    }),
  );
} catch (e) {
  console.log(
    JSON.stringify({
      email,
      status: 'throw',
      ms: Date.now() - started,
      error: e instanceof Error ? e.name + ':' + e.message : 'fail',
    }),
  );
} finally {
  clearTimeout(t);
}
