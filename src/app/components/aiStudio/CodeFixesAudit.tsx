import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  listCodeFixJobs,
  retryCodeFix,
  updateCodeFixStatus,
  mergeCodeFix,
  mergeCodeFixBatch,
  getCodeFixHealth,
  statusLabel,
  type CodeFixJob,
  type CodeFixHealth,
} from '../../engine/ai/codeFixService';
import { AlertTriangle, ExternalLink, RefreshCw } from 'lucide-react';

function HealthBadge({ health }: { health: CodeFixHealth | null }) {
  if (!health) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Checking self-heal LIVE status…
      </div>
    );
  }
  const tone = health.live
    ? health.githubTokenConfigured
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : 'border-amber-300 bg-amber-50 text-amber-900'
    : 'border-red-300 bg-red-50 text-red-900';
  const label = health.live
    ? health.githubTokenConfigured
      ? 'LIVE'
      : 'LIVE (manual merge)'
    : 'NOT LIVE';
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <div className="flex items-center gap-2 font-medium">
        <span
          className={`w-2 h-2 rounded-full ${
            health.live
              ? health.githubTokenConfigured
                ? 'bg-emerald-500'
                : 'bg-amber-500'
              : 'bg-red-500'
          }`}
          aria-hidden
        />
        Self-heal: {label}
      </div>
      <p className="text-xs mt-1 opacity-90">{health.reason}</p>
      {!health.githubTokenConfigured && health.keyValid && (
        <p className="text-xs mt-1">
          Add <code className="text-[11px]">GITHUB_TOKEN</code> to server env or{' '}
          <code className="text-[11px]">.cursor/local/deploy.env</code> for one-click merges.
        </p>
      )}
    </div>
  );
}

export function CodeFixesAudit() {
  const [jobs, setJobs] = useState<CodeFixJob[]>([]);
  const [alerts, setAlerts] = useState<CodeFixJob[]>([]);
  const [queueDepth, setQueueDepth] = useState(0);
  const [activeRuns, setActiveRuns] = useState(0);
  const [health, setHealth] = useState<CodeFixHealth | null>(null);
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mergeNote, setMergeNote] = useState<string | null>(null);

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
      if (data.health) setHealth(data.health);
      else {
        const h = await getCodeFixHealth();
        setHealth(h);
      }
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
  const openPrJobs = jobs.filter((j) => j.status === 'pr_open' && j.prUrl);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMerge = async (jobId: string) => {
    setMerging(true);
    setMergeNote(null);
    try {
      const result = await mergeCodeFix(jobId);
      if (result.merged) {
        setMergeNote('Merged successfully.');
      } else if (result.needsManualMerge && result.prUrl) {
        setMergeNote(result.error || 'Open the PR on GitHub to merge manually.');
        window.open(result.prUrl, '_blank', 'noopener,noreferrer');
      } else {
        setMergeNote(result.error || 'Merge failed.');
      }
      await refresh();
    } catch (err) {
      setMergeNote(err instanceof Error ? err.message : String(err));
    } finally {
      setMerging(false);
    }
  };

  const handleBatchMerge = async (allOpen: boolean) => {
    setMerging(true);
    setMergeNote(null);
    try {
      const result = await mergeCodeFixBatch(
        allOpen ? { allOpen: true } : { ids: [...selectedIds] },
      );
      const manual = result.results.filter((r) => r.needsManualMerge && r.prUrl);
      setMergeNote(
        `Merged ${result.merged}. Manual needed: ${result.needsManual}.` +
          (manual[0]?.error ? ` First error: ${manual[0].error}` : ''),
      );
      if (manual[0]?.prUrl) {
        window.open(manual[0].prUrl, '_blank', 'noopener,noreferrer');
      }
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      setMergeNote(err instanceof Error ? err.message : String(err));
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <HealthBadge health={health} />

      {alerts.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            Alerts ({alerts.length}) — failed, stuck, needs Cursor OK, or PRs awaiting merge
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={merging || selectedIds.size === 0}
          onClick={() => void handleBatchMerge(false)}
        >
          Approve & merge selected ({selectedIds.size})
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={merging || openPrJobs.length === 0}
          onClick={() => void handleBatchMerge(true)}
        >
          Approve all open PRs ({openPrJobs.length})
        </Button>
        <span className="text-xs text-slate-500">
          Queue: {queueDepth} · Active: {activeRuns}
        </span>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {mergeNote && <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">{mergeNote}</p>}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        <Card className="md:col-span-1 overflow-hidden flex flex-col">
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {jobs.map((j) => (
              <div
                key={j.id}
                className={`flex items-start gap-2 border-b hover:bg-slate-50 ${
                  selectedId === j.id ? 'bg-amber-50' : ''
                }`}
              >
                {j.status === 'pr_open' && (
                  <label className="pl-3 pt-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(j.id)}
                      onChange={() => toggleSelect(j.id)}
                      aria-label={`Select ${j.errorCode || j.id}`}
                    />
                  </label>
                )}
                <button
                  type="button"
                  onClick={() => setSelectedId(j.id)}
                  className="flex-1 text-left p-3"
                >
                  <p className="font-medium text-sm truncate">{j.errorCode || 'No code'}</p>
                  <p className="text-xs text-slate-500">
                    {statusLabel(j.status)} · {j.requesterName} · {j.scope}
                  </p>
                  <p className="text-xs text-slate-600 truncate mt-1">{j.description}</p>
                </button>
              </div>
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
                      disabled={merging || !selected.prUrl}
                      onClick={() => void handleMerge(selected.id)}
                    >
                      Approve & merge
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
