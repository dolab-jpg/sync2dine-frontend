import { INTEGRATION_REGISTRY, getIntegrationDefinition } from '../../config/integrations/registry';
import type {
  IntegrationId,
  IntegrationInstanceState,
  IntegrationsStoreData,
  IntegrationStatus,
  TestConnectionResult,
} from '../../config/integrations/types';
import {
  loadIntegrationsStore,
  saveIntegrationsStore,
  peekLegacyIntegrationSecrets,
  clearLegacyIntegrationSecretsFromLocalStorage,
  isSecretIntegrationField,
  getIntegrationValues,
} from './integrationsStore';
import { saveCompanyProfileToSupabase, initCompanyProfile, getCompanyProfile } from './companyProfileSync';
import { initOrgOpenAIKey as hydrateOrgOpenAIKey, saveOrgOpenAIKey } from './orgOpenAIKeySync';
import { fetchOrgIntegrations, fetchOrgIntegrationsStatus, putOrgIntegration, testOrgIntegration } from './orgIntegrationsApi';
import { useCloudPersistence } from '../data/cloudPersist';

type StoreListener = (data: IntegrationsStoreData) => void;
const listeners = new Set<StoreListener>();

let serverHydrated = false;
let migratePromise: Promise<void> | null = null;

function notify() {
  const data = loadIntegrationsStore();
  listeners.forEach(fn => fn(data));
}

