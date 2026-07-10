import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Loader2 } from 'lucide-react';
import { mailboxService, type InboxMessage, type InboxThread, type MailboxConnection } from '../../engine/mailbox/mailboxService';
import { fetchLeadInbox } from '../../engine/leads/leadInboxService';

function emailBodyText(msg: InboxMessage): string {
  if (msg.textBody?.trim()) return msg.textBody;
  if (msg.htmlBody?.trim()) {
    return msg.htmlBody.replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return msg.snippet;
}

interface Props {
  userId: string;
  orgId?: string;
  connection?: MailboxConnection | null;
}

export function InboxPanel({ userId, orgId, connection }: Props) {
  const [threads, setThreads] = useState<InboxThread[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [selectedThread, setSelectedThread] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processedIds, setProcessedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    void fetchLeadInbox().then(data => {
      const ids = (data as { processedEmailCacheIds?: string[] }).processedEmailCacheIds ?? [];
      setProcessedIds(new Set(ids));
    });
  }, []);

  useEffect(() => {
    if (!connection?.id) return;
    setLoading(true);
    mailboxService.listThreads(connection.id, userId, orgId)
      .then(data => {
        setThreads(data.threads);
        setMessages(data.messages as InboxMessage[]);
        if (data.threads[0]) setSelectedThread(data.threads[0].threadId);
      })
      .finally(() => setLoading(false));
  }, [connection?.id, userId, orgId]);

  const threadMessages = messages.filter(m => m.threadId === selectedThread);
  const selectedMeta = threads.find(t => t.threadId === selectedThread);

  if (!connection) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-gray-500">
          Connect your inbox in Settings → Email &amp; Inbox to view messages here.
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="p-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 min-h-[400px]">
      <Card className="md:col-span-1">
        <CardHeader><CardTitle className="text-sm">Threads</CardTitle></CardHeader>
        <CardContent className="p-0 divide-y max-h-[500px] overflow-auto">
          {threads.length === 0 && <p className="p-4 text-sm text-gray-500">No messages yet. Try Sync now in Settings.</p>}
          {threads.map(t => (
            <button
              key={t.threadId}
              type="button"
              className={`w-full text-left p-3 hover:bg-gray-50 ${selectedThread === t.threadId ? 'bg-blue-50' : ''}`}
              onClick={() => setSelectedThread(t.threadId)}
            >
              <p className="font-medium text-sm truncate">{t.subject}</p>
              <p className="text-xs text-gray-500 truncate">{t.participants.join(', ')}</p>
              <p className="text-xs text-gray-600 mt-1 truncate">{t.snippet}</p>
            </button>
          ))}
        </CardContent>
      </Card>
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">{selectedMeta?.subject ?? 'Select a thread'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 max-h-[500px] overflow-auto">
          {threadMessages.map(msg => (
            <div key={msg.id} className="border rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{msg.fromName || msg.fromAddr}</Badge>
                {processedIds.has(msg.id) && (
                  <Badge className="bg-green-100 text-green-800 border-green-200">Lead processed</Badge>
                )}
                <span className="text-xs text-gray-500">{new Date(msg.receivedAt).toLocaleString()}</span>
              </div>
              <pre className="text-sm whitespace-pre-wrap font-sans">{emailBodyText(msg)}</pre>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
