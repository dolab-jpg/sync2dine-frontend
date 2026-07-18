import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import {
  listPhoneIncidents,
  ackPhoneIncident,
  dismissPhoneIncident,
  resolvePhoneIncident,
  batchPhoneIncidentCodeFix,
  severityLabel,
  statusLabel,
  type PhoneOpsIncident,
  type PhoneOpsWebhookHealth,
} from '../../engine/ai/phoneIncidentsService';
import { AlertTriangle, ChevronDown, ChevronRight, Phone, RefreshCw } from 'lucide-react';

function WebhookHealthStrip({ health }: { health: PhoneOpsWebhookHealth | null }) {
  if (!health) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Checking voice webhook health…
      </div>
    );
  }
  const errNewer =
    health.lastWebhookErrorAt
    && (!health.lastWebhookOkAt
      || health.lastWebhookErrorAt > health.lastWebhookOkAt);
  const tone = errNewer
    ? 'border-red-300 bg-red-50 text-red-900'
    : health.lastWebhookOkAt
      ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
      : 'border-slate-200 bg-slate-50 text-slate-700';
  return (
    <div className={`rounded-lg border px-3 py-2 text-sm ${tone}`}>
      <div className="flex items-center gap-2 font-medium">
        <Phone className="w-4 h-4" />
        Voice webhook health
      </div>
      <p className="text-xs mt-1">
        Last OK:{' '}
        {health.lastWebhookOkAt
          ? new Date(health.lastWebhookOkAt).toLocaleString('en-GB')
          : '—'}
        {' · '}
        Last error:{' '}
        {health.lastWebhookErrorAt
          ? `${new Date(health.lastWebhookErrorAt).toLocaleString('en-GB')}${
              health.lastWebhookStatus ? ` (${health.lastWebhookStatus})` : ''
            }`
          : '—'}
      </p>
      {health.lastWebhookError && (
        <p className="text-xs mt-1 opacity-90 truncate">{health.lastWebhookError}</p>
      )}
    </div>
  );
}

function DetailSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs font-medium bg-slate-50 hover:bg-slate-100"
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {title}
      </button>
      {open && <div className="px-3 py-2 text-sm border-t border-slate-100">{children}</div>}
    </div>
  );
}

