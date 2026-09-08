#!/usr/bin/env node
/**
 * FE agent-map check + required knowledge-layer docs; delegates BE discovery baseline when sibling present.
 */
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FE_ROOT = join(__dirname, '..');
const BE_ROOT = join(FE_ROOT, '..', 'sync2dine-backend');
const errors = [];

function fail(msg) {
  errors.push(msg);
}

const required = [
  'AGENTS.md',
  'docs/ARCHITECTURE.md',
  'docs/CAPABILITY_INVENTORY.md',
  'docs/DEPLOYMENT_MAP.md',
  'docs/CHANGE_IMPACT.md',
  'docs/APPLICATION_MASTER.md',
  'docs/ENGINEERING_KNOWLEDGE_REPORT.md',
  'src/app/routeMap.ts',
  'src/app/components/restaurant/RestaurantLive.tsx',
  'scripts/push-live-local.sh',
  '.cursor/skills/sync2dine-navigate/SKILL.md',
  '.cursor/skills/sync2dine-phone-change/SKILL.md',
  '.cursor/skills/sync2dine-orders/SKILL.md',
  '.cursor/skills/sync2dine-runtime-tool/SKILL.md',
  '.cursor/skills/sync2dine-ship-live/SKILL.md',
  '.cursor/skills/sync2dine-diagnose-prod/SKILL.md',
];

for (const p of required) {
  if (!existsSync(join(FE_ROOT, p))) fail(`Missing ${p}`);
}

const agents = readFileSync(join(FE_ROOT, 'AGENTS.md'), 'utf8');
for (const needle of ['AI_REGISTRY', 'TOOL_REGISTRY', 'DEPLOYMENT_MAP', 'CHANGE_IMPACT', 'CAPABILITY_INVENTORY']) {
  if (!agents.includes(needle)) fail(`AGENTS.md missing link/mention of ${needle}`);
}

const master = readFileSync(join(FE_ROOT, 'docs/APPLICATION_MASTER.md'), 'utf8');
if (!master.includes('24.J')) fail('APPLICATION_MASTER missing �24.J');

for (const script of ['deploy-nginx.sh', 'deploy-vps.sh']) {
  const p = join(FE_ROOT, 'scripts', script);
  if (existsSync(p)) {
    const t = readFileSync(p, 'utf8');
    if (!/disabled|ERROR:/.test(t)) fail(`${script} not hard-disabled`);
  }
}

if (existsSync(join(FE_ROOT, 'server-legacy', 'index.ts'))) {
  fail('server-legacy/index.ts present � remove; never treat as API');
}

if (!existsSync(BE_ROOT)) {
  console.warn('Sibling backend missing � skipping BE check');
} else {
  const r = spawnSync(process.execPath, [join(BE_ROOT, 'scripts/check-agent-maps.mjs')], {
    cwd: BE_ROOT,
    encoding: 'utf8',
  });
  if (r.status !== 0) {
    fail(`Backend check failed:\n${r.stdout || ''}\n${r.stderr || ''}`);
  }
}

if (errors.length) {
  console.error('check:agent-maps FAILED:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}
console.log('check:agent-maps OK (frontend)');
