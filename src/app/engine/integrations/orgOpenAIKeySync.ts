import { loadIntegrationsStore, saveIntegrationsStore } from './integrationsStore';
import { getActiveOrgId } from '../platform/orgContext';

export interface OrgOpenAIKeyStatus {
  configured: boolean;
  maskedHint?: string;
  syncedToCloud?: boolean;
  cloudSyncWarning?: string;
  connected?: boolean;
  probeMessage?: string;
  provider?: 'openai' | 'deepseek';
  deepseekConfigured?: boolean;
  deepseekMaskedHint?: string;
}

function isRealLocalApiKey(value: string | undefined): boolean {
  const key = value?.trim() ?? '';
  if (!key) return false;
  if (key.startsWith('••••')) return false;
  return true;
}

async function fetchOrgOpenAIKeyStatus(role?: string): Promise<OrgOpenAIKeyStatus | null> {
  try {
    const res = await fetch('/api/org/openai-key', {
      headers: role ? { 'X-User-Role': role } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as OrgOpenAIKeyStatus;
  } catch {
    return null;
  }
}

export async function saveOrgOpenAIKey(
  apiKey: string,
  role = 'super_admin',
  extras?: { deepseekApiKey?: string; provider?: string },
): Promise<OrgOpenAIKeyStatus> {
  const res = await fetch('/api/org/openai-key', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': role,
    },
    body: JSON.stringify({
      apiKey,
      openaiApiKey: apiKey,
      deepseekApiKey: extras?.deepseekApiKey,
      provider: extras?.provider,
      role,
      probe: true,
      orgId: getActiveOrgId() || 'default',
    }),
  });
  const data = (await res.json().catch(() => ({}))) as OrgOpenAIKeyStatus & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save company OpenAI key');
  }
  return data;
}

/**
 * Hydrate Integrations Hub from the org-wide key (source of truth for all users).
 * Does not expose the full key — never writes a masked placeholder into apiKey.
 */
export async function initOrgOpenAIKey(role?: string): Promise<boolean> {
  const status = await fetchOrgOpenAIKeyStatus(role);
  if (!status?.configured && !status?.deepseekConfigured) return false;

  const store = loadIntegrationsStore();
  const current = store.integrations.openai;
  const localKey = current.values.apiKey;
  const localDeepseek = current.values.deepseekApiKey;
  store.masterMockMode = false;
  store.integrations.openai = {
    ...current,
    enabled: true,
    mockMode: false,
    status: status.configured || status.connected ? 'connected' : current.status,
    values: {
      ...current.values,
      provider: status.provider || current.values.provider || 'openai',
      // Keep a real Super Admin typed key; clear previous masked placeholders.
      apiKey: isRealLocalApiKey(localKey) ? localKey!.trim() : '',
      deepseekApiKey: isRealLocalApiKey(localDeepseek) ? localDeepseek!.trim() : '',
    },
    lastTestError: status.probeMessage || status.cloudSyncWarning,
  };
  saveIntegrationsStore(store);
  return Boolean(status.configured || status.deepseekConfigured);
}
