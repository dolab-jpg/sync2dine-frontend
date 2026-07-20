#!/usr/bin/env python3
from pathlib import Path

path = Path("/var/www/vhosts/sync2dine.io/sync2dine-backend/server/orchestrator-handler.ts")
text = path.read_text(encoding="utf-8")

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
    const mappedBody: OrchestratorRequest = {
      ...body,
      model: defaultChatModelForProvider(provider, body.model),
      provider: provider,
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

if "defaultChatModelForProvider(provider, body.model)" in text:
    print("already_patched")
else:
    if old not in text:
        raise SystemExit("anchor not found")
    # Also remove duplicate createLLMClientForOrg import line above try if present
    text2 = text.replace(
        "  const { createLLMClientForOrg } = await import('./llm-connection');\n",
        "",
        1,
    )
    if old not in text2:
        raise SystemExit("anchor missing after import cleanup")
    path.write_text(text2.replace(old, new, 1), encoding="utf-8")
    print("patched_ok")
