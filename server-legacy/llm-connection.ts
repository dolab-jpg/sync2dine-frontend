/**
 * Central LLM factory — DeepSeek or OpenAI as primary text/vision brain.
 * OpenAI specialist client remains for TTS / Whisper / Realtime / image edit / Responses web_search.
 */
import {
  ensureOrgAIBrainLoaded,
  getOrgAIBrain,
  getOrgDeepSeekApiKey,
  getOrgOpenAIApiKey,
  type AIBrainProvider,
} from './organizations';
import {
  OpenAIConnectionError,
  mapOpenAIError,
  requireOpenAIApiKeyAsync,
  resolveOpenAIApiKeyAsync,
  resolveCompanyAiBrainOpenAIKey,
  sanitizeBodyApiKey,
} from './openai-connection';

export const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';

export const OPENAI_CHAT_MODELS = ['gpt-4o', 'gpt-4o-mini'] as const;
export const DEEPSEEK_CHAT_MODELS = [
  'deepseek-v4-flash',
  'deepseek-v4-pro',
  'deepseek-chat',
  'deepseek-reasoner',
] as const;

export type { AIBrainProvider };

export function resolveBrainProvider(
  bodyProvider?: string,
  orgId?: string | null,
): AIBrainProvider {
  if (bodyProvider === 'deepseek' || bodyProvider === 'openai') return bodyProvider;
  if (orgId) {
    const brain = getOrgAIBrain(orgId);
    if (brain.provider === 'deepseek' || brain.provider === 'openai') return brain.provider;
  }
  return 'openai';
}

export function resolveDeepSeekApiKey(bodyApiKey?: string, orgId?: string | null): string | undefined {
  if (orgId) {
    const orgKey = getOrgDeepSeekApiKey(orgId);
    if (orgKey) return orgKey;
  }
  const key = (sanitizeBodyApiKey(bodyApiKey) || process.env.DEEPSEEK_API_KEY || '').trim();
  return key || undefined;
}

export async function resolveDeepSeekApiKeyAsync(
  bodyApiKey?: string,
  orgId?: string | null,
): Promise<string | undefined> {
  if (orgId) await ensureOrgAIBrainLoaded(orgId);
  return resolveDeepSeekApiKey(bodyApiKey, orgId);
}

export function defaultChatModelForProvider(provider: AIBrainProvider, preferred?: string): string {
  if (provider === 'deepseek') {
    if (preferred && (DEEPSEEK_CHAT_MODELS as readonly string[]).includes(preferred)) return preferred;
    if (preferred?.startsWith('deepseek')) return preferred;
    return 'deepseek-v4-flash';
  }
  if (preferred && (OPENAI_CHAT_MODELS as readonly string[]).includes(preferred)) return preferred;
  if (preferred?.startsWith('deepseek')) return 'gpt-4o-mini';
  return preferred || 'gpt-4o-mini';
}

/** Default vision model for photo understanding (not image generation). */
export function defaultVisionModelForProvider(provider: AIBrainProvider, preferred?: string): string {
  if (provider === 'deepseek') {
    if (preferred === 'deepseek-v4-pro' || preferred === 'deepseek-v4-flash') return preferred;
    return 'deepseek-v4-pro';
  }
  return preferred && preferred.startsWith('gpt-') ? preferred : 'gpt-4o';
}

