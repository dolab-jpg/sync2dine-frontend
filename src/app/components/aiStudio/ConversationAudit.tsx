import { useContext, useEffect, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router';
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
import { AppContext } from '../../App';
import { CodeFixesAudit } from './CodeFixesAudit';
import { listCodeFixJobs } from '../../engine/ai/codeFixService';

type AuditTab = 'conversations' | 'code_fixes';

export default function ConversationAudit() {
  const app = useContext(AppContext);
  const [searchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'code_fixes' ? 'code_fixes' : 'conversations';
  const [tab, setTab] = useState<AuditTab>(initialTab);
  const [threads, setThreads] = useState<Awaited<ReturnType<typeof fetchConversationThreads>>['threads']>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ConversationLogEntry[]>([]);
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [alertCount, setAlertCount] = useState(0);

  const allowed = Boolean(app && canViewAudit(app.user.role as Parameters<typeof canViewAudit>[0]));

  useEffect(() => {
    if (!allowed) return;
    void fetchConversationThreads({
      role: roleFilter === 'all' ? undefined : roleFilter,
      search: search || undefined,
    }).then((r) => setThreads(r.threads));
  }, [allowed, roleFilter, search]);

  useEffect(() => {
    if (!allowed || !selectedId) {
      setMessages([]);
      return;
    }
    void fetchConversationTranscript(selectedId).then(setMessages);
  }, [allowed, selectedId]);

  useEffect(() => {
    if (!allowed) return;
    const refreshAlerts = () => {
      void listCodeFixJobs()
        .then((r) => setAlertCount(r.alerts.length))
        .catch(() => setAlertCount(0));
    };
    refreshAlerts();
    const id = window.setInterval(refreshAlerts, 15_000);
    return () => window.clearInterval(id);
  }, [allowed]);

  if (!app || !allowed) {
    return <Navigate to="/" replace />;
  }

  const download = (format: 'json' | 'csv') => {
    const blob = new Blob(
      [format === 'json' ? exportTranscriptJson(messages) : exportTranscriptCsv(messages)],
      { type: format === 'json' ? 'application/json' : 'text/csv' },
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
        <h1 className="text-2xl font-bold">AI Audit</h1>
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 mt-2">
          Conversation and code-fix logs are retained for quality and compliance. Do not share outside authorised staff.
        </p>
      </div>

      <div className="flex gap-2 mb-4 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setTab('conversations')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
            tab === 'conversations' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Conversations
        </button>
        <button
          type="button"
          onClick={() => setTab('code_fixes')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
            tab === 'code_fixes' ? 'bg-amber-100 text-amber-900' : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          Code fixes
          {alertCount > 0 && (
            <span className="inline-flex min-w-[1.25rem] h-5 px-1 items-center justify-center rounded-full bg-red-600 text-white text-[10px]">
              {alertCount}
            </span>
          )}
        </button>
      </div>

      {tab === 'code_fixes' ? (
        <CodeFixesAudit />
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}
