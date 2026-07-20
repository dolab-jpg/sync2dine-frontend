/**
 * Resolve the Vapi assistant `model` block � DeepSeek as main brain when org/env has it.
 */
import { DEFAULT_ORG_ID } from './data-store';
import { getHomeOrgId } from './home-org';
import {
  defaultChatModelForProvider,
  resolveBrainProvider,
  resolveDeepSeekApiKeyAsync,
} from './llm-connection';
import { ensureOrgAIBrainLoaded } from './organizations';
import { vapiFetch } from './vapi-client';

let cachedDeepSeekCredentialId: string | null | undefined;

async function ensureDeepSeekCredential(apiKey: string): Promise<string | undefined> {
  const fromEnv = process.env.VAPI_DEEPSEEK_CREDENTIAL_ID?.trim();
  if (fromEnv) return fromEnv;
  if (cachedDeepSeekCredentialId) return cachedDeepSeekCredentialId;

  try {
    const listed = await vapiFetch('/credential', { method: 'GET' });
    if (listed.ok) {
      const rows = Array.isArray(listed.json)
        ? listed.json
        : Array.isArray((listed.json as { data?: unknown }).data)
          ? ((listed.json as { data: unknown[] }).data)
          : [];
      for (const row of rows) {
        const r = row as Record<string, unknown>;
        const provider = String(r.provider || '').toLowerCase();
        if (provider === 'deep-seek' || provider === 'deepseek') {
          const id = String(r.id || '').trim();
          if (id) {
            cachedDeepSeekCredentialId = id;
            return id;
          }
        }
      }
    }

    const created = await vapiFetch('/credential', {
      method: 'POST',
      body: JSON.stringify({
        provider: 'deep-seek',
        apiKey,
      }),
    });
    if (created.ok) {
      const id = String(created.json.id || '').trim();
      if (id) {
        cachedDeepSeekCredentialId = id;
        return id;
      }
    } else {
      console.warn(
        '[vapi-llm] deep-seek credential create failed',
        created.status,
        created.raw?.slice?.(0, 200),
      );
    }
  } catch (err) {
    console.warn('[vapi-llm] deep-seek credential error:', err instanceof Error ? err.message : err);
  }
  return undefined;
}

export async function buildVapiModelBlock(opts: {
  orgId?: string | null;
  instructions: string;
  tools: Array<Record<string, unknown>>;
  temperature?: number;
}): Promise<Record<string, unknown>> {
  const orgId = opts.orgId || getHomeOrgId() || DEFAULT_ORG_ID;
  try {
    await ensureOrgAIBrainLoaded(orgId);
  } catch {
    /* ok */
  }

  const envForce = String(process.env.VAPI_LLM_PROVIDER || '').trim().toLowerCase();
  const provider =
    envForce === 'deepseek' || envForce === 'deep-seek'
      ? 'deepseek'
      : envForce === 'openai'
        ? 'openai'
        : resolveBrainProvider(undefined, orgId);

  const preferredModel = process.env.VAPI_LLM_MODEL?.trim();
  const temperature = opts.temperature ?? 0.7;
  const base = {
    temperature,
    messages: [{ role: 'system', content: opts.instructions }],
    tools: opts.tools,
  };

  if (provider === 'deepseek') {
    const apiKey = await resolveDeepSeekApiKeyAsync(undefined, orgId);
    const model = defaultChatModelForProvider('deepseek', preferredModel);
    if (apiKey) {
      await ensureDeepSeekCredential(apiKey);
      return {
        provider: 'deep-seek',
        model,
        ...base,
      };
    }
    console.warn('[vapi-llm] DeepSeek selected but no API key � falling back to OpenAI for this call');
  }

  return {
    provider: 'openai',
    model: preferredModel && !preferredModel.startsWith('deepseek')
      ? preferredModel
      : defaultChatModelForProvider('openai', preferredModel),
    ...base,
  };
}
