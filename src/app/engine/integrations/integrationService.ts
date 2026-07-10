import { INTEGRATION_REGISTRY, getIntegrationDefinition } from '../../config/integrations/registry';
import type {
  IntegrationId,
  IntegrationInstanceState,
  IntegrationsStoreData,
  IntegrationStatus,
  TestConnectionResult,
} from '../../config/integrations/types';
import { loadIntegrationsStore, saveIntegrationsStore } from './integrationsStore';

type StoreListener = (data: IntegrationsStoreData) => void;
const listeners = new Set<StoreListener>();

function notify() {
  const data = loadIntegrationsStore();
  listeners.forEach(fn => fn(data));
}

export const integrationService = {
  getStore(): IntegrationsStoreData {
    return loadIntegrationsStore();
  },

  subscribe(listener: StoreListener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  isMasterMockMode(): boolean {
    return loadIntegrationsStore().masterMockMode;
  },

  setMasterMockMode(enabled: boolean): void {
    const store = loadIntegrationsStore();
    store.masterMockMode = enabled;
    saveIntegrationsStore(store);
    notify();
  },

  setEnvironment(env: IntegrationsStoreData['environment']): void {
    const store = loadIntegrationsStore();
    store.environment = env;
    saveIntegrationsStore(store);
    notify();
  },

  getConfig(id: IntegrationId): Record<string, string> {
    return loadIntegrationsStore().integrations[id]?.values ?? {};
  },

  getInstance(id: IntegrationId): IntegrationInstanceState {
    return loadIntegrationsStore().integrations[id];
  },

  isEnabled(id: IntegrationId): boolean {
    const inst = loadIntegrationsStore().integrations[id];
    return inst?.enabled ?? false;
  },

  isMockMode(id?: IntegrationId): boolean {
    const store = loadIntegrationsStore();
    if (store.masterMockMode) return true;
    if (id) return store.integrations[id]?.mockMode ?? true;
    return false;
  },

  updateIntegration(
    id: IntegrationId,
    updates: Partial<Pick<IntegrationInstanceState, 'enabled' | 'mockMode' | 'values' | 'status'>>
  ): void {
    const store = loadIntegrationsStore();
    store.integrations[id] = { ...store.integrations[id], ...updates };
    if (updates.values) {
      store.integrations[id].values = { ...store.integrations[id].values, ...updates.values };
    }
    saveIntegrationsStore(store);
    notify();
  },

  /** True when required credential fields (e.g. apiKey) are filled in. */
  hasCredentials(id: IntegrationId, values: Record<string, string>): boolean {
    const def = getIntegrationDefinition(id);
    if (!def) return false;
    const credentialFields = def.fields.filter(
      f => f.required || f.type === 'password' || f.key === 'apiKey'
    );
    if (credentialFields.length === 0) {
      return def.fields.some(f => Boolean(values[f.key]?.trim()));
    }
    return credentialFields.every(f => Boolean(values[f.key]?.trim()));
  },

  /**
   * Save integration field values and switch to live mode when credentials are present.
   */
  saveIntegrationValues(id: IntegrationId, values: Record<string, string>): void {
    const updates: Partial<IntegrationInstanceState> = { values };
    if (integrationService.hasCredentials(id, values)) {
      updates.enabled = true;
      updates.mockMode = false;
      if (id === 'openai') {
        integrationService.setMasterMockMode(false);
      }
    }
    integrationService.updateIntegration(id, updates);
  },

  getStatus(id: IntegrationId): IntegrationStatus {
    const inst = loadIntegrationsStore().integrations[id];
    if (!inst) return 'not_configured';
    if (integrationService.isMockMode(id) && inst.enabled) return 'mock';
    return inst.status;
  },

  getConnectedCount(): number {
    const store = loadIntegrationsStore();
    return INTEGRATION_REGISTRY.filter(def => {
      const inst = store.integrations[def.id];
      return inst.enabled && (inst.status === 'connected' || inst.status === 'mock');
    }).length;
  },

  getCompanyName(): string {
    return integrationService.getConfig('company').companyName || 'TradePro Ltd';
  },

  getActiveEmailProvider(): IntegrationId | null {
    if (integrationService.isEnabled('email_resend') && integrationService.getConfig('email_resend').apiKey) {
      return 'email_resend';
    }
    if (integrationService.isEnabled('sendgrid') && integrationService.getConfig('sendgrid').apiKey) {
      return 'sendgrid';
    }
    if (integrationService.isEnabled('email_smtp') && integrationService.getConfig('email_smtp').host) {
      return 'email_smtp';
    }
    return null;
  },

  async testConnection(id: IntegrationId): Promise<TestConnectionResult> {
    const store = loadIntegrationsStore();
    const inst = store.integrations[id];
    const def = getIntegrationDefinition(id);

    if (!def) {
      return { success: false, message: 'Unknown integration', status: 'error' };
    }

    if (store.masterMockMode || inst.mockMode) {
      const message = store.masterMockMode
        ? 'Master mock mode is on — turn it off at the top of Integrations, then test again.'
        : 'Mock mode is on for this integration — turn off the Mock mode switch, then test again.';
      const result: TestConnectionResult = {
        success: false,
        message,
        status: 'mock',
      };
      integrationService.updateIntegration(id, {
        status: 'mock',
        lastTestedAt: new Date().toISOString(),
        lastTestError: message,
      });
      return result;
    }

    if (id === 'supabase') {
      const url = inst.values.projectUrl || import.meta.env.VITE_SUPABASE_URL;
      const key = inst.values.anonKey || import.meta.env.VITE_SUPABASE_ANON_KEY;
      if (!url || !key) {
        const message = 'Project URL and Anon Key required';
        integrationService.updateIntegration(id, { status: 'error', lastTestedAt: new Date().toISOString(), lastTestError: message });
        return { success: false, message, status: 'error' };
      }
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const client = createClient(url, key);
        const { error } = await client.from('organizations').select('id').limit(1);
        if (error) throw new Error(error.message);
        integrationService.updateIntegration(id, { status: 'connected', lastTestedAt: new Date().toISOString(), lastTestError: undefined });
        return { success: true, message: 'Supabase connection successful', status: 'connected' };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Supabase connection failed';
        integrationService.updateIntegration(id, { status: 'error', lastTestedAt: new Date().toISOString(), lastTestError: message });
        return { success: false, message, status: 'error' };
      }
    }

    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integrationId: id, values: inst.values }),
      });
      const data = await res.json() as TestConnectionResult & { error?: string };

      if (!res.ok || !data.success) {
        const message = data.message || data.error || 'Connection failed';
        integrationService.updateIntegration(id, {
          status: 'error',
          lastTestedAt: new Date().toISOString(),
          lastTestError: message,
        });
        return { success: false, message, status: 'error' };
      }

      integrationService.updateIntegration(id, {
        status: 'connected',
        lastTestedAt: new Date().toISOString(),
        lastTestError: undefined,
      });
      return data;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection test failed';
      integrationService.updateIntegration(id, {
        status: 'error',
        lastTestedAt: new Date().toISOString(),
        lastTestError: message,
      });
      return { success: false, message, status: 'error' };
    }
  },

  logAudit(integrationId: IntegrationId, userName: string): void {
    try {
      const logs = JSON.parse(localStorage.getItem('integrationAuditLogs') || '[]') as Array<{
        id: string;
        integrationId: string;
        userName: string;
        at: string;
      }>;
      logs.unshift({
        id: Date.now().toString(),
        integrationId,
        userName,
        at: new Date().toISOString(),
      });
      localStorage.setItem('integrationAuditLogs', JSON.stringify(logs.slice(0, 100)));
    } catch {
      // ignore
    }
  },
};
