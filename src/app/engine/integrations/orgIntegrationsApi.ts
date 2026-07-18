import { ensureActiveOrgId, getActiveOrgId } from '../platform/orgContext';
import type { IntegrationId, IntegrationStatus } from '../../config/integrations/types';

export interface OrgIntegrationPublic {
  integrationId: string;
  enabled: boolean;
  mockMode: boolean;
  status: IntegrationStatus;
  values: Record<string, string>;
  configuredFields: Record<string, string>;
  hasSecrets: boolean;
  updatedAt?: string;
  source?: 'supabase' | 'memory' | 'none';
  syncedToCloud?: boolean;
  cloudSyncWarning?: string;
}

export interface OrgIntegrationsListResponse {
  orgId: string;
  integrations: OrgIntegrationPublic[];
  summary: {
    connected: number;
    notConfigured: number;
    error: number;
    mock: number;
    total: number;
  };
}

async function orgHeaders(role?: string): Promise<Record<string, string>> {
  const orgId = (await ensureActiveOrgId()) || getActiveOrgId() || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (orgId) headers['X-Org-Id'] = orgId;
  if (role) headers['X-User-Role'] = role;
  return headers;
}

export async function fetchOrgIntegrations(): Promise<OrgIntegrationsListResponse | null> {
  try {
    const headers = await orgHeaders();
    const res = await fetch('/api/org/integrations', { headers });
    // #region agent log
    fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'73adb0'},body:JSON.stringify({sessionId:'73adb0',runId:'pre-deploy',hypothesisId:'H1',location:'orgIntegrationsApi.ts:fetchOrgIntegrations',message:'GET /api/org/integrations response',data:{ok:res.ok,status:res.status,host:typeof window!=='undefined'?window.location.host:''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (!res.ok) return null;
    return (await res.json()) as OrgIntegrationsListResponse;
  } catch (err) {
    // #region agent log
    fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'73adb0'},body:JSON.stringify({sessionId:'73adb0',runId:'pre-deploy',hypothesisId:'H1',location:'orgIntegrationsApi.ts:fetchOrgIntegrations',message:'GET /api/org/integrations threw',data:{error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return null;
  }
}

export async function putOrgIntegration(
  id: IntegrationId,
  body: {
    values?: Record<string, string>;
    enabled?: boolean;
    mockMode?: boolean;
    status?: IntegrationStatus;
    role?: string;
  },
): Promise<OrgIntegrationPublic> {
  const headers = await orgHeaders(body.role || 'super_admin');
  const res = await fetch(`/api/org/integrations/${id}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      values: body.values,
      enabled: body.enabled,
      mockMode: body.mockMode,
      status: body.status,
      role: body.role || 'super_admin',
      orgId: getActiveOrgId() || undefined,
    }),
  });
  const data = (await res.json().catch(() => ({}))) as OrgIntegrationPublic & { error?: string };
  if (!res.ok) {
    throw new Error(data.error || `Failed to save ${id}`);
  }
  return data;
}

export async function testOrgIntegration(
  id: IntegrationId,
  values?: Record<string, string>,
  role = 'super_admin',
): Promise<{ success: boolean; message: string; status: IntegrationStatus }> {
  const headers = await orgHeaders(role);
  const res = await fetch(`/api/org/integrations/${id}/test`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ values, role, orgId: getActiveOrgId() || undefined }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    success?: boolean;
    message?: string;
    status?: IntegrationStatus;
    error?: string;
  };
  return {
    success: Boolean(data.success),
    message: data.message || data.error || (res.ok ? 'OK' : 'Test failed'),
    status: data.status || (data.success ? 'connected' : 'error'),
  };
}
