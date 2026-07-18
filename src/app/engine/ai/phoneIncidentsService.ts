/** Client for phone / Vapi ops incident APIs (AI Audit → Phone errors). */

export type PhoneIncidentSeverity =
  | 'tool_fail'
  | 'webhook_fail'
  | 'call_fail'
  | 'stuck_call'
  | 'finalize_error';

export type PhoneIncidentStatus = 'open' | 'acked' | 'fixing' | 'resolved' | 'dismissed';

export interface PhoneOpsIncident {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  count: number;
  orgId?: string;
  severity: PhoneIncidentSeverity;
  status: PhoneIncidentStatus;
  callId?: string;
  providerCallId?: string;
  callerPhone?: string;
  toolName?: string;
  error: string;
  spokenSoftFail?: boolean;
  outcome?: string;
  route?: string;
  details?: Record<string, unknown>;
  codeFixJobId?: string;
  notifiedAt?: string;
}

export interface PhoneOpsWebhookHealth {
  lastWebhookOkAt?: string;
  lastWebhookErrorAt?: string;
  lastWebhookError?: string;
  lastWebhookStatus?: number;
}

export interface PhoneIncidentsListResponse {
  incidents: PhoneOpsIncident[];
  alerts: PhoneOpsIncident[];
  health: PhoneOpsWebhookHealth;
  openCount: number;
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function listPhoneIncidents(opts?: {
  status?: string;
  severity?: string;
  search?: string;
}): Promise<PhoneIncidentsListResponse> {
  const params = new URLSearchParams();
  if (opts?.status) params.set('status', opts.status);
  if (opts?.severity) params.set('severity', opts.severity);
  if (opts?.search) params.set('search', opts.search);
  const q = params.toString();
  return api(`/api/ai/phone-incidents${q ? `?${q}` : ''}`);
}

export async function getPhoneIncident(id: string): Promise<{ incident: PhoneOpsIncident }> {
  return api(`/api/ai/phone-incidents/${encodeURIComponent(id)}`);
}

export async function ackPhoneIncident(id: string): Promise<{ incident: PhoneOpsIncident }> {
  return api(`/api/ai/phone-incidents/${encodeURIComponent(id)}/ack`, { method: 'POST' });
}

export async function dismissPhoneIncident(id: string): Promise<{ incident: PhoneOpsIncident }> {
  return api(`/api/ai/phone-incidents/${encodeURIComponent(id)}/dismiss`, { method: 'POST' });
}

export async function resolvePhoneIncident(id: string): Promise<{ incident: PhoneOpsIncident }> {
  return api(`/api/ai/phone-incidents/${encodeURIComponent(id)}/resolve`, { method: 'POST' });
}

export async function batchPhoneIncidentCodeFix(payload: {
  ids: string[];
  action: 'offer' | 'enqueue';
  requesterName?: string;
  requesterRole?: string;
  requesterUserId?: string;
}): Promise<{
  results: Array<{
    id: string;
    ok: boolean;
    jobId?: string;
    skipped?: boolean;
    error?: string;
  }>;
  offered: number;
  enqueued: number;
  cap: number;
}> {
  return api('/api/ai/phone-incidents/batch-code-fix', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function severityLabel(s: PhoneIncidentSeverity): string {
  switch (s) {
    case 'tool_fail':
      return 'Tool fail';
    case 'webhook_fail':
      return 'Webhook fail';
    case 'call_fail':
      return 'Call fail';
    case 'stuck_call':
      return 'Stuck call';
    case 'finalize_error':
      return 'Finalize error';
    default:
      return s;
  }
}

export function statusLabel(s: PhoneIncidentStatus): string {
  switch (s) {
    case 'open':
      return 'Open';
    case 'acked':
      return 'Acked';
    case 'fixing':
      return 'Fixing';
    case 'resolved':
      return 'Resolved';
    case 'dismissed':
      return 'Dismissed';
    default:
      return s;
  }
}
