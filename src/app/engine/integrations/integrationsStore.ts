import { INTEGRATION_REGISTRY, getDefaultFieldValues } from '../../config/integrations/registry';
import type {
  IntegrationId,
  IntegrationInstanceState,
  IntegrationsStoreData,
} from '../../config/integrations/types';
import { getActiveOrgId } from '../platform/orgContext';
import { BDIDDIES_HOME_ORG_ID } from '../platform/homeOrg';

function storageKey(): string {
  const orgId = getActiveOrgId() || BDIDDIES_HOME_ORG_ID;
  return `integrations:${orgId}`;
}

function createDefaultInstance(id: IntegrationId): IntegrationInstanceState {
  const def = INTEGRATION_REGISTRY.find(i => i.id === id)!;
  return {
    enabled: id === 'company',
    mockMode: id !== 'mongodb',
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

    return {
      ...defaults,
      ...parsed,
      integrations: { ...defaults.integrations, ...parsed.integrations },
    };
  } catch {
    return createDefaultStore();
  }
}

export function saveIntegrationsStore(data: IntegrationsStoreData): void {
  data.updatedAt = new Date().toISOString();
  localStorage.setItem(storageKey(), JSON.stringify(data));
}

export function getIntegrationValues(id: IntegrationId): Record<string, string> {
  return loadIntegrationsStore().integrations[id]?.values ?? {};
}
