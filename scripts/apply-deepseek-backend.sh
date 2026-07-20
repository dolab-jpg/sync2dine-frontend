#!/bin/bash
set -e
cd /var/www/vhosts/sync2dine.io/sync2dine-backend

# Fix vision-handler playbook imports for backend layout
if [ -f /tmp/deepseek-upload/vision-handler.ts ]; then
  cp /tmp/deepseek-upload/vision-handler.ts server/vision-handler.ts
  sed -i "s|from '../src/app/config/trades/playbooks/bathroom'|from './playbooks/bathroom'|g" server/vision-handler.ts
  sed -i "s|from '../src/app/config/trades/playbooks'|from './playbooks'|g" server/vision-handler.ts
fi

for f in \
  llm-connection.ts \
  openai-health.ts \
  org-openai-key-routes.ts \
  openai-connection.ts \
  categorize-transaction-handler.ts \
  translation-service.ts \
  channel-inbound-handler.ts \
  phone-orchestrator.ts \
  receipt-handler.ts \
  building-control-handler.ts \
  restaurant-research.ts \
  realtime-routes.ts \
  orchestrate-stream.ts \
  ai-proxy.ts \
  tts.ts \
  usage.ts \
  orchestrator-types.ts
do
  if [ -f "/tmp/deepseek-upload/$f" ]; then
    cp "/tmp/deepseek-upload/$f" "server/$f"
  fi
done

# Patch orchestrator-handler in place for provider-aware models (do not replace whole file)
python3 - <<'PY'
from pathlib import Path
p = Path('server/orchestrator-handler.ts')
text = p.read_text()
old = """  try {
    const { client: openai } = await createLLMClientForOrg(orgId, '/api/ai/orchestrate', {
      bodyOpenAIApiKey: body.apiKey,
      bodyDeepSeekApiKey: (body as { deepseekApiKey?: string }).deepseekApiKey,
      provider: (body as { provider?: string }).provider,
    });

    if (mode === 'customer' || mode === 'cyrus') {
      return await runCustomerOrchestrator(openai as unknown as Parameters<typeof runCustomerOrchestrator>[0], body, messages);
    }

    if (mode === 'phone') {
      return await runPhoneOrchestrator(openai as unknown as Parameters<typeof runCustomerOrchestrator>[0], body, messages);
    }

    // Sally sales mode reuses the staff tool loop with Sally tools + prompt.
    return await runStaffOrchestrator(openai as unknown as Parameters<typeof runStaffOrchestrator>[0], body, messages);
  } catch (err) {
    throw mapOpenAIError(err);
  }
}"""
new = """  try {
    const { createLLMClientForOrg, defaultChatModelForProvider } = await import('./llm-connection');
    const { client: openai, provider } = await createLLMClientForOrg(orgId, '/api/ai/orchestrate', {
      bodyOpenAIApiKey: body.apiKey,
      bodyDeepSeekApiKey: (body as { deepseekApiKey?: string }).deepseekApiKey,
      provider: (body as { provider?: string }).provider,
    });
    const mappedBody = {
      ...body,
      model: defaultChatModelForProvider(provider, body.model),
      provider,
    };

    if (mode === 'customer' || mode === 'cyrus') {
      return await runCustomerOrchestrator(openai as unknown as Parameters<typeof runCustomerOrchestrator>[0], mappedBody, messages);
    }

    if (mode === 'phone') {
      return await runPhoneOrchestrator(openai as unknown as Parameters<typeof runCustomerOrchestrator>[0], mappedBody, messages);
    }

    // Sally sales mode reuses the staff tool loop with Sally tools + prompt.
    return await runStaffOrchestrator(openai as unknown as Parameters<typeof runStaffOrchestrator>[0], mappedBody, messages);
  } catch (err) {
    throw mapOpenAIError(err);
  }
}"""
if old in text:
    # Also remove duplicate createLLMClientForOrg import if present above
    text2 = text.replace(
        "  const { mapOpenAIError } = await import('./openai-connection');\n  const { createLLMClientForOrg } = await import('./llm-connection');\n",
        "  const { mapOpenAIError } = await import('./openai-connection');\n",
    )
    p.write_text(text2.replace(old, new))
    print('orchestrator patched')
else:
    print('orchestrator pattern not found — leave as-is')
PY

pkill -f 'sync2dine.io/sync2dine-backend.*server/index.ts' || true
sleep 2
nohup /opt/plesk/node/24/bin/node \
  --require ./node_modules/tsx/dist/preflight.cjs \
  --import file:///var/www/vhosts/sync2dine.io/sync2dine-backend/node_modules/tsx/dist/loader.mjs \
  --env-file=.env server/index.ts \
  >/tmp/sync2dine-api.log 2>&1 &
sleep 6
echo PROCESS:
pgrep -af 'sync2dine.io/sync2dine-backend.*server/index.ts' | head -3 || true
echo LOG:
tail -25 /tmp/sync2dine-api.log || true
echo HEALTH:
curl -sS --max-time 10 https://app.sync2dine.io/health; echo
echo AI:
curl -sS --max-time 10 -X POST https://app.sync2dine.io/api/ai/health -H 'Content-Type: application/json' -d '{"provider":"deepseek"}'; echo
