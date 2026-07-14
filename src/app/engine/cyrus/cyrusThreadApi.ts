import { getActiveOrgId } from '../platform/orgContext';

export type HandoffMode = 'ai_active' | 'human_takeover';

export interface ServerConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  bodyEnglish?: string;
  timestamp: string;
  channel?: string;
  fromRole?: string;
}

export interface ServerThread {
  sessionId: string;
  phone: string;
  orgId: string;
  channel: string;
  contactName?: string;
  handoffMode: HandoffMode;
  messages: ServerConversationMessage[];
  lastAt: string;
  updatedAt: string;
}

function orgHeaders(): HeadersInit {
  const orgId = getActiveOrgId() || 'default';
  return {
    'Content-Type': 'application/json',
    'X-Org-Id': orgId,
  };
}

export async function fetchCyrusThreads(): Promise<ServerThread[]> {
  const res = await fetch('/api/cyrus/threads', { headers: orgHeaders() });
  if (!res.ok) throw new Error('Failed to load Cyrus threads');
  const data = await res.json() as { threads?: ServerThread[] };
  return data.threads ?? [];
}

export async function fetchCyrusThread(sessionId: string): Promise<ServerThread | null> {
  const res = await fetch(`/api/cyrus/threads/${encodeURIComponent(sessionId)}`, {
    headers: orgHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error('Failed to load thread');
  const data = await res.json() as { thread?: ServerThread };
  return data.thread ?? null;
}

export async function staffReplyToThread(sessionId: string, text: string, staffName?: string) {
  const res = await fetch(`/api/cyrus/threads/${encodeURIComponent(sessionId)}/reply`, {
    method: 'POST',
    headers: orgHeaders(),
    body: JSON.stringify({ text, staffName }),
  });
  const data = await res.json() as { error?: string; thread?: ServerThread; whatsappSent?: boolean };
  if (!res.ok) throw new Error(data.error || 'Failed to send reply');
  return data;
}

export async function askCyrusOnThread(sessionId: string, text: string) {
  const res = await fetch(`/api/cyrus/threads/${encodeURIComponent(sessionId)}/ask`, {
    method: 'POST',
    headers: orgHeaders(),
    body: JSON.stringify({ text }),
  });
  const data = await res.json() as { error?: string; reply?: string; thread?: ServerThread; code?: string };
  if (!res.ok) throw new Error(data.error || 'Cyrus request failed');
  return data;
}

export async function setThreadHandoff(sessionId: string, mode: HandoffMode) {
  const res = await fetch(`/api/cyrus/threads/${encodeURIComponent(sessionId)}/handoff`, {
    method: 'POST',
    headers: orgHeaders(),
    body: JSON.stringify({ mode }),
  });
  const data = await res.json() as { error?: string; thread?: ServerThread };
  if (!res.ok) throw new Error(data.error || 'Failed to update handoff');
  return data;
}

export async function syncCompanySettingsToServer(website?: string, companyName?: string) {
  const res = await fetch('/api/cyrus/company-settings', {
    method: 'PUT',
    headers: orgHeaders(),
    body: JSON.stringify({ website, companyName }),
  });
  return res.ok;
}

export async function fetchEmbedSnippet(): Promise<{
  snippet: string;
  website: string;
  companyName: string;
  orgId: string;
}> {
  const res = await fetch('/api/cyrus/embed-snippet', { headers: orgHeaders() });
  if (!res.ok) throw new Error('Failed to load embed snippet');
  return res.json();
}

export async function sendPortalCyrusMessage(token: string, text: string) {
  const res = await fetch('/api/cyrus/portal', {
    method: 'POST',
    headers: orgHeaders(),
    body: JSON.stringify({ token, text }),
  });
  const data = await res.json() as {
    error?: string;
    reply?: string;
    messages?: ServerConversationMessage[];
    sessionId?: string;
  };
  if (!res.ok) throw new Error(data.error || 'Cyrus unavailable');
  return data;
}

export async function fetchPortalCyrusThread(token: string) {
  const orgId = getActiveOrgId() || 'default';
  const res = await fetch(
    `/api/cyrus/portal/thread?token=${encodeURIComponent(token)}&orgId=${encodeURIComponent(orgId)}`,
    { headers: orgHeaders() },
  );
  if (!res.ok) return { messages: [] as ServerConversationMessage[] };
  return res.json() as Promise<{ messages?: ServerConversationMessage[] }>;
}
