import { integrationService } from '../integrations/integrationService';

export type OpenAIConnectionStatus = 'checking' | 'connected' | 'missing' | 'rejected';

export interface OpenAIConnectionState {
  status: OpenAIConnectionStatus;
  message?: string;
}

const MISSING_MESSAGE =
  'OpenAI not connected — add your API key in Settings → Integrations → OpenAI and Save.';

export async function checkOpenAIConnection(): Promise<OpenAIConnectionState> {
  const apiKey = integrationService.getConfig('openai').apiKey?.trim();

  try {
    const response = await fetch('/api/ai/health', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: apiKey || undefined }),
    });

    if (!response.ok) {
      return { status: 'missing', message: MISSING_MESSAGE };
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

    return {
      status: 'missing',
      message: data.message ?? MISSING_MESSAGE,
    };
  } catch {
    return { status: 'missing', message: MISSING_MESSAGE };
  }
}

export function connectionFromOrchestratorError(err: unknown): OpenAIConnectionState | null {
  if (!(err instanceof Error)) return null;
  const message = err.message;
  if (/openai not connected/i.test(message)) {
    return { status: 'missing', message };
  }
  if (/openai key rejected/i.test(message)) {
    return { status: 'rejected', message };
  }
  if (/503|ai service unavailable/i.test(message)) {
    return { status: 'missing', message: MISSING_MESSAGE };
  }
  return null;
}
