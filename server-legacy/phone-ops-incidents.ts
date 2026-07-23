/**
 * Phone / Vapi ops incidents — durable log for AI Audit "Phone errors" tab.
 * Persist to server/data/phone-ops-incidents.json (parity with code-fix jobs).
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { resolveOrgIdForRequest, isAuthEnforced, requireAuth } from './auth';
import { createCodeFixJobInternal } from './code-fix-handler';
import { sendToStaffCynthiaInternal } from './cynthia-routes';
import { listUsers } from './users';

const DEFAULT_ORG_FALLBACK = 'default';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STORE_PATH = join(__dirname, 'data', 'phone-ops-incidents.json');
const META_PATH = join(__dirname, 'data', 'phone-ops-meta.json');
const LOCAL_MIRROR_PATH = join(__dirname, '..', '.cursor', 'local', 'phone-incidents-open.json');

const MAX_INCIDENTS = 500;
const DEDUPE_MS = 15 * 60 * 1000;
const BATCH_CODE_FIX_CAP = 5;

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

interface PhoneOpsMeta extends PhoneOpsWebhookHealth {
  updatedAt?: string;
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  return `phi-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function readIncidents(): PhoneOpsIncident[] {
  try {
    if (!existsSync(STORE_PATH)) return [];
    return JSON.parse(readFileSync(STORE_PATH, 'utf-8')) as PhoneOpsIncident[];
  } catch {
    return [];
  }
}

function writeIncidents(list: PhoneOpsIncident[]): void {
  mkdirSync(dirname(STORE_PATH), { recursive: true });
  writeFileSync(STORE_PATH, JSON.stringify(list.slice(-MAX_INCIDENTS), null, 2), 'utf-8');
  mirrorOpenIncidents(list);
}

function readMeta(): PhoneOpsMeta {
  try {
    if (!existsSync(META_PATH)) return {};
    return JSON.parse(readFileSync(META_PATH, 'utf-8')) as PhoneOpsMeta;
  } catch {
    return {};
  }
}

function writeMeta(meta: PhoneOpsMeta): void {
  mkdirSync(dirname(META_PATH), { recursive: true });
  writeFileSync(META_PATH, JSON.stringify({ ...meta, updatedAt: nowIso() }, null, 2), 'utf-8');
}

function mirrorOpenIncidents(list: PhoneOpsIncident[]): void {
  try {
    const open = list
      .filter((i) => i.status === 'open' || i.status === 'acked' || i.status === 'fixing')
      .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, 20)
      .map((i) => ({
        id: i.id,
        severity: i.severity,
        status: i.status,
        error: i.error,
        toolName: i.toolName,
        callId: i.callId,
        outcome: i.outcome,
        lastSeenAt: i.lastSeenAt,
        count: i.count,
        auditPath: `/ai-audit?tab=phone_errors&id=${i.id}`,
      }));
    mkdirSync(dirname(LOCAL_MIRROR_PATH), { recursive: true });
    writeFileSync(
      LOCAL_MIRROR_PATH,
      JSON.stringify({ updatedAt: nowIso(), open }, null, 2),
      'utf-8',
    );
  } catch {
    // fail open — mirror is best-effort for Cursor hooks on this machine
  }
}

function errorSignature(error: string): string {
  return error.trim().toLowerCase().slice(0, 160);
}

function isSkippableAuthSoftFail(toolName: string | undefined, error: string): boolean {
  const e = error.toLowerCase();
  const t = (toolName || '').toLowerCase();
  if (t === 'verifystaffphonepin' && /incorrect|invalid|try again/.test(e)) return true;
  if (/identity_not_bound|pin required|awaiting pin|needs.?pin/.test(e) && !/fail|timeout|500|crash/.test(e)) {
    return true;
  }
  return false;
}

function findDedupeMatch(
  list: PhoneOpsIncident[],
  input: {
    callId?: string;
    toolName?: string;
    error: string;
    severity: PhoneIncidentSeverity;
  },
): PhoneOpsIncident | undefined {
  const since = Date.now() - DEDUPE_MS;
  const sig = errorSignature(input.error);
  return list.find((i) => {
    if (i.status === 'dismissed' || i.status === 'resolved') return false;
    if (new Date(i.lastSeenAt).getTime() < since) return false;
    if (i.severity !== input.severity) return false;
    if ((i.toolName || '') !== (input.toolName || '')) return false;
    if ((i.callId || '') !== (input.callId || '')) return false;
    return errorSignature(i.error) === sig;
  });
}

function resolveNotifyUserId(): string | null {
  const fromEnv = process.env.PHONE_OPS_NOTIFY_USER_ID?.trim();
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  try {
    const owners = listUsers().filter((u) =>
      ['platform_owner', 'super_admin'].includes(u.role),
    );
    const pick = owners.find((u) => u.id.length >= 8);
    return pick?.id ?? null;
  } catch {
    return null;
  }
}

function notifyOwner(incident: PhoneOpsIncident): void {
  const userId = resolveNotifyUserId();
  if (!userId) return;
  const orgId = incident.orgId || DEFAULT_ORG_FALLBACK;
  try {
    const result = sendToStaffCynthiaInternal({
      orgId,
      userId,
      title: `Phone error: ${incident.severity}`,
      phone: incident.callerPhone,
      summary: [
        incident.toolName ? `Tool: ${incident.toolName}` : null,
        incident.error.slice(0, 200),
        incident.callId ? `Call: ${incident.callId}` : null,
      ]
        .filter(Boolean)
        .join(' · '),
      notes: `Open AI Audit → Phone errors: /ai-audit?tab=phone_errors&id=${incident.id}`,
      source: 'system',
    });
    if (result.ok) {
      incident.notifiedAt = nowIso();
    }
  } catch (err) {
    console.warn(
      '[phone-ops] notify failed:',
      err instanceof Error ? err.message : err,
    );
  }
}

export function markWebhookOk(): void {
  const meta = readMeta();
  meta.lastWebhookOkAt = nowIso();
  writeMeta(meta);
}

export function markWebhookError(status: number, error: string): void {
  const meta = readMeta();
  meta.lastWebhookErrorAt = nowIso();
  meta.lastWebhookStatus = status;
  meta.lastWebhookError = error.slice(0, 400);
  writeMeta(meta);
}

export function getWebhookHealth(): PhoneOpsWebhookHealth {
  const meta = readMeta();
  return {
    lastWebhookOkAt: meta.lastWebhookOkAt,
    lastWebhookErrorAt: meta.lastWebhookErrorAt,
    lastWebhookError: meta.lastWebhookError,
    lastWebhookStatus: meta.lastWebhookStatus,
  };
}

export function recordPhoneIncident(input: {
  severity: PhoneIncidentSeverity;
  error: string;
  orgId?: string;
  callId?: string;
  providerCallId?: string;
  callerPhone?: string;
  toolName?: string;
  spokenSoftFail?: boolean;
  outcome?: string;
  route?: string;
  details?: Record<string, unknown>;
  notify?: boolean;
}): PhoneOpsIncident | null {
  const error = String(input.error || '').trim();
  if (!error) return null;
  if (isSkippableAuthSoftFail(input.toolName, error)) return null;

  const list = readIncidents();
  const existing = findDedupeMatch(list, {
    callId: input.callId,
    toolName: input.toolName,
    error,
    severity: input.severity,
  });

  if (existing) {
    existing.count = (existing.count || 1) + 1;
    existing.lastSeenAt = nowIso();
    if (input.details) {
      existing.details = { ...(existing.details || {}), ...input.details, lastBump: input.details };
    }
    if (input.outcome) existing.outcome = input.outcome;
    writeIncidents(list.map((i) => (i.id === existing.id ? existing : i)));
    return existing;
  }

  const incident: PhoneOpsIncident = {
    id: newId(),
    createdAt: nowIso(),
    lastSeenAt: nowIso(),
    count: 1,
    orgId: input.orgId || DEFAULT_ORG_FALLBACK,
    severity: input.severity,
    status: 'open',
    callId: input.callId,
    providerCallId: input.providerCallId,
    callerPhone: input.callerPhone,
    toolName: input.toolName,
    error: error.slice(0, 1000),
    spokenSoftFail: input.spokenSoftFail,
    outcome: input.outcome,
    route: input.route || '/webhooks/vapi',
    details: input.details,
  };

  list.push(incident);
  if (input.notify !== false) {
    notifyOwner(incident);
  }
  writeIncidents(list);
  return incident;
}

/** Detect soft tool failure payloads from executeTool / phone-tools. */
export function toolOutputLooksFailed(output: unknown): { failed: boolean; error: string } {
  if (output == null) return { failed: false, error: '' };
  if (typeof output !== 'object') return { failed: false, error: '' };
  const o = output as Record<string, unknown>;
  if (typeof o.error === 'string' && o.error.trim()) {
    return { failed: true, error: o.error.trim() };
  }
  if (o.ok === false) {
    return {
      failed: true,
      error: typeof o.error === 'string' && o.error.trim()
        ? o.error.trim()
        : typeof o.message === 'string'
          ? o.message
          : 'Tool returned ok: false',
    };
  }
  if (o.sent === false) {
    return {
      failed: true,
      error: typeof o.error === 'string' && o.error.trim()
        ? o.error.trim()
        : 'Tool returned sent: false',
    };
  }
  return { failed: false, error: '' };
}