/** Text/orchestrator client — honours active brain provider. */
export async function createLLMClientForOrg(
  orgId: string | null,
  endpoint: string,
  options?: {
    bodyOpenAIApiKey?: string;
    bodyDeepSeekApiKey?: string;
    provider?: string;
  },
) {
  const { default: OpenAI } = await import('openai');
  const { wrapOpenAIWithMetering } = await import('./metered-openai');
  if (orgId) await ensureOrgAIBrainLoaded(orgId);

  const provider = resolveBrainProvider(options?.provider, orgId);

  if (provider === 'deepseek') {
    const apiKey = await resolveDeepSeekApiKeyAsync(options?.bodyDeepSeekApiKey, orgId);
    if (!apiKey) {
      throw new OpenAIConnectionError(
        'DeepSeek API key not configured — add it in Settings → Integrations → Company AI Brain, or switch provider to OpenAI.',
        'missing',
      );
    }
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    return { client: wrapOpenAIWithMetering(client, orgId, endpoint), provider, apiKey };
  }

  const apiKey = await requireOpenAIApiKeyAsync(options?.bodyOpenAIApiKey, orgId);
  const client = new OpenAI({ apiKey });
  return { client: wrapOpenAIWithMetering(client, orgId, endpoint), provider: 'openai' as const, apiKey };
}

/**
 * Vision / photo-understanding client — DeepSeek V4 Pro when brain is DeepSeek,
 * otherwise OpenAI gpt-4o. Not for image generation/edit.
 */
export async function createVisionClientForOrg(
  orgId: string | null,
  endpoint: string,
  options?: {
    bodyOpenAIApiKey?: string;
    bodyDeepSeekApiKey?: string;
    provider?: string;
  },
) {
  const { default: OpenAI } = await import('openai');
  const { wrapOpenAIWithMetering } = await import('./metered-openai');
  if (orgId) await ensureOrgAIBrainLoaded(orgId);

  const provider = resolveBrainProvider(options?.provider, orgId);

  if (provider === 'deepseek') {
    const apiKey = await resolveDeepSeekApiKeyAsync(options?.bodyDeepSeekApiKey, orgId);
    if (!apiKey) {
      throw new OpenAIConnectionError(
        'DeepSeek API key not configured for vision — add it in Settings → Integrations → Company AI Brain.',
        'missing',
      );
    }
    const client = new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL });
    return {
      client: wrapOpenAIWithMetering(client, orgId, endpoint),
      provider,
      apiKey,
      model: defaultVisionModelForProvider('deepseek'),
    };
  }

  const apiKey = await requireOpenAIApiKeyAsync(options?.bodyOpenAIApiKey, orgId);
  const client = new OpenAI({ apiKey });
  return {
    client: wrapOpenAIWithMetering(client, orgId, endpoint),
    provider: 'openai' as const,
    apiKey,
    model: defaultVisionModelForProvider('openai'),
  };
}

/** OpenAI-only specialist: TTS / Whisper / Realtime / image edit / Responses web_search. */
export async function createOpenAISpecialistClientForOrg(
  orgId: string | null,
  endpoint: string,
  bodyApiKey?: string,
) {
  const { default: OpenAI } = await import('openai');
  const { wrapOpenAIWithMetering } = await import('./metered-openai');
  try {
    const apiKey = await requireOpenAIApiKeyAsync(bodyApiKey, orgId);
    const client = new OpenAI({ apiKey });
    return wrapOpenAIWithMetering(client, orgId, endpoint);
  } catch (err) {
    if (err instanceof OpenAIConnectionError && err.code === 'missing') {
      throw new OpenAIConnectionError(
        'OpenAI specialist key required for this feature (TTS, Whisper, Realtime, image edit, or web search) — add it in Settings → Integrations → Company AI Brain.',
        'missing',
      );
    }
    throw err;
  }
}

export async function probeLLMConnection(
  provider: AIBrainProvider,
  apiKey: string,
): Promise<void> {
  const { default: OpenAI } = await import('openai');
  const openai = provider === 'deepseek'
    ? new OpenAI({ apiKey, baseURL: DEEPSEEK_BASE_URL })
    : new OpenAI({ apiKey });
  await openai.models.list();
}

export {
  OpenAIConnectionError,
  mapOpenAIError,
  resolveOpenAIApiKeyAsync,
  requireOpenAIApiKeyAsync,
  resolveCompanyAiBrainOpenAIKey,
  getOrgOpenAIApiKey,
};