export function PhoneErrorsAudit({ initialId }: { initialId?: string | null }) {
  const [incidents, setIncidents] = useState<PhoneOpsIncident[]>([]);
  const [alerts, setAlerts] = useState<PhoneOpsIncident[]>([]);
  const [health, setHealth] = useState<PhoneOpsWebhookHealth | null>(null);
  const [statusFilter, setStatusFilter] = useState('open');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(initialId ?? null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sections, setSections] = useState<Record<string, boolean>>({
    summary: true,
    call: true,
    tool: true,
    raw: false,
    fix: true,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listPhoneIncidents({
        status: statusFilter === 'all' ? undefined : statusFilter,
        severity: severityFilter === 'all' ? undefined : severityFilter,
        search: search || undefined,
      });
      setIncidents(data.incidents);
      setAlerts(data.alerts);
      setHealth(data.health);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, severityFilter, search]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 10_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (initialId) setSelectedId(initialId);
  }, [initialId]);

  const selected = incidents.find((i) => i.id === selectedId)
    ?? alerts.find((i) => i.id === selectedId)
    ?? null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSection = (key: string) => {
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const runBatch = async (action: 'offer' | 'enqueue') => {
    const ids = selectedIds.size > 0
      ? [...selectedIds]
      : selectedId
        ? [selectedId]
        : [];
    if (ids.length === 0) {
      setNote('Select one or more incidents first.');
      return;
    }
    if (action === 'enqueue') {
      const ok = window.confirm(
        `Enqueue up to ${Math.min(ids.length, 5)} Cursor code-fix jobs? Auto-start stays off for phone — this explicitly queues them.`,
      );
      if (!ok) return;
    }
    setBusy(true);
    setNote(null);
    try {
      const result = await batchPhoneIncidentCodeFix({
        ids: ids.slice(0, 5),
        action,
        requesterName: 'Phone ops audit',
        requesterRole: 'platform_owner',
      });
      setNote(
        action === 'offer'
          ? `Offered ${result.offered} code fix(es). Cap ${result.cap}.`
          : `Enqueued ${result.enqueued} code fix(es). Cap ${result.cap}.`,
      );
      setSelectedIds(new Set());
      await refresh();
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 gap-3">
      <WebhookHealthStrip health={health} />

      {alerts.length > 0 && (
        <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900">
          <div className="flex items-center gap-2 font-medium mb-1">
            <AlertTriangle className="w-4 h-4" />
            Alerts ({alerts.length}) — open / fixing phone & webhook failures
          </div>
          <ul className="space-y-1 text-xs">
            {alerts.slice(0, 8).map((a) => (
              <li key={a.id}>
                <button
                  type="button"
                  className="underline text-left"
                  onClick={() => setSelectedId(a.id)}
                >
                  {severityLabel(a.severity)}
                  {a.toolName ? ` · ${a.toolName}` : ''}
                  {' — '}
                  {a.error.slice(0, 80)}
                  {a.count > 1 ? ` (×${a.count})` : ''}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center">
        <Input
          placeholder="Search error, tool, call, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="acked">Acked</SelectItem>
            <SelectItem value="fixing">Fixing</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="dismissed">Dismissed</SelectItem>
          </SelectContent>
        </Select>
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All severities</SelectItem>
            <SelectItem value="tool_fail">Tool fail</SelectItem>
            <SelectItem value="webhook_fail">Webhook fail</SelectItem>
            <SelectItem value="call_fail">Call fail</SelectItem>
            <SelectItem value="stuck_call">Stuck call</SelectItem>
            <SelectItem value="finalize_error">Finalize error</SelectItem>
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
          disabled={busy || (selectedIds.size === 0 && !selectedId)}
          onClick={() => void runBatch('offer')}
        >
          Offer code fix ({selectedIds.size || (selectedId ? 1 : 0)})
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={busy || (selectedIds.size === 0 && !selectedId)}
          onClick={() => void runBatch('enqueue')}
        >
          Enqueue selected
        </Button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {note && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          {note}
        </p>
      )}

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 min-h-0">
        <Card className="md:col-span-1 overflow-hidden flex flex-col">
          <CardContent className="p-0 flex-1 overflow-y-auto">
            {incidents.map((i) => (
              <div
                key={i.id}
                className={`flex items-start gap-2 border-b hover:bg-slate-50 ${
                  selectedId === i.id ? 'bg-amber-50' : ''
                }`}
              >
                <label className="pl-3 pt-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(i.id)}
                    onChange={() => toggleSelect(i.id)}
                    aria-label={`Select ${i.id}`}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setSelectedId(i.id)}
                  className="flex-1 text-left p-3"
                >
                  <p className="font-medium text-sm truncate">
                    {severityLabel(i.severity)}
                    {i.toolName ? ` · ${i.toolName}` : ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    {statusLabel(i.status)}
                    {i.count > 1 ? ` · ×${i.count}` : ''}
                    {' · '}
                    {new Date(i.lastSeenAt).toLocaleString('en-GB')}
                  </p>
                  <p className="text-xs text-slate-600 truncate mt-1">{i.error}</p>
                </button>
              </div>
            ))}
            {incidents.length === 0 && (
              <p className="p-4 text-sm text-slate-500">No phone incidents yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2 overflow-hidden flex flex-col">
          <CardContent className="p-4 flex-1 overflow-y-auto space-y-3 text-sm">
            {!selected && <p className="text-slate-500">Select an incident to view details.</p>}
            {selected && (
              <>
                <div className="flex flex-wrap gap-2">
                  {selected.status === 'open' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void ackPhoneIncident(selected.id).then(() => refresh())
                      }
                    >
                      Ack
                    </Button>
                  )}
                  {selected.status !== 'resolved' && selected.status !== 'dismissed' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void resolvePhoneIncident(selected.id).then(() => refresh())
                      }
                    >
                      Resolve
                    </Button>
                  )}
                  {selected.status !== 'dismissed' && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void dismissPhoneIncident(selected.id).then(() => refresh())
                      }
                    >
                      Dismiss
                    </Button>
                  )}
                  {selected.callId && (
                    <Link
                      to="/calls"
                      className="inline-flex items-center text-xs text-amber-800 underline px-2"
                    >
                      Open Call Centre
                    </Link>
                  )}
                  {selected.codeFixJobId && (
                    <Link
                      to={`/ai-audit?tab=code_fixes`}
                      className="inline-flex items-center text-xs text-amber-800 underline px-2"
                    >
                      Linked code fix
                    </Link>
                  )}
                </div>

                <DetailSection
                  title="Summary"
                  open={sections.summary !== false}
                  onToggle={() => toggleSection('summary')}
                >
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <dt className="text-slate-500">Severity</dt>
                    <dd>{severityLabel(selected.severity)}</dd>
                    <dt className="text-slate-500">Status</dt>
                    <dd>{statusLabel(selected.status)}</dd>
                    <dt className="text-slate-500">Count</dt>
                    <dd>{selected.count}</dd>
                    <dt className="text-slate-500">First seen</dt>
                    <dd>{new Date(selected.createdAt).toLocaleString('en-GB')}</dd>
                    <dt className="text-slate-500">Last seen</dt>
                    <dd>{new Date(selected.lastSeenAt).toLocaleString('en-GB')}</dd>
                    <dt className="text-slate-500">Spoken soft-fail</dt>
                    <dd>{selected.spokenSoftFail ? 'Yes (caller heard fallback)' : '—'}</dd>
                  </dl>
                  <p className="mt-2 whitespace-pre-wrap text-xs">{selected.error}</p>
                </DetailSection>

                <DetailSection
                  title="Call context"
                  open={sections.call !== false}
                  onToggle={() => toggleSection('call')}
                >
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <dt className="text-slate-500">Call id</dt>
                    <dd className="truncate font-mono">{selected.callId || '—'}</dd>
                    <dt className="text-slate-500">Provider call</dt>
                    <dd className="truncate font-mono">{selected.providerCallId || '—'}</dd>
                    <dt className="text-slate-500">Caller</dt>
                    <dd>{selected.callerPhone || '—'}</dd>
                    <dt className="text-slate-500">Outcome</dt>
                    <dd>{selected.outcome || '—'}</dd>
                    <dt className="text-slate-500">Route</dt>
                    <dd className="truncate">{selected.route || '—'}</dd>
                  </dl>
                </DetailSection>

                <DetailSection
                  title="Tool / error"
                  open={sections.tool !== false}
                  onToggle={() => toggleSection('tool')}
                >
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                    <dt className="text-slate-500">Tool</dt>
                    <dd>{selected.toolName || '—'}</dd>
                    <dt className="text-slate-500">Error</dt>
                    <dd className="whitespace-pre-wrap col-span-1">{selected.error}</dd>
                  </dl>
                </DetailSection>

                <DetailSection
                  title="Raw details"
                  open={Boolean(sections.raw)}
                  onToggle={() => toggleSection('raw')}
                >
                  <pre className="text-[11px] overflow-x-auto whitespace-pre-wrap bg-slate-50 p-2 rounded border max-h-64">
                    {JSON.stringify(selected.details ?? {}, null, 2)}
                  </pre>
                </DetailSection>

                <DetailSection
                  title="Linked code fix"
                  open={sections.fix !== false}
                  onToggle={() => toggleSection('fix')}
                >
                  {selected.codeFixJobId ? (
                    <p className="text-xs">
                      Job <code className="text-[11px]">{selected.codeFixJobId}</code>
                      {' — '}
                      <Link to="/ai-audit?tab=code_fixes" className="underline text-amber-800">
                        Open Code fixes tab
                      </Link>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      No code-fix job yet. Use Offer / Enqueue (multi-select supported, max 5).
                    </p>
                  )}
                </DetailSection>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
