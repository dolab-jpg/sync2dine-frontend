import { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
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
  deleteCodeFix,
  deleteCodeFixBatch,
  getCodeFixHealth,
  statusLabel,
  traePromptFromJob,
  enqueueCodeFix,
  dismissCodeFix,
  type CodeFixJob,
  type CodeFixHealth,
} from '../../engine/ai/codeFixService';
import { AlertTriangle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import { AppContext } from '../../App';

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
  const app = useContext(AppContext);
  const [searchParams, setSearchParams] = useSearchParams();
  const focusOffers = searchParams.get('focus') === 'offers';
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
  const [actingOfferId, setActingOfferId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mergeNote, setMergeNote] = useState<string | null>(null);
  const [prUrlDraft, setPrUrlDraft] = useState('');
  const [offeredJobs, setOfferedJobs] = useState<CodeFixJob[]>([]);

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
      // Always load pending offers for the dedicated section (independent of status filter).
      if (statusFilter === 'offered') {
        setOfferedJobs(data.jobs.filter((j) => j.status === 'offered'));
      } else {
        const offered = await listCodeFixJobs({ status: 'offered' });
        setOfferedJobs(offered.jobs.filter((j) => j.status === 'offered'));
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
  const selectedTraePrompt = selected ? traePromptFromJob(selected) : null;
  const pendingOffers = useMemo(
    () => offeredJobs.filter((j) => j.status === 'offered'),
    [offeredJobs],
  );

  useEffect(() => {
    setPrUrlDraft(selected?.prUrl ?? '');
  }, [selected?.id, selected?.prUrl]);

  useEffect(() => {
    if (!focusOffers) return;
    const el = document.getElementById('pending-offers');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [focusOffers, pendingOffers.length]);

  const handleQueueOffer = async (job: CodeFixJob) => {
    setActingOfferId(job.id);
    try {
      const role = String(app?.user.role ?? 'staff');
      await enqueueCodeFix({
        jobId: job.id,
        errorCode: job.errorCode,
        description: job.description,
        route: job.route,
        requesterRole: role === 'platform_owner' ? 'super_admin' : role,
        requesterName: app?.user.name || 'Staff',
        requesterUserId: app?.user.id,
        orgId: getActiveOrgId() || undefined,
      });
      toast.success(`Queued ${job.errorCode || 'fix'} for Trae`);
      if (focusOffers) {
        const next = new URLSearchParams(searchParams);
        next.delete('focus');
        setSearchParams(next, { replace: true });
      }
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setActingOfferId(null);
    }
  };

  const handleDismissOffer = async (job: CodeFixJob) => {
    setActingOfferId(job.id);
    try {
      await dismissCodeFix(job.id);
      toast.message(`Dismissed ${job.errorCode || 'offer'}`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setActingOfferId(null);
    }
  };

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

  const handleDeleteSelected = async () => {
    const ids = selectedIds.size > 0
      ? [...selectedIds]
      : selectedId
        ? [selectedId]
        : [];
    if (ids.length === 0) return;
    if (!window.confirm(`Permanently delete ${ids.length} code-fix job(s)?`)) return;
    setMerging(true);
    setMergeNote(null);
    try {
      const result = await deleteCodeFixBatch(ids);
      toast.success(`Deleted ${result.deleted} job(s)`);
      if (selectedId && ids.includes(selectedId)) setSelectedId(null);
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setMerging(false);
    }
  };

  const handleDeleteOne = async (jobId: string) => {
    if (!window.confirm('Permanently delete this code-fix job?')) return;
    setMerging(true);
    try {
      await deleteCodeFix(jobId);
      toast.success('Job deleted');
      if (selectedId === jobId) setSelectedId(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <HealthBadge health={health} />

      <div
        id="pending-offers"
        className={`rounded-lg border px-3 py-3 text-sm ${
          focusOffers || pendingOffers.length > 0
            ? 'border-amber-300 bg-amber-50 text-amber-950'
            : 'border-slate-200 bg-slate-50 text-slate-700'
        }`}
      >
        <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
          <div>
            <p className="font-semibold">Pending offers</p>
            <p className="text-xs opacity-90">
              Runtime errors land here — not in Cynthia chat. Queue for Trae or dismiss.
            </p>
          </div>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-white/80 border border-amber-200">
            {pendingOffers.length} pending
          </span>
        </div>
        {pendingOffers.length === 0 ? (
          <p className="text-xs opacity-80">No pending offers right now.</p>
        ) : (
          <ul className="space-y-2">
            {pendingOffers.slice(0, 12).map((job) => (
              <li
                key={job.id}
                className="rounded-md border border-amber-200/80 bg-white px-3 py-2 flex flex-col sm:flex-row sm:items-center gap-2"
              >
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => {
                    setSelectedId(job.id);
                    setStatusFilter('offered');
                  }}
                >
                  <p className="font-medium text-sm truncate">{job.errorCode || 'Error'}</p>
                  <p className="text-xs text-slate-600 truncate">
                    {job.route || 'unknown route'} · {job.description.slice(0, 120)}
                  </p>
                </button>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    disabled={actingOfferId === job.id}
                    onClick={() => void handleQueueOffer(job)}
                  >
                    Queue for Trae
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={actingOfferId === job.id}
                    onClick={() => void handleDismissOffer(job)}
                  >
                    Dismiss
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            Alerts ({alerts.length}) — offered, failed, stuck, needs Trae OK, or PRs awaiting merge
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
            <SelectItem value="queued">Queued for Trae</SelectItem>
            <SelectItem value="running">Running</SelectItem>
            <SelectItem value="offered">Pending offers</SelectItem>
            <SelectItem value="awaiting_cursor_approval">Needs Trae OK</SelectItem>
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
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={merging || (selectedIds.size === 0 && !selectedId)}
          onClick={() => void handleDeleteSelected()}
        >
          Delete selected ({selectedIds.size || (selectedId ? 1 : 0)})
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
                <label className="pl-3 pt-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(j.id)}
                    onChange={() => toggleSelect(j.id)}
                    aria-label={`Select ${j.errorCode || j.id}`}
                  />
                </label>
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
                  {selected.status === 'offered' && (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        disabled={actingOfferId === selected.id}
                        onClick={() => void handleQueueOffer(selected)}
                      >
                        Queue for Trae
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={actingOfferId === selected.id}
                        onClick={() => void handleDismissOffer(selected)}
                      >
                        Dismiss
                      </Button>
                    </>
                  )}
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
                      Approve & queue for Trae
                    </Button>
                  )}
                  {selectedTraePrompt && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard.writeText(selectedTraePrompt).then(
                          () => toast.success('Trae prompt copied'),
                          () => toast.error('Could not copy prompt'),
                        );
                      }}
                    >
                      <Copy className="w-3.5 h-3.5 mr-1" />
                      Copy Trae prompt
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
                      className="inline-flex items-center gap-1 text-xs text-slate-600 underline"
                    >
                      Legacy agent link <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={merging}
                    onClick={() => void handleDeleteOne(selected.id)}
                  >
                    Delete
                  </Button>
                </div>
                {['queued', 'awaiting_cursor_approval', 'failed', 'running'].includes(selected.status) && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                    <p className="text-xs font-medium text-slate-700">Attach PR from Trae</p>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        placeholder="https://github.com/.../pull/123"
                        value={prUrlDraft}
                        onChange={(e) => setPrUrlDraft(e.target.value)}
                        className="flex-1 min-w-[220px]"
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!prUrlDraft.trim()}
                        onClick={() =>
                          void updateCodeFixStatus(selected.id, 'pr_open', prUrlDraft.trim())
                            .then(() => {
                              toast.success('PR attached');
                              return refresh();
                            })
                            .catch((err) =>
                              toast.error(err instanceof Error ? err.message : String(err)),
                            )
                        }
                      >
                        Attach PR URL
                      </Button>
                    </div>
                  </div>
                )}
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                  <dt className="text-slate-500">Status</dt>
                  <dd>{statusLabel(selected.status)}</dd>
                  <dt className="text-slate-500">Scope</dt>
                  <dd>{selected.scope === 'needs_cursor_approval' ? 'needs Trae approval' : selected.scope}</dd>
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
                {selectedTraePrompt && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Trae prompt</p>
                    <pre className="whitespace-pre-wrap text-xs rounded-lg border bg-slate-50 p-2 max-h-48 overflow-y-auto">
                      {selectedTraePrompt}
                    </pre>
                  </div>
                )}
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