function isPlaceholderSecret(value?: string): boolean {
  const v = value?.trim() ?? '';
  if (!v) return true;
  if (v.startsWith('••••')) return true;
  if (v === '(configured on server)') return true;
  return false;
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

  /** True when stored value is a real secret, not a masked UI placeholder. */
  isLiveOpenAIApiKey(value?: string): boolean {
    return !isPlaceholderSecret(value);
  },

  /**
   * Returns a real local OpenAI API key for request bodies, or undefined.
   * Company org keys are resolved server-side via X-Org-Id — do not send masks.
   */
  getLiveOpenAIApiKey(): string | undefined {
    const key = integrationService.getConfig('openai').apiKey?.trim();
    return integrationService.isLiveOpenAIApiKey(key) ? key : undefined;
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
    updates: Partial<Pick<IntegrationInstanceState, 'enabled' | 'mockMode' | 'values' | 'status' | 'lastTestedAt' | 'lastTestError'>>
  ): void {
    const store = loadIntegrationsStore();
    store.integrations[id] = { ...store.integrations[id], ...updates };
    if (updates.values) {
      store.integrations[id].values = { ...store.integrations[id].values, ...updates.values };
    }
    saveIntegrationsStore(store);
    if (id === 'company' && useCloudPersistence()) {
      void saveCompanyProfileToSupabase(store.integrations.company);
    }
    // Persist enabled/mock/status toggles to server (skip when a values save is in flight — that path PUTs itself)
    if (
      useCloudPersistence()
      && updates.values === undefined
      && (updates.enabled !== undefined || updates.mockMode !== undefined || updates.status !== undefined)
    ) {
      void putOrgIntegration(id, {
        enabled: store.integrations[id].enabled,
        mockMode: store.integrations[id].mockMode,
        status: store.integrations[id].status,
        role: 'super_admin',
      }).catch(() => { /* best-effort */ });
    }
    notify();
  },

  /** True when required credential fields are filled (including server-masked configured secrets). */
  hasCredentials(id: IntegrationId, values: Record<string, string>): boolean {
    const def = getIntegrationDefinition(id);
    if (!def) return false;
    if (id === 'email_oauth') {
      const google = Boolean(values.googleClientId?.trim() && values.googleClientSecret?.trim());
      const microsoft = Boolean(values.microsoftClientId?.trim() && values.microsoftClientSecret?.trim());
      const yahoo = Boolean(values.yahooClientId?.trim() && values.yahooClientSecret?.trim());
      return google || microsoft || yahoo;
    }
    if (id === 'google_calendar') {
      if (values.clientId?.trim() && values.clientSecret?.trim()) return true;
      // Fall back: Mailbox OAuth Google credentials can power Calendar connect
      const mail = getIntegrationValues('email_oauth');
      return Boolean(mail.googleClientId?.trim() && mail.googleClientSecret?.trim());
    }
    if (id === 'company' || id === 'whatsapp') {
      return def.fields.some(f => Boolean(values[f.key]?.trim()));
    }
    // Company AI Brain: credentials depend on primary provider (DeepSeek can be sole brain).
    if (id === 'openai') {
      const provider = values.provider === 'deepseek' ? 'deepseek' : 'openai';
      if (provider === 'deepseek') {
        return Boolean(values.deepseekApiKey?.trim());
      }
      return Boolean(values.apiKey?.trim());
    }
    const credentialFields = def.fields.filter(
      (f) => f.required === true || (f.type === 'password' && (f.key === 'apiKey' || f.required)),
    );
    if (credentialFields.length === 0) {
      // Any password field with a value (including mask) or any filled field
      const hasSecret = def.fields.some(f => f.type === 'password' && Boolean(values[f.key]?.trim()));
      if (hasSecret) return true;
      return def.fields.some(f => Boolean(values[f.key]?.trim()));
    }
    return credentialFields.every(f => Boolean(values[f.key]?.trim()));
  },

  /**
   * Hydrate from GET /api/org/integrations/status (Supabase + env + runtime).
   * Falls back to list + voice-config style client probes if status is unavailable.
   */
  async initIntegrationsFromServer(): Promise<void> {
    const applyRemote = (remote: Awaited<ReturnType<typeof fetchOrgIntegrationsStatus>>) => {
      if (!remote?.integrations?.length) return false;
      const store = loadIntegrationsStore();
      if (typeof window !== 'undefined' && window.location.host.includes('sync2dine.io')) {
        store.environment = 'production';
      }
      for (const item of remote.integrations) {
        const id = item.integrationId as IntegrationId;
        if (!store.integrations[id]) continue;
        const current = store.integrations[id];
        const values = {
          ...current.values,
          ...item.values,
        };
        for (const [k, hint] of Object.entries(item.configuredFields || {})) {
          // Never overwrite a real typed secret with a mask/placeholder
          if (integrationService.isLiveOpenAIApiKey(values[k]) && isSecretIntegrationField(k)) {
            continue;
          }
          if (!values[k]?.trim() || isPlaceholderSecret(values[k])) {
            values[k] = hint;
          }
        }
        store.integrations[id] = {
          ...current,
          enabled: item.enabled || item.status === 'connected',
          mockMode: item.status === 'connected' ? false : item.mockMode,
          status: item.status,
          values,
        };
        if ((id === 'openai' || id === 'vapi' || id === 'elevenlabs') && item.status === 'connected') {
          store.masterMockMode = false;
        }
      }
      saveIntegrationsStore(store);
      serverHydrated = true;
      notify();
      return true;
    };

    const statusRemote = await fetchOrgIntegrationsStatus();
    if (applyRemote(statusRemote)) {
      await integrationService.migrateLegacySecretsOnce();
      return;
    }

    const remote = await fetchOrgIntegrations();
    applyRemote(remote);
    await integrationService.migrateLegacySecretsOnce();
  },

  async migrateLegacySecretsOnce(): Promise<void> {
    if (migratePromise) return migratePromise;
    migratePromise = (async () => {
      const legacy = peekLegacyIntegrationSecrets();
      if (!legacy) return;
      const ids = Object.keys(legacy) as IntegrationId[];
      for (const id of ids) {
        const secrets = legacy[id];
        if (!secrets) continue;
        try {
          const current = loadIntegrationsStore().integrations[id];
          await putOrgIntegration(id, {
            values: { ...current.values, ...secrets },
            enabled: true,
            mockMode: false,
            status: current.status === 'error' ? 'error' : 'connected',
            role: 'super_admin',
          });
        } catch {
          // leave local for retry
          return;
        }
      }
      clearLegacyIntegrationSecretsFromLocalStorage();
      // Re-hydrate masks from server
      const remote = await fetchOrgIntegrations();
      if (remote?.integrations) {
        const store = loadIntegrationsStore();
        for (const item of remote.integrations) {
          const id = item.integrationId as IntegrationId;
          if (!store.integrations[id]) continue;
          const values = { ...store.integrations[id].values, ...item.values };
          for (const [k, hint] of Object.entries(item.configuredFields || {})) {
            values[k] = hint;
          }
          store.integrations[id] = {
            ...store.integrations[id],
            enabled: item.enabled,
            mockMode: item.mockMode,
            status: item.status,
            values,
          };
        }
        saveIntegrationsStore(store);
        notify();
      }
    })();
    return migratePromise;
  },

  /**
   * Save integration field values — secrets go to Supabase via server API.
   */
  async saveIntegrationValues(id: IntegrationId, values: Record<string, string>): Promise<void> {
    const updates: Partial<IntegrationInstanceState> = { values };
    if (integrationService.hasCredentials(id, values)) {
      updates.enabled = true;
      updates.mockMode = false;
      if (id === 'openai' || id === 'email_oauth') {
        integrationService.setMasterMockMode(false);
        updates.mockMode = false;
      }
    }
    integrationService.updateIntegration(id, updates);

    if (id === 'company') {
      void import('../cyrus/cyrusThreadApi').then(({ syncCompanySettingsToServer }) =>
        syncCompanySettingsToServer(values.website, values.companyName),
      );
    }

    if ((id === 'vapi' || id === 'elevenlabs') && integrationService.hasCredentials(id, values)) {
      const liveValues: Record<string, string> = {};
      for (const [k, v] of Object.entries(values)) {
        if (isSecretIntegrationField(k) && isPlaceholderSecret(v)) continue;
        liveValues[k] = v;
      }
      fetch('/api/integrations/voice-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration: id, values: liveValues }),
      }).catch(() => { /* best-effort env push */ });
    }

    // Persist to Supabase (encrypted secrets server-side)
    const payloadValues: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (isSecretIntegrationField(k) && isPlaceholderSecret(v)) continue;
      payloadValues[k] = v;
    }

    try {
      const saved = await putOrgIntegration(id, {
        values: payloadValues,
        enabled: loadIntegrationsStore().integrations[id].enabled,
        mockMode: loadIntegrationsStore().integrations[id].mockMode,
        status: integrationService.hasCredentials(id, values) ? 'connected' : undefined,
        role: 'super_admin',
      });
      const store = loadIntegrationsStore();
      const nextValues = { ...store.integrations[id].values, ...saved.values };
      for (const [k, hint] of Object.entries(saved.configuredFields || {})) {
        // If user just typed a live key, keep showing mask after save
        if (!integrationService.isLiveOpenAIApiKey(values[k]) || isSecretIntegrationField(k)) {
          if (isPlaceholderSecret(values[k]) || !values[k]?.trim()) {
            nextValues[k] = hint;
          } else if (isSecretIntegrationField(k)) {
            nextValues[k] = hint;
          }
        }
      }
      store.integrations[id] = {
        ...store.integrations[id],
        enabled: saved.enabled,
        mockMode: saved.mockMode,
        status: saved.status,
        values: nextValues,
        lastTestError: saved.cloudSyncWarning,
      };
      saveIntegrationsStore(store);
      notify();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const orgRouteMissing = /not found/i.test(msg);
      // Live API may lag behind SPA: org integrations PUT 404s while /api/integrations/test still saves disk secrets.
      if (
        orgRouteMissing
        && (id === 'google_calendar' || id === 'email_oauth')
        && Object.keys(payloadValues).length > 0
      ) {
        const res = await fetch('/api/integrations/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ integrationId: id, values: payloadValues }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          message?: string;
          status?: IntegrationStatus;
          error?: string;
        };
        if (!res.ok || data.success === false) {
          throw new Error(data.error || data.message || msg);
        }
        const store = loadIntegrationsStore();
        const nextValues = { ...store.integrations[id].values, ...payloadValues };
        for (const [k, v] of Object.entries(payloadValues)) {
          if (isSecretIntegrationField(k) && v?.trim()) {
            nextValues[k] = `••••${v.slice(-4)}`;
          }
        }
        store.integrations[id] = {
          ...store.integrations[id],
          enabled: true,
          mockMode: false,
          status: (data.status as IntegrationStatus) || 'connected',
          values: nextValues,
          lastTestError: undefined,
        };
        saveIntegrationsStore(store);
        notify();
      } else if (id !== 'openai') {
        throw err;
      }
      // Fall through to OpenAI-specific path below if put failed for openai
    }

    if (id === 'openai' && integrationService.hasCredentials(id, values)) {
      const provider = values.provider === 'deepseek' ? 'deepseek' : 'openai';
      const apiKey = values.apiKey?.trim() || '';
      const deepseekApiKey = values.deepseekApiKey?.trim() || '';
      const liveOpenAI = integrationService.isLiveOpenAIApiKey(apiKey);
      const liveDeepSeek = integrationService.isLiveOpenAIApiKey(deepseekApiKey);
      try {
        const status = await saveOrgOpenAIKey(liveOpenAI ? apiKey : '', 'super_admin', {
          deepseekApiKey: liveDeepSeek ? deepseekApiKey : (deepseekApiKey === '' ? '' : undefined),
          provider,
        });
        const probeFailed = status.probeMessage && status.connected === false;
        integrationService.updateIntegration('openai', {
          enabled: true,
          mockMode: false,
          status: probeFailed ? 'error' : 'connected',
          lastTestedAt: new Date().toISOString(),
          lastTestError: status.probeMessage || status.cloudSyncWarning,
        });
        if (!probeFailed) {
          const health = await fetch('/api/ai/health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              apiKey: liveOpenAI ? apiKey : undefined,
              deepseekApiKey: liveDeepSeek ? deepseekApiKey : undefined,
              provider,
            }),
          });
          const healthData = await health.json().catch(() => ({})) as {
            connected?: boolean;
            message?: string;
            warning?: string;
            provider?: string;
          };
          if (healthData.connected) {
            integrationService.updateIntegration('openai', {
              status: 'connected',
              lastTestError: healthData.warning || status.cloudSyncWarning,
            });
          } else {
            integrationService.updateIntegration('openai', {
              status: 'error',
              lastTestError: healthData.message || 'AI brain health check failed',
            });
          }
        }
        notify();
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to activate company AI brain';
        integrationService.updateIntegration('openai', {
          status: 'error',
          lastTestError: message,
          lastTestedAt: new Date().toISOString(),
        });
        notify();
        throw err;
      }
    }
  },

  getStatus(id: IntegrationId): IntegrationStatus {
    const inst = loadIntegrationsStore().integrations[id];
    if (!inst) return 'not_configured';
    if (id === 'openai' && inst.status === 'connected' && !integrationService.isMasterMockMode()) {
      return 'connected';
    }
    if (integrationService.isMockMode(id) && inst.enabled && id !== 'openai') return 'mock';
    if (id === 'openai' && integrationService.isMasterMockMode() && inst.status !== 'connected') {
      return 'mock';
    }
    return inst.status;
  },

  getConnectedCount(): number {
    const store = loadIntegrationsStore();
    return INTEGRATION_REGISTRY.filter(def => {
      const inst = store.integrations[def.id];
      return inst.enabled && (inst.status === 'connected' || inst.status === 'mock');
    }).length;
  },

  getStatusSummary(): { connected: number; notConfigured: number; error: number; mock: number; total: number } {
    const store = loadIntegrationsStore();
    let connected = 0;
    let notConfigured = 0;
    let error = 0;
    let mock = 0;
    for (const def of INTEGRATION_REGISTRY) {
      const status = integrationService.getStatus(def.id);
      if (status === 'connected') connected += 1;
      else if (status === 'error') error += 1;
      else if (status === 'mock') mock += 1;
      else notConfigured += 1;
    }
    return { connected, notConfigured, error, mock, total: INTEGRATION_REGISTRY.length };
  },

  getCompanyName(): string {
    return integrationService.getConfig('company').companyName || 'Builder Diddies';
  },

  getCompanyProfile(): ReturnType<typeof getCompanyProfile> {
    return getCompanyProfile();
  },

  async initCompanyProfile(): Promise<void> {
    await initCompanyProfile();
    await hydrateOrgOpenAIKey();
    await integrationService.initIntegrationsFromServer();
    notify();
  },

  /** Load org-wide OpenAI key status for all users (staff/customers included). */
  async initOrgOpenAIKey(role?: string): Promise<boolean> {
    const configured = await hydrateOrgOpenAIKey(role);
    notify();
    return configured;
  },

  wasServerHydrated(): boolean {
    return serverHydrated;
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

    if ((store.masterMockMode || inst.mockMode) && id !== 'openai') {
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

    // Prefer server-side test (uses decrypted secrets from Supabase)
    try {
      const liveOverrides: Record<string, string> = {};
      for (const [k, v] of Object.entries(inst.values)) {
        if (isSecretIntegrationField(k) && isPlaceholderSecret(v)) continue;
        liveOverrides[k] = v;
      }
      const result = await testOrgIntegration(id, liveOverrides, 'super_admin');
      integrationService.updateIntegration(id, {
        status: result.status,
        lastTestedAt: new Date().toISOString(),
        lastTestError: result.success ? undefined : result.message,
        ...(result.success ? { enabled: true, mockMode: false } : {}),
      });
      if (result.success && id === 'openai') {
        integrationService.setMasterMockMode(false);
      }
      return result;
    } catch {
      // fall through to legacy paths
    }

    if (id === 'openai') {
      try {
        const apiKey = inst.values.apiKey?.trim();
        const res = await fetch('/api/ai/health', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiKey: integrationService.isLiveOpenAIApiKey(apiKey) ? apiKey : undefined,
            deepseekApiKey: isPlaceholderSecret(inst.values.deepseekApiKey) ? undefined : inst.values.deepseekApiKey,
            provider: inst.values.provider || 'openai',
          }),
        });
        const data = await res.json() as {
          connected?: boolean;
          message?: string;
          warning?: string;
          provider?: string;
        };
        if (data.connected) {
          integrationService.updateIntegration(id, {
            status: 'connected',
            lastTestedAt: new Date().toISOString(),
            lastTestError: data.warning,
            mockMode: false,
            enabled: true,
          });
          integrationService.setMasterMockMode(false);
          const label = (data.provider || inst.values.provider) === 'deepseek' ? 'DeepSeek' : 'OpenAI';
          return {
            success: true,
            message: data.warning
              ? `Company AI Brain connected (${label}) — ${data.warning}`
              : `Company AI Brain connected (${label})`,
            status: 'connected',
          };
        }
        const message = data.message || 'AI brain connection failed';
        integrationService.updateIntegration(id, {
          status: 'error',
          lastTestedAt: new Date().toISOString(),
          lastTestError: message,
        });
        return { success: false, message, status: 'error' };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'AI brain health check failed';
        integrationService.updateIntegration(id, {
          status: 'error',
          lastTestedAt: new Date().toISOString(),
          lastTestError: message,
        });
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
