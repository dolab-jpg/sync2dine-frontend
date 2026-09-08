import type { AgentRole } from './agentContext';
import { loadAIStudioConfig } from './aiStudioStore';

export interface ConversationLogEntry {
  id: string;
  userId: string;
  userName: string;
  role: AgentRole;
  scope: string;
  route?: string;
  role_message: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export async function logConversationMessage(entry: Omit<ConversationLogEntry, 'id' | 'timestamp'>): Promise<void> {
  const config = loadAIStudioConfig();
  if (!config.conversationLoggingEnabled) return;

  try {
    await fetch('/api/ai/conversation-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...entry,
        timestamp: new Date().toISOString(),
      }),
    });
  } catch {
    // Server may be offline in dev — fail silently
  }
}

export async function fetchConversationThreads(filters?: {
  role?: string;
  search?: string;
}): Promise<{
  threads: Array<{
    id: string;
    userId: string;
    userName: string;
    role: AgentRole;
    scope: string;
    lastMessage: string;
    lastAt: string;
    messageCount: number;
  }>;
}> {
  const params = new URLSearchParams();
  if (filters?.role) params.set('role', filters.role);
  if (filters?.search) params.set('search', filters.search);
  const res = await fetch(`/api/ai/conversation-log?${params}`);
  if (!res.ok) return { threads: [] };
  return res.json();
}

export async function fetchConversationTranscript(threadId: string): Promise<ConversationLogEntry[]> {
  const res = await fetch(`/api/ai/conversation-log/${encodeURIComponent(threadId)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages ?? [];
}

export async function deleteConversationThread(threadId: string): Promise<{ ok: boolean; deleted: number }> {
  const res = await fetch(`/api/ai/conversation-log/${encodeURIComponent(threadId)}`, {
    method: 'DELETE',
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as { ok: boolean; deleted: number };
}

export async function deleteConversationThreadsBatch(opts: {
  threadIds?: string[];
  all?: boolean;
}): Promise<{ ok: boolean; deletedThreads: number }> {
  const res = await fetch('/api/ai/conversation-log/delete-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(opts),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  }
  return data as { ok: boolean; deletedThreads: number };
}

export function exportTranscriptJson(messages: ConversationLogEntry[]): string {
  return JSON.stringify(messages, null, 2);
}

export function exportTranscriptCsv(messages: ConversationLogEntry[]): string {
  const header = 'timestamp,role,user,message_role,content\n';
  const rows = messages.map((m) =>
    [
      m.timestamp,
      m.role,
      m.userName,
      m.role_message,
      `"${m.content.replace(/"/g, '""')}"`,
    ].join(',')
  );
  return header + rows.join('\n');
}
