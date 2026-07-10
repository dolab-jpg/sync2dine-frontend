import { useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  fetchConversationThreads,
  fetchConversationTranscript,
  exportTranscriptCsv,
  exportTranscriptJson,
  type ConversationLogEntry,
} from '../../engine/ai/conversationLogService';
import { canViewAudit } from '../../engine/ai/rolePermissions';
import { useContext } from 'react';
import { AppContext } from '../../App';
import { Navigate } from 'react-router';

export default function ConversationAudit() {
  const app = useContext(AppContext);
  const [threads, setThreads] = useState<Awaited<ReturnType<typeof fetchConversationThreads>>['threads']>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationLogEntry[]>([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');

  if (!app || !canViewAudit(app.user.role as Parameters<typeof canViewAudit>[0])) {
    return <Navigate to="/" replace />;
  }

  useEffect(() => {
    void fetchConversationThreads({
      role: roleFilter === 'all' ? undefined : roleFilter,
      search: search || undefined,
    }).then((r) => setThreads(r.threads));
  }, [roleFilter, search]);

  useEffect(() => {
    if (!selectedId) {
      setMessages([]);
      return;
    }
    void fetchConversationTranscript(selectedId).then(setMessages);
  }, [selectedId]);

  const download = (format: 'json' | 'csv') => {
    const blob = new Blob(
      [format === 'json' ? exportTranscriptJson(messages) : exportTranscriptCsv(messages)],
      { type: format === 'json' ? 'application/json' : 'text/csv' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `transcript-${selectedId}.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-4 max-w-6xl mx-auto h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">AI Conversation Audit</h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
          Conversation logs are retained for quality and legal compliance. Do not share outside authorised staff.
        </p>
      </div>
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="customer">Customer</SelectItem>
            <SelectItem value="staff">Staff</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        <Card className="md:col-span-1 overflow-hidden flex flex-col">
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {threads.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-left p-3 border-b hover:bg-slate-50 ${
                  selectedId === t.id ? 'bg-amber-50' : ''
                }`}
              >
                <p className="font-medium text-sm">{t.userName}</p>
                <p className="text-xs text-slate-500">{t.role} · {t.scope}</p>
                <p className="text-xs text-slate-600 truncate mt-1">{t.lastMessage}</p>
              </button>
            ))}
            {threads.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No logged conversations yet.</p>
            )}
          </CardContent>
        </Card>
        <Card className="md:col-span-2 overflow-hidden flex flex-col">
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-3">
            {selectedId && (
              <div className="flex gap-2 mb-2">
                <Button type="button" size="sm" variant="outline" onClick={() => download('json')}>
                  Export JSON
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => download('csv')}>
                  Export CSV
                </Button>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`text-sm p-2 rounded-lg ${
                  m.role_message === 'user' ? 'bg-amber-100 ml-8' : 'bg-slate-100 mr-8'
                }`}
              >
                <p className="text-[10px] text-slate-500 mb-1">
                  {m.role_message} · {new Date(m.timestamp).toLocaleString('en-GB')}
                </p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            ))}
            {!selectedId && <p className="text-slate-500 text-sm">Select a thread to view transcript.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
