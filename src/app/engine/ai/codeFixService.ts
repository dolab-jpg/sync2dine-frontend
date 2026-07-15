/** Client for self-heal code-fix queue APIs. */

export type CodeFixScope = 'surgical' | 'needs_cursor_approval';
export type CodeFixStatus =
  | 'asking'
  | 'offered'
  | 'dismissed'
  | 'queued'
  | 'running'
  | 'awaiting_cursor_approval'
  | 'pr_open'
  | 'merged'
  | 'failed'
  | 'cancelled';

export interface CodeFixJob {
  id: string;
  orgId?: string;
  requesterUserId?: string;
  requesterName: string;
  requesterRole: string;
  chatSessionId?: string;
  errorCode: string;
  description: string;
  route: string;
  screenshotDataUrl?: string;
  scope: CodeFixScope;
  status: CodeFixStatus;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string;
  alertedAt?: string;
  cursorAgentId?: string;
  cursorAgentUrl?: string;
  prUrl?: string;
  repoUrl?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CodeFixHealth {
  live: boolean;
  keyValid: boolean;
  reposAccessible: boolean;
  missingRepos: string[];
  githubTokenConfigured: boolean;
  checkedAt: string;
  reason: string;
}

export interface CodeFixListResponse {
  jobs: CodeFixJob[];
  alerts: CodeFixJob[];
  queueDepth: number;
  activeRuns: number;
  cursorConfigured: boolean;
  health?: CodeFixHealth;
}

export interface CodeFixMergeResult {
  job: CodeFixJob;
  merged: boolean;
  needsManualMerge?: boolean;
  prUrl?: string;
  error?: string;
  cursorAgentUrl?: string;
}

export interface CodeFixMergeBatchResult {
  results: Array<{
    id: string;
    ok: boolean;
    job?: CodeFixJob;
    needsManualMerge?: boolean;
    prUrl?: string;
    error?: string;
  }>;
  merged: number;
  needsManual: number;
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

export async function getCodeFixHealth(force = false): Promise<CodeFixHealth> {
  return api(`/api/ai/code-fix/health${force ? '?force=1' : ''}`);
}

export async function offerCodeFix(payload: {
  errorCode: string;
  description: string;
  route: string;
  requesterRole: string;
  requesterName: string;
  requesterUserId?: string;
  chatSessionId?: string;
  screenshotDataUrl?: string;
  orgId?: string;
}): Promise<{
  job?: CodeFixJob;
  dedupe?: boolean;
  message?: string;
  skipped?: boolean;
  reason?: string;
}> {
  return api('/api/ai/code-fix', {
    method: 'POST',
    body: JSON.stringify({ action: 'offer', ...payload }),
  });
}

export async function enqueueCodeFix(payload: {
  jobId?: string;
  errorCode: string;
  description: string;
  route: string;
  requesterRole: string;
  requesterName: string;
  requesterUserId?: string;
  chatSessionId?: string;
  screenshotDataUrl?: string;
  orgId?: string;
}): Promise<{
  job: CodeFixJob;
  queuePosition?: number;
  needsCursorApproval?: boolean;
  message?: string;
  dedupe?: boolean;
}> {
  return api('/api/ai/code-fix', {
    method: 'POST',
    body: JSON.stringify({ action: 'enqueue', ...payload }),
  });
}

export async function dismissCodeFix(jobId: string): Promise<{ job: CodeFixJob }> {
  return api(`/api/ai/code-fix/${jobId}/dismiss`, { method: 'POST', body: '{}' });
}

export async function retryCodeFix(
  jobId: string,
  opts?: { cursorApproved?: boolean },
): Promise<{ job: CodeFixJob; queuePosition?: number }> {
  return api(`/api/ai/code-fix/${jobId}/retry`, {
    method: 'POST',
    body: JSON.stringify(opts ?? {}),
  });
}

export async function updateCodeFixStatus(
  jobId: string,
  status: CodeFixStatus,
  prUrl?: string,
): Promise<{ job: CodeFixJob }> {
  return api(`/api/ai/code-fix/${jobId}/status`, {
    method: 'POST',
    body: JSON.stringify({ status, prUrl }),
  });
}

export async function mergeCodeFix(jobId: string): Promise<CodeFixMergeResult> {
  return api(`/api/ai/code-fix/${jobId}/merge`, { method: 'POST', body: '{}' });
}

export async function mergeCodeFixBatch(opts: {
  ids?: string[];
  allOpen?: boolean;
}): Promise<CodeFixMergeBatchResult> {
  return api('/api/ai/code-fix/merge-batch', {
    method: 'POST',
    body: JSON.stringify(opts),
  });
}

export async function listCodeFixJobs(params?: {
  status?: string;
  search?: string;
}): Promise<CodeFixListResponse> {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.search) q.set('search', params.search);
  const qs = q.toString();
  return api(`/api/ai/code-fix${qs ? `?${qs}` : ''}`);
}

export async function getCodeFixJob(jobId: string): Promise<{
  job: CodeFixJob;
  queuePosition: number;
}> {
  return api(`/api/ai/code-fix/${jobId}`);
}

export function statusLabel(status: CodeFixStatus): string {
  switch (status) {
    case 'offered': return 'Awaiting Yes/No';
    case 'asking': return 'Needs details';
    case 'dismissed': return 'Dismissed';
    case 'queued': return 'Queued';
    case 'running': return 'Running';
    case 'awaiting_cursor_approval': return 'Needs Cursor approval';
    case 'pr_open': return 'PR open — approve merge';
    case 'merged': return 'Merged';
    case 'failed': return 'Failed';
    case 'cancelled': return 'Cancelled';
    default: return status;
  }
}