function incidentAlerts(list: PhoneOpsIncident[]): PhoneOpsIncident[] {
  return list
    .filter((i) => i.status === 'open' || i.status === 'fixing')
    .sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}

function updateIncident(
  id: string,
  patch: Partial<PhoneOpsIncident>,
): PhoneOpsIncident | null {
  const list = readIncidents();
  const idx = list.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  const next = { ...list[idx], ...patch, lastSeenAt: list[idx].lastSeenAt };
  list[idx] = next;
  writeIncidents(list);
  return next;
}

export async function handlePhoneOpsIncidentRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (!pathname.startsWith('/api/ai/phone-incidents')) return false;

  if (isAuthEnforced() && !requireAuth(req)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return true;
  }

  if (req.method === 'GET' && pathname === '/api/ai/phone-incidents') {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const statusFilter = url.searchParams.get('status');
    const severityFilter = url.searchParams.get('severity');
    const search = url.searchParams.get('search')?.toLowerCase();
    let list = readIncidents().slice().sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
    if (statusFilter && statusFilter !== 'all') {
      list = list.filter((i) => i.status === statusFilter);
    }
    if (severityFilter && severityFilter !== 'all') {
      list = list.filter((i) => i.severity === severityFilter);
    }
    if (search) {
      list = list.filter(
        (i) =>
          i.error.toLowerCase().includes(search)
          || (i.toolName || '').toLowerCase().includes(search)
          || (i.callId || '').toLowerCase().includes(search)
          || (i.callerPhone || '').includes(search)
          || (i.outcome || '').toLowerCase().includes(search),
      );
    }
    const all = readIncidents();
    sendJson(res, 200, {
      incidents: list,
      alerts: incidentAlerts(all),
      health: getWebhookHealth(),
      openCount: all.filter((i) => i.status === 'open').length,
    });
    return true;
  }

  if (req.method === 'POST' && pathname === '/api/ai/phone-incidents/batch-code-fix') {
    let body: {
      ids?: string[];
      action?: 'offer' | 'enqueue';
      requesterName?: string;
      requesterRole?: string;
      requesterUserId?: string;
      orgId?: string;
    } = {};
    try {
      body = JSON.parse(await readBody(req) || '{}') as typeof body;
    } catch {
      sendJson(res, 400, { error: 'Invalid JSON' });
      return true;
    }
    const ids = (body.ids ?? []).slice(0, BATCH_CODE_FIX_CAP);
    const action = body.action === 'enqueue' ? 'enqueue' : 'offer';
    if (ids.length === 0) {
      sendJson(res, 400, { error: 'ids required (max 5)' });
      return true;
    }
    const orgId =
      resolveOrgIdForRequest(req, body as { orgId?: string }) ?? body.orgId ?? undefined;
    const results: Array<{
      id: string;
      ok: boolean;
      incident?: PhoneOpsIncident;
      jobId?: string;
      skipped?: boolean;
      error?: string;
    }> = [];

    for (const id of ids) {
      const incident = readIncidents().find((i) => i.id === id);
      if (!incident) {
        results.push({ id, ok: false, error: 'not_found' });
        continue;
      }
      const errorCode = `PHONE_${incident.severity.toUpperCase()}${incident.toolName ? `_${incident.toolName}` : ''}`;
      const description = [
        `Phone ops ${incident.severity}`,
        incident.toolName ? `tool=${incident.toolName}` : null,
        `error=${incident.error}`,
        incident.callId ? `callId=${incident.callId}` : null,
        incident.outcome ? `outcome=${incident.outcome}` : null,
        incident.details ? `details=${JSON.stringify(incident.details).slice(0, 800)}` : null,
      ]
        .filter(Boolean)
        .join(' | ');
      const created = createCodeFixJobInternal({
        action,
        errorCode,
        description,
        route: incident.route || '/webhooks/vapi',
        requesterName: body.requesterName || 'Phone ops audit',
        requesterRole: body.requesterRole || 'platform_owner',
        requesterUserId: body.requesterUserId,
        orgId: orgId || incident.orgId,
        metadata: {
          phoneIncidentId: incident.id,
          severity: incident.severity,
          callId: incident.callId,
        },
      });
      if (created.skipped) {
        results.push({ id, ok: false, skipped: true, error: created.reason || created.message });
        continue;
      }
      const jobId = created.job?.id;
      const updated = updateIncident(id, {
        status: 'fixing',
        codeFixJobId: jobId,
      });
      results.push({ id, ok: true, incident: updated ?? incident, jobId });
    }

    sendJson(res, 200, {
      results,
      offered: results.filter((r) => r.ok && action === 'offer').length,
      enqueued: results.filter((r) => r.ok && action === 'enqueue').length,
      cap: BATCH_CODE_FIX_CAP,
    });
    return true;
  }

  const oneMatch = pathname.match(/^\/api\/ai\/phone-incidents\/([^/]+)$/);
  if (oneMatch && req.method === 'GET') {
    const id = decodeURIComponent(oneMatch[1]);
    const incident = readIncidents().find((i) => i.id === id);
    if (!incident) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }
    sendJson(res, 200, { incident, health: getWebhookHealth() });
    return true;
  }

  const ackMatch = pathname.match(/^\/api\/ai\/phone-incidents\/([^/]+)\/ack$/);
  if (ackMatch && req.method === 'POST') {
    const id = decodeURIComponent(ackMatch[1]);
    const updated = updateIncident(id, { status: 'acked' });
    if (!updated) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }
    sendJson(res, 200, { incident: updated });
    return true;
  }

  const dismissMatch = pathname.match(/^\/api\/ai\/phone-incidents\/([^/]+)\/dismiss$/);
  if (dismissMatch && req.method === 'POST') {
    const id = decodeURIComponent(dismissMatch[1]);
    const updated = updateIncident(id, { status: 'dismissed' });
    if (!updated) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }
    sendJson(res, 200, { incident: updated });
    return true;
  }

  const resolveMatch = pathname.match(/^\/api\/ai\/phone-incidents\/([^/]+)\/resolve$/);
  if (resolveMatch && req.method === 'POST') {
    const id = decodeURIComponent(resolveMatch[1]);
    const updated = updateIncident(id, { status: 'resolved' });
    if (!updated) {
      sendJson(res, 404, { error: 'Not found' });
      return true;
    }
    sendJson(res, 200, { incident: updated });
    return true;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
  return true;
}
