export interface MailboxConnection {
  id: string;
  orgId: string;
  userId: string;
  provider: 'google' | 'microsoft' | 'yahoo';
  emailAddress: string;
  displayName?: string;
  status: 'connected' | 'needs_reconnect' | 'error' | 'disconnected';
  connectedAt: string;
  lastSyncedAt?: string;
  lastError?: string;
}

export interface InboxThread {
  threadId: string;
  subject: string;
  participants: string[];
  lastMessageAt: string;
  snippet: string;
  unread: boolean;
  messageCount: number;
}

export interface InboxMessage {
  id: string;
  connectionId: string;
  threadId: string;
  subject: string;
  fromAddr: string;
  fromName?: string;
  toAddrs: string[];
  snippet: string;
  textBody?: string;
  htmlBody?: string;
  receivedAt: string;
  hasAttachments: boolean;
}

function headers(userId?: string, orgId?: string, live?: boolean): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (userId) h['X-User-Id'] = userId;
  if (orgId) h['X-Org-Id'] = orgId;
  if (live) h['X-Mailbox-Live'] = 'true';
  return h;
}

export const mailboxService = {
  async getConnections(userId?: string, orgId?: string): Promise<MailboxConnection[]> {
    const res = await fetch('/api/mailbox/connections', { headers: headers(userId, orgId) });
    const data = await res.json() as { connections?: MailboxConnection[] };
    return data.connections ?? [];
  },

  async startConnect(
    provider: 'google' | 'microsoft' | 'yahoo',
    userId?: string,
    orgId?: string,
    loginHint?: string,
    live = false,
    popup = false,
  ): Promise<{ authUrl?: string; mock?: boolean; connection?: MailboxConnection; popup?: boolean }> {
    const params = new URLSearchParams({ provider });
    if (loginHint) params.set('loginHint', loginHint);
    if (popup) {
      params.set('popup', '1');
      if (typeof window !== 'undefined') params.set('appOrigin', window.location.origin);
    }
    const res = await fetch(`/api/mailbox/connect?${params}`, { headers: headers(userId, orgId, live) });
    return res.json();
  },

  async disconnect(connectionId: string, userId?: string, orgId?: string): Promise<void> {
    await fetch(`/api/mailbox/connections/${connectionId}`, {
      method: 'DELETE',
      headers: headers(userId, orgId),
    });
  },

  async sync(connectionId: string, userId?: string, orgId?: string): Promise<{ synced?: number; error?: string }> {
    const res = await fetch('/api/mailbox/sync', {
      method: 'POST',
      headers: headers(userId, orgId),
      body: JSON.stringify({ connectionId }),
    });
    return res.json();
  },

  async listThreads(connectionId: string, userId?: string, orgId?: string): Promise<{ threads: InboxThread[]; messages: InboxMessage[] }> {
    const res = await fetch(`/api/mailbox/messages?connectionId=${encodeURIComponent(connectionId)}`, {
      headers: headers(userId, orgId),
    });
    const data = await res.json() as { threads?: InboxThread[]; messages?: InboxMessage[] };
    return { threads: data.threads ?? [], messages: data.messages ?? [] };
  },

  async getMessage(messageId: string, userId?: string, orgId?: string) {
    const res = await fetch(`/api/mailbox/messages/${messageId}`, { headers: headers(userId, orgId) });
    return res.json();
  },

  async send(payload: {
    connectionId: string;
    to: string;
    cc?: string;
    subject: string;
    body: string;
    html?: string;
    attachments?: Array<{ filename: string; mimeType: string; content: string }>;
  }, userId?: string, orgId?: string) {
    const res = await fetch('/api/mailbox/send', {
      method: 'POST',
      headers: headers(userId, orgId),
      body: JSON.stringify(payload),
    });
    return res.json();
  },
};
