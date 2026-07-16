import { integrationService } from '../integrations/integrationService';
import { syncActiveOrgFromProfile } from '../platform/orgContext';

export type OpenAIConnectionStatus = 'checking' | 'connected' | 'missing' | 'rejected';

export interface OpenAIConnectionState {
  status: OpenAIConnectionStatus;
  message?: string;
}

const MISSING_MESSAGE =
  'OpenAI not connected — add your API key in Settings → Integrations → Company AI Brain and Save.';

const MISSING_MESSAGE_NON_ADMIN =
  'Company AI not configured yet — ask your Super Admin to add an OpenAI key in Integrations.';

export async function checkOpenAIConnection(options?: {
  role?: string;
}): Promise<OpenAIConnectionState> {
  await syncActiveOrgFromProfile();
  const apiKey = integrationService.getLiveOpenAIApiKey();
  const body: Record<string, string> = {};
  if (apiKey) body.apiKey = apiKey;

  try {
    const response = await fetch('/api/ai/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      if (apiKey) {
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
        message: data.message ?? 'OpenAI key rejected — check the key and billing on your OpenAI account.',
      };
    }

    // Client has a key that will be sent on /api/ai/orchestrate — don't lock the
    // overlay when the health probe only checks server env and reports missing.
    if (apiKey) {
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
    // Health probe can 502 when the Vite proxy flaps — if a live key is already
    // configured locally, allow chat (main Cynthia / overlay share the same key).
    if (apiKey) {
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
  if (/openai not connected|not configured for this company/i.test(message)) {
    return { status: 'missing', message };
  }
  if (/openai key rejected/i.test(message)) {
    return { status: 'rejected', message };
  }
  // Only treat as "OpenAI missing" when the 503 is actually about the AI key/service —
  // not when a tool/orchestrator bug returns a generic HTTP 503 with an unrelated message.
  if (
    /ai service unavailable/i.test(message)
    || (/503/.test(message) && /openai|api key|not connected|not configured/i.test(message))
  ) {
    return { status: 'missing', message: MISSING_MESSAGE };
  }
  return null;
}
