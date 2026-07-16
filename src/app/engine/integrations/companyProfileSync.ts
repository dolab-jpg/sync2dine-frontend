import { useCloudPersistence } from '../data/cloudPersist';
import { getSupabase, isSupabaseConfigured, getOrgId } from '../../../lib/supabase/client';
import type { IntegrationInstanceState } from '../../config/integrations/types';
import { loadIntegrationsStore, saveIntegrationsStore } from './integrationsStore';

const DEFAULT_ORG = '00000000-0000-0000-0000-000000000001';

async function resolveOrg(): Promise<string> {
  const orgId = await getOrgId();
  return orgId ?? DEFAULT_ORG;
}

export interface CompanyProfileValues extends Record<string, string> {
  companyName?: string;
  website?: string;
  companyRegistrationNumber?: string;
  vatNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoUrl?: string;
  /** Durable storage path under project-files (e.g. company/logo.png) — used to refresh signed logoUrl */
  logoStoragePath?: string;
  accountName?: string;
  sortCode?: string;
  accountNumber?: string;
}

export async function loadCompanyProfileFromSupabase(): Promise<Partial<IntegrationInstanceState> | null> {
  if (!isSupabaseConfigured()) return null;
  const supabase = getSupabase();
  const orgId = await resolveOrg();
  const { data, error } = await supabase
    .from('integrations')
    .select('enabled, mock_mode, values_encrypted, status')
    .eq('org_id', orgId)
    .eq('integration_id', 'company')
    .maybeSingle();
  if (error || !data) return null;
  const values = (data.values_encrypted ?? {}) as Record<string, string>;
  return {
    enabled: data.enabled ?? true,
    mockMode: data.mock_mode ?? false,
    values,
    status: (data.status === 'connected' ? 'connected' : data.status === 'error' ? 'error' : 'not_configured') as IntegrationInstanceState['status'],
  };
}

export async function saveCompanyProfileToSupabase(
  instance: Pick<IntegrationInstanceState, 'enabled' | 'mockMode' | 'values' | 'status'>
): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();
  const orgId = await resolveOrg();
  await supabase.from('integrations').upsert(
    {
      org_id: orgId,
      integration_id: 'company',
      enabled: instance.enabled ?? true,
      mock_mode: instance.mockMode ?? false,
      values_encrypted: instance.values ?? {},
      status: instance.status === 'connected' ? 'connected' : instance.status === 'error' ? 'error' : 'connected',
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'org_id,integration_id' }
  );
}

let initPromise: Promise<void> | null = null;

/** Merge company profile from Supabase into the integrations store (cloud mode only). */
export async function initCompanyProfile(): Promise<void> {
  if (!useCloudPersistence()) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    const remote = await loadCompanyProfileFromSupabase();
    if (!remote?.values) return;
    const store = loadIntegrationsStore();
    const values = { ...store.integrations.company.values, ...remote.values };

    // Refresh short-lived signed logo URLs from durable storage path.
    const storagePath = String(values.logoStoragePath || '').trim();
    let logoPath = storagePath;
    if (!logoPath && values.logoUrl) {
      const m = String(values.logoUrl).match(/\/project-files\/([^?]+)/);
      if (m?.[1]) {
        try {
          logoPath = decodeURIComponent(m[1]).replace(/^[^/]+\//, ''); // strip org prefix if present
          if (logoPath.includes('/company/')) {
            logoPath = logoPath.slice(logoPath.indexOf('company/'));
          } else if (!logoPath.startsWith('company/')) {
            logoPath = '';
          }
        } catch {
          logoPath = '';
        }
      }
    }
    if (logoPath) {
      values.logoStoragePath = logoPath;
      try {
        const { getSignedFileUrl } = await import('../data/supabaseStore');
        const fresh = await getSignedFileUrl('project-files', logoPath);
        if (fresh) values.logoUrl = fresh;
      } catch {
        // keep existing logoUrl
      }
    }

    store.integrations.company = {
      ...store.integrations.company,
      ...remote,
      values,
    };
    saveIntegrationsStore(store);
  })();
  return initPromise;
}

export function getCompanyProfile(): CompanyProfileValues {
  return loadIntegrationsStore().integrations.company?.values ?? {};
}
