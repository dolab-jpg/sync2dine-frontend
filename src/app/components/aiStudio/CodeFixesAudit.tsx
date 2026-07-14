import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  listCodeFixJobs,
  retryCodeFix,
  updateCodeFixStatus,
  statusLabel,
  type CodeFixJob,
} from '../../engine/ai/codeFixService';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

export function CodeFixesAudit() {
  const [jobs, setJobs] = useState<CodeFixJob[]>([]);
  const [alerts, setAlerts] = useState<CodeFixJob[]>([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const [activeRuns, setActiveRuns] = useState(0);
  const [cursorConfigured, setCursorConfigured] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listCodeFixJobs({
        status: statusFilter === 'all' ? undefined : statusFilter,
        search: search || undefined,
      });
      setJobs(data.jobs);
      setAlerts(data.alerts);
      setQueueDepth(data.queueDepth);
      setActiveRuns(data.activeRuns);
      setCursorConfigured(data.cursorConfigured);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const selected = jobs.find((j) => j.id === selectedId) ?? null;

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      {!cursorConfigured && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <strong>CURSOR_API_KEY</strong> is not set. Add it to server env or{' '}
          <code className="text-xs">.cursor/local/deploy.env</code> so surgical fixes can launch Cloud Agents.
        </div>
      )}

      {alerts.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            Alerts ({alerts.length})
          </div>
          <ul className="space-y-1 text-xs">
            {alerts.slice(0, 8).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="underline text-left"
                  onClick={() => setSelectedId(a.id)}
                >
                  {a.errorCode || 'error'} · {statusLabel(a.status)}
                  {a.lastError ? ` — ${a.lastError.slice(0, 80)}` : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Search error, person, route…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="queued">Queued</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="offered">Offered (Yes/No)</SelectItem>
            <SelectItem value="awaiting_cursor_approval">Needs Cursor OK</SelectItem>
            <SelectItem value="pr_open">PR open</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="merged">Merged</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" size="sm" variant="outline" onClick={() => void refresh()}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
        <span className="text-xs text-slate-500">
          Queue: {queueDepth} · Active: {activeRuns}
        </span>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        <Card className="md:col-span-1 overflow-hidden flex flex-col">
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {jobs.map((j) => (
              <button
                key={j.id}
                type="button"
                onClick={() => setSelectedId(j.id)}
                className={`w-full text-left p-3 border-b hover:bg-slate-50 ${
                  selectedId === j.id ? 'bg-amber-50' : ''
                }`}
              >
                <p className="font-medium text-sm truncate">{j.errorCode || 'No code'}</p>
                <p className="text-xs text-slate-500">
                  {statusLabel(j.status)} · {j.requesterName} · {j.scope}
                </p>
                <p className="text-xs text-slate-600 truncate mt-1">{j.description}</p>
              </button>
            ))}
            {jobs.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No code-fix jobs yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 overflow-hidden flex flex-col">
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 text-sm">
            {!selected && <p className="text-slate-500">Select a job to view details.</p>}
            {selected && (
              <>
                <div className="flex flex-wrap gap-2">
                  {['failed', 'cancelled', 'awaiting_cursor_approval'].includes(selected.status) && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => void retryCodeFix(selected.id).then(() => refresh())}
                    >
                      Retry
                    </Button>
                  )}
                  {selected.status === 'awaiting_cursor_approval' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void retryCodeFix(selected.id, { cursorApproved: true }).then(() => refresh())
                      }
                    >
                      Approve & run surgical
                    </Button>
                  )}
                  {selected.status === 'pr_open' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void updateCodeFixStatus(selected.id, 'merged').then(() => refresh())
                      }
                    >
                      Mark merged
                    </Button>
                  )}
                  {selected.prUrl && (
                    <a
                      href={selected.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-800 underline"
                    >
                      Open PR <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {selected.cursorAgentUrl && (
                    <a
                      href={selected.cursorAgentUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-amber-800 underline"
                    >
                      Open Cursor agent <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt className="text-slate-500">Status</dt>
                  <dd>{statusLabel(selected.status)}</dd>
                  <dt className="text-slate-500">Scope</dt>
                  <dd>{selected.scope}</dd>
                  <dt className="text-slate-500">Requester</dt>
                  <dd>{selected.requesterName} ({selected.requesterRole})</dd>
                  <dt className="text-slate-500">Route</dt>
                  <dd className="truncate">{selected.route || '—'}</dd>
                  <dt className="text-slate-500">Attempts</dt>
                  <dd>{selected.attemptCount} / {selected.maxAttempts}</dd>
                  <dt className="text-slate-500">Created</dt>
                  <dd>{new Date(selected.createdAt).toLocaleString('en-GB')}</dd>
                  <dt className="text-slate-500">Repo</dt>
                  <dd className="truncate">{selected.repoUrl || '—'}</dd>
                </dl>
                <div>
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="whitespace-pre-wrap">{selected.description}</p>
                </div>
                {selected.lastError && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-900 whitespace-pre-wrap">
                    {selected.lastError}
                  </div>
                )}
                {selected.screenshotDataUrl && (
                  <img
                    src={selected.screenshotDataUrl}
                    alt="Error screenshot"
                    className="max-h-48 rounded border"
                  />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
