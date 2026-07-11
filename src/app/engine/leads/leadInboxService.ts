import type { Customer } from '../../App';
import { useCloudPersistence } from '../data/cloudPersist';

export interface LeadInboxItem {
  id: string;
  orgId: string;
  messageId: string;
  emailCacheId: string;
  subject: string;
  fromAddr: string;
  fromName?: string;
  summary: string;
  recommendation: string;
  customerId?: string;
  customerName?: string;
  phone?: string;
  jobScope?: string;
  status: 'action_required' | 'skipped' | 'unparsed' | 'handled';
  mergedDuplicate?: boolean;
  draftReply?: { to: string; subject: string; body: string };
  toolsUsed: string[];
  createdAt: string;
}

export interface LeadInboxResponse {
  items: LeadInboxItem[];
  customers: Customer[];
  actionRequired: number;
  processedEmailCacheIds?: string[];
}

const POLL_STORAGE_KEY = 'tradepro_lead_inbox_last_poll';
let lastPollMemory: string | undefined;

export async function fetchLeadInbox(since?: string): Promise<LeadInboxResponse> {
  const params = since ? `?since=${encodeURIComponent(since)}` : '';
  const res = await fetch(`/api/leads/inbox${params}`, {
    headers: { 'X-Org-Id': 'default' },
  });
  if (!res.ok) {
    return { items: [], customers: [], actionRequired: 0 };
  }
  return res.json() as Promise<LeadInboxResponse>;
}

export async function markLeadHandled(id: string): Promise<void> {
  await fetch(`/api/leads/inbox/${encodeURIComponent(id)}/handle`, {
    method: 'POST',
    headers: { 'X-Org-Id': 'default' },
  });
}

export function getLastPollTime(): string | undefined {
  if (useCloudPersistence()) {
    return lastPollMemory;
  }
  try {
    return localStorage.getItem(POLL_STORAGE_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setLastPollTime(iso: string): void {
  lastPollMemory = iso;
  if (useCloudPersistence()) return;
  try {
    localStorage.setItem(POLL_STORAGE_KEY, iso);
  } catch {
    /* ignore */
  }
}
