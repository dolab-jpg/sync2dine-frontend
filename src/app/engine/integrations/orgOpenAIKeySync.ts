import { loadIntegrationsStore, saveIntegrationsStore } from './integrationsStore';

export interface OrgOpenAIKeyStatus {
  configured: boolean;
  maskedHint?: string;
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

export async function saveOrgOpenAIKey(apiKey: string, role = 'super_admin'): Promise<OrgOpenAIKeyStatus> {
  const res = await fetch('/api/org/openai-key', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-User-Role': role,
    },
    body: JSON.stringify({ apiKey, role }),
  });
  const data = (await res.json().catch(() => ({}))) as OrgOpenAIKeyStatus & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || 'Failed to save company OpenAI key');
  }
  return data;
}

/**
 * Hydrate Integrations Hub from the org-wide key (source of truth for all users).
 * Does not expose the full key — only marks OpenAI as connected/live when configured.
 */
export async function initOrgOpenAIKey(role?: string): Promise<void> {
  const status = await fetchOrgOpenAIKeyStatus(role);
  if (!status?.configured) return;

  const store = loadIntegrationsStore();
  const current = store.integrations.openai;
  store.masterMockMode = false;
  store.integrations.openai = {
    ...current,
    enabled: true,
    mockMode: false,
    status: 'connected',
    values: {
      ...current.values,
      // Keep any locally typed key for Super Admin edits; otherwise show masked placeholder.
      apiKey: current.values.apiKey?.trim()
        ? current.values.apiKey
        : (status.maskedHint || '••••configured'),
    },
  };
  saveIntegrationsStore(store);
}
