import { integrationService } from '../integrations/integrationService';
import { syncActiveOrgFromProfile } from '../platform/orgContext';

export type OpenAIConnectionStatus = 'checking' | 'connected' | 'missing' | 'rejected';

export interface OpenAIConnectionState {
  status: OpenAIConnectionStatus;
  message?: string;
}

const MISSING_MESSAGE =
  'AI brain not connected — add a DeepSeek or OpenAI key in Settings → Integrations → Company AI Brain and Save.';

const MISSING_MESSAGE_NON_ADMIN =
  'Company AI not configured yet — ask your Super Admin to add a DeepSeek or OpenAI key in Integrations.';

export async function checkOpenAIConnection(options?: {
  role?: string;
}): Promise<OpenAIConnectionState> {
  await syncActiveOrgFromProfile();
  const openaiConfig = integrationService.getConfig('openai');
  const provider = openaiConfig.provider === 'deepseek' ? 'deepseek' : 'openai';
  const apiKey = integrationService.getLiveOpenAIApiKey();
  const deepseekApiKey = integrationService.isLiveOpenAIApiKey(openaiConfig.deepseekApiKey)
    ? openaiConfig.deepseekApiKey.trim()
    : undefined;
  const body: Record<string, string> = { provider };
  if (apiKey) body.apiKey = apiKey;
  if (deepseekApiKey) body.deepseekApiKey = deepseekApiKey;

  const hasLocalBrain = provider === 'deepseek' ? Boolean(deepseekApiKey) : Boolean(apiKey);

  try {
    const response = await fetch('/api/ai/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (hasLocalBrain) {
        return { status: 'connected' };
      }
      return {
        status: 'missing',
        message: options?.role === 'super_admin' ? MISSING_MESSAGE : MISSING_MESSAGE_NON_ADMIN,
      };
    }

    const data = await response.json() as {
      connected?: boolean;
      reason?: 'missing' | 'rejected';
      message?: string;
    };

    if (data.connected) {
      return { status: 'connected' };
    }

    if (data.reason === 'rejected') {
      return {
        status: 'rejected',
        message: data.message ?? 'AI key rejected — check the key and billing on your provider account.',
      };
    }

    if (hasLocalBrain) {
      return { status: 'connected' };
    }

    const fallback =
      options?.role === 'super_admin' || options?.role === 'platform_owner'
        ? MISSING_MESSAGE
        : MISSING_MESSAGE_NON_ADMIN;

    return {
      status: 'missing',
      message: data.message ?? fallback,
    };
  } catch {
    if (hasLocalBrain) {
      return { status: 'connected' };
    }
    return {
      status: 'missing',
      message: options?.role === 'super_admin' ? MISSING_MESSAGE : MISSING_MESSAGE_NON_ADMIN,
    };
  }
}

export function connectionFromOrchestratorError(err: unknown): OpenAIConnectionState | null {
  if (!(err instanceof Error)) return null;
  const message = err.message;
  if (/openai not connected|deepseek api key not configured|not configured for this company|ai brain not connected/i.test(message)) {
    return { status: 'missing', message };
  }
  if (/openai key rejected|deepseek.*rejected|key rejected/i.test(message)) {
    return { status: 'rejected', message };
  }
  if (
    /ai service unavailable/i.test(message)
    || (/503/.test(message) && /openai|deepseek|api key|not connected|not configured/i.test(message))
  ) {
    return { status: 'missing', message: MISSING_MESSAGE };
  }
  return null;
}
