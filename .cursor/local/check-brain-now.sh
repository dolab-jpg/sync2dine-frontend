#!/bin/bash
set -euo pipefail
cd /var/www/vhosts/sync2dine.io/sync2dine-backend
echo "ENV_FLAGS:"
grep -E '^VAPI_LLM_PROVIDER=|^VAPI_LLM_MODEL=' .env 2>/dev/null || echo "(none set)"
echo "HAS_DEEPSEEK_KEY_ENV: $(grep -c '^DEEPSEEK_API_KEY=.' .env 2>/dev/null || echo 0)"
/opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import "file://$PWD/node_modules/tsx/dist/loader.mjs" \
  --env-file=.env \
  <<'EOF'
import { getHomeOrgId } from './server/home-org.ts';
import { ensureOrgAIBrainLoaded, getOrgAIBrain } from './server/organizations.ts';
import { resolveBrainProvider, resolveDeepSeekApiKey } from './server/llm-connection.ts';
import { buildVapiModelBlock } from './server/vapi-llm-model.ts';

const orgId = getHomeOrgId();
await ensureOrgAIBrainLoaded(orgId);
const brain = getOrgAIBrain(orgId);
const envForce = String(process.env.VAPI_LLM_PROVIDER || '').trim().toLowerCase();
const resolved = envForce === 'deepseek' || envForce === 'deep-seek'
  ? 'deepseek'
  : envForce === 'openai'
    ? 'openai'
    : resolveBrainProvider(undefined, orgId);
const hasDs = Boolean(resolveDeepSeekApiKey(undefined, orgId));
const model = await buildVapiModelBlock({ orgId, instructions: 'probe', tools: [] });
console.log(JSON.stringify({
  orgId,
  envVapiLlmProvider: envForce || null,
  envVapiLlmModel: process.env.VAPI_LLM_MODEL?.trim() || null,
  orgBrainProvider: brain.provider,
  orgDeepseekConfigured: brain.deepseekConfigured,
  orgOpenaiConfigured: brain.openaiConfigured,
  resolvedBeforeKey: resolved,
  hasDeepSeekKey: hasDs,
  vapiProvider: model.provider,
  vapiModel: model.model,
  deepSeekUsedNow: model.provider === 'deep-seek' || model.provider === 'deepseek',
}, null, 2));
EOF
