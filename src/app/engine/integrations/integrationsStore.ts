import { INTEGRATION_REGISTRY, getDefaultFieldValues, getIntegrationDefinition } from '../../config/integrations/registry';
import type {
  IntegrationId,
  IntegrationInstanceState,
  IntegrationsStoreData,
} from '../../config/integrations/types';
import { getActiveOrgId } from '../platform/orgContext';
import { BDIDDIES_HOME_ORG_ID } from '../platform/homeOrg';
import { useCloudPersistence } from '../data/cloudPersist';

/** Password / secret field keys — never persist plaintext to localStorage when cloud is on. */
const SECRET_FIELD_KEYS = new Set(
  INTEGRATION_REGISTRY.flatMap((def) =>
    def.fields.filter((f) => f.type === 'password').map((f) => f.key),
  ),
);

function storageKey(): string {
  const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
  return `integrations:${orgId}`;
}

function createDefaultInstance(id: IntegrationId): IntegrationInstanceState {
  const def = INTEGRATION_REGISTRY.find(i => i.id === id)!;
  return {
    enabled: id === 'company',
    mockMode: true,
    values: getDefaultFieldValues(def),
    status: 'not_configured',
  };
}

function createDefaultStore(): IntegrationsStoreData {
  const integrations = {} as Record<IntegrationId, IntegrationInstanceState>;
  for (const def of INTEGRATION_REGISTRY) {
    integrations[def.id] = createDefaultInstance(def.id);
  }
  return {
    masterMockMode: true,
    environment: 'local',
    integrations,
    updatedAt: new Date().toISOString(),
  };
}

/** Strip live secrets before writing to localStorage (cloud / go-live path). */
function sanitizeForLocalStorage(data: IntegrationsStoreData): IntegrationsStoreData {
  if (!useCloudPersistence()) {
    // Even without cloud: avoid leaving plaintext secrets in localStorage long-term —
    // keep non-secret UI state only when a field looks like a real key (sk-, etc.).
    // Still allow local drafts in non-cloud by keeping values; cloud mode is strict.
    return data;
  }
  const integrations = {} as Record<IntegrationId, IntegrationInstanceState>;
  for (const def of INTEGRATION_REGISTRY) {
    const inst = data.integrations[def.id] ?? createDefaultInstance(def.id);
    const values: Record<string, string> = {};
    for (const [k, v] of Object.entries(inst.values || {})) {
      if (SECRET_FIELD_KEYS.has(k)) {
        // Keep only masked placeholders for UI restore
        if (v?.startsWith('••••') || v === '(configured on server)') {
          values[k] = v;
        }
        // else drop plaintext secret
      } else {
        values[k] = v;
      }
    }
    integrations[def.id] = { ...inst, values };
  }
  return { ...data, integrations };
}

export function isSecretIntegrationField(key: string): boolean {
  return SECRET_FIELD_KEYS.has(key);
}

export function loadIntegrationsStore(): IntegrationsStoreData {
  try {
    const key = storageKey();
    let raw = localStorage.getItem(key);
    // Migrate legacy global key once into current org bucket
    if (!raw && key !== 'integrations') {
      const legacy = localStorage.getItem('integrations');
      if (legacy) {
        raw = legacy;
        localStorage.setItem(key, legacy);
      }
    }
    if (!raw) return createDefaultStore();

    const parsed = JSON.parse(raw) as IntegrationsStoreData;
    const defaults = createDefaultStore();

    for (const def of INTEGRATION_REGISTRY) {
      if (!parsed.integrations[def.id]) {
        parsed.integrations[def.id] = defaults.integrations[def.id];
      } else {
        parsed.integrations[def.id].values = {
          ...defaults.integrations[def.id].values,
          ...parsed.integrations[def.id].values,
        };
      }
    }

    const integrations = {} as Record<IntegrationId, IntegrationInstanceState>;
    for (const def of INTEGRATION_REGISTRY) {
      integrations[def.id] = parsed.integrations[def.id] ?? defaults.integrations[def.id];
    }

    return {
      ...defaults,
      ...parsed,
      integrations,
    };
  } catch {
    return createDefaultStore();
  }
}

export function saveIntegrationsStore(data: IntegrationsStoreData): void {
  data.updatedAt = new Date().toISOString();
  const toWrite = sanitizeForLocalStorage(data);
  localStorage.setItem(storageKey(), JSON.stringify(toWrite));
}

export function getIntegrationValues(id: IntegrationId): Record<string, string> {
  return loadIntegrationsStore().integrations[id]?.values ?? {};
}

/** Read raw localStorage (including secrets) for one-time migration to Supabase. */
export function peekLegacyIntegrationSecrets(): Partial<Record<IntegrationId, Record<string, string>>> | null {
  try {
    const key = storageKey();
    const raw = localStorage.getItem(key) || localStorage.getItem('integrations');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as IntegrationsStoreData;
    const out: Partial<Record<IntegrationId, Record<string, string>>> = {};
    let found = false;
    for (const def of INTEGRATION_REGISTRY) {
      const vals = parsed.integrations?.[def.id]?.values;
      if (!vals) continue;
      const secrets: Record<string, string> = {};
      for (const [k, v] of Object.entries(vals)) {
        if (!SECRET_FIELD_KEYS.has(k)) continue;
        if (!v?.trim() || v.startsWith('••••') || v === '(configured on server)') continue;
        secrets[k] = v;
        found = true;
      }
      if (Object.keys(secrets).length) out[def.id] = secrets;
    }
    return found ? out : null;
  } catch {
    return null;
  }
}

export function clearLegacyIntegrationSecretsFromLocalStorage(): void {
  try {
    const store = loadIntegrationsStore();
    saveIntegrationsStore(sanitizeForLocalStorage({
      ...store,
      integrations: Object.fromEntries(
        INTEGRATION_REGISTRY.map((def) => {
          const inst = store.integrations[def.id];
          const values: Record<string, string> = {};
          for (const [k, v] of Object.entries(inst?.values || {})) {
            if (SECRET_FIELD_KEYS.has(k)) continue;
            values[k] = v;
          }
          return [def.id, { ...inst, values }];
        }),
      ) as Record<IntegrationId, IntegrationInstanceState>,
    }));
    localStorage.removeItem('integrations');
  } catch {
    // ignore
  }
}

export function getSecretFieldKeysFor(id: IntegrationId): string[] {
  const def = getIntegrationDefinition(id);
  if (!def) return [];
  return def.fields.filter((f) => f.type === 'password').map((f) => f.key);
}
