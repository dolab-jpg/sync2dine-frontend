#!/usr/bin/env node
/**
 * sessionStart hook: surface open phone/Vapi ops incidents to the agent.
 * Fail open — never block the session. Does NOT enqueue code fixes.
 */
import { readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const LOCAL_MIRROR = join(ROOT, '.cursor', 'local', 'phone-incidents-open.json');
const DEPLOY_ENV = join(ROOT, '.cursor', 'local', 'deploy.env');

function loadDeployEnv() {
  const out = {};
  if (!existsSync(DEPLOY_ENV)) return out;
  try {
    for (const line of readFileSync(DEPLOY_ENV, 'utf-8').split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue;
      const eq = trimmed.indexOf('=');
      out[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  } catch {
    /* ignore */
  }
  return out;
}

function readLocalMirror() {
  if (!existsSync(LOCAL_MIRROR)) return [];
  try {
    const data = JSON.parse(readFileSync(LOCAL_MIRROR, 'utf-8'));
    return Array.isArray(data?.open) ? data.open : [];
  } catch {
    return [];
  }
}

async function fetchRemoteOpen() {
  const env = loadDeployEnv();
  const base = (
    process.env.PHONE_OPS_AUDIT_URL
    || env.PHONE_OPS_AUDIT_URL
    || env.APP_BASE_URL
    || process.env.APP_BASE_URL
    || ''
  ).replace(/\/$/, '');
  const token =
    process.env.PHONE_OPS_AUDIT_TOKEN
    || env.PHONE_OPS_AUDIT_TOKEN
    || env.API_BEARER_TOKEN
    || '';
  if (!base) return [];
  const url = `${base}/api/ai/phone-incidents?status=open`;
  try {
    const headers = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    const payload = await res.json();
    const alerts = payload.alerts || payload.incidents || [];
    return Array.isArray(alerts) ? alerts : [];
  } catch {
    return [];
  }
}

function formatContext(items) {
  const lines = [
    '## Open phone / Vapi ops incidents',
    'These are durable AI Audit Phone errors (tool/webhook/stuck call).',
    'Review in the app at /ai-audit?tab=phone_errors.',
    'Do NOT mass-enqueue code fixes unless the user asks.',
    'Prefer Offer via batch-code-fix or discuss first.',
    '',
  ];
  for (let i = 0; i < Math.min(items.length, 10); i += 1) {
    const item = items[i];
    const severity = item.severity || '?';
    const err = String(item.error || '').slice(0, 160);
    const tool = item.toolName || '';
    const callId = item.callId || '';
    const iid = item.id || '';
    const audit = item.auditPath || `/ai-audit?tab=phone_errors&id=${iid}`;
    lines.push(
      `${i + 1}. [${severity}] ${tool ? `${tool} — ` : ''}${err}`
        + ` | call=${callId || '—'} | id=${iid} | ${audit}`,
    );
  }
  if (items.length > 10) lines.push(`…and ${items.length - 10} more.`);
  return lines.join('\n');
}

async function main() {
  // Drain stdin (sessionStart payload)
  try {
    await new Promise((resolve) => {
      process.stdin.resume();
      process.stdin.on('data', () => {});
      process.stdin.on('end', resolve);
      setTimeout(resolve, 50);
    });
  } catch {
    /* ignore */
  }

  let items = readLocalMirror();
  if (!items.length) items = await fetchRemoteOpen();

  if (!items.length) {
    process.stdout.write('{}\n');
    return;
  }
  process.stdout.write(JSON.stringify({ additional_context: formatContext(items) }) + '\n');
}

main().catch(() => {
  process.stdout.write('{}\n');
});
