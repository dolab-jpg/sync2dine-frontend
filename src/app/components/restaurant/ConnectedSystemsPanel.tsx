import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Plug, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import IntegrationsLogoStrip from './IntegrationsLogoStrip';
import SquareConnectPanel from './SquareConnectPanel';

type Direction = 'inbound' | 'outbound' | 'both';
type Provider = 'mock' | 'deliverect' | 'otter' | 'custom' | 'square';

type ConnectorPublicConfig = {
  orgId?: string;
  provider: Provider;
  enabled: boolean;
  direction: Direction;
  outboundUrl: string;
  /** Never return raw secret once stored — only hasSecret / masked */
  hasSecret?: boolean;
  secretMasked?: string;
  lastMenuSyncAt?: string;
  menuVersion?: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastError?: string;
  menuCompleteness?: { declared: number; total: number };
};

type ConnectorEvent = {
  id: string;
  at: string;
  direction?: string;
  event?: string;
  ok?: boolean;
  summary?: string;
  payload?: unknown;
};

function orgHeaders(): HeadersInit {
  const orgId = getActiveOrgId();
  return {
    'Content-Type': 'application/json',
    ...(orgId ? { 'x-org-id': orgId } : {}),
  };
}

/**
 * Connected systems — Direction A receive / B send. Never shows stored secrets.
 */
export default function ConnectedSystemsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [apiMissing, setApiMissing] = useState(false);
  const [config, setConfig] = useState<ConnectorPublicConfig>({
    provider: 'mock',
    enabled: false,
    direction: 'inbound',
    outboundUrl: '',
  });
  const [secretDraft, setSecretDraft] = useState('');
  const [events, setEvents] = useState<ConnectorEvent[]>([]);
  const [logOpen, setLogOpen] = useState(false);
  const [expandedEvent, setExpandedEvent] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgRes, evRes] = await Promise.all([
        fetch('/api/connectors/config', { headers: orgHeaders() }),
        fetch('/api/connectors/events?limit=30', { headers: orgHeaders() }),
      ]);
      if (cfgRes.status === 404) {
        setApiMissing(true);
        return;
      }
      setApiMissing(false);
      if (cfgRes.ok) {
        const data = await cfgRes.json() as {
          config?: Record<string, unknown> | null;
        } & Record<string, unknown>;
        const cfg = (data.config ?? data) as Record<string, unknown>;
        if (cfg && typeof cfg === 'object') {
          setConfig({
            provider: (String(cfg.provider ?? 'mock') as Provider),
            enabled: Boolean(cfg.enabled),
            direction: (String(cfg.direction ?? 'inbound') as Direction),
            outboundUrl: String(cfg.outboundUrl ?? ''),
            hasSecret: Boolean(cfg.hasWebhookSecret ?? cfg.hasSecret),
            secretMasked: cfg.webhookSecretMasked != null
              ? String(cfg.webhookSecretMasked)
              : cfg.secretMasked != null
                ? String(cfg.secretMasked)
                : undefined,
            lastMenuSyncAt: cfg.lastMenuSyncAt != null ? String(cfg.lastMenuSyncAt) : undefined,
            menuVersion: cfg.menuVersion != null ? String(cfg.menuVersion) : undefined,
            lastInboundAt: cfg.lastInboundAt != null ? String(cfg.lastInboundAt) : undefined,
            lastOutboundAt: cfg.lastOutboundAt != null ? String(cfg.lastOutboundAt) : undefined,
            lastError: cfg.lastError != null ? String(cfg.lastError) : undefined,
            menuCompleteness: cfg.menuCompleteness as ConnectorPublicConfig['menuCompleteness'],
          });
        }
        setSecretDraft('');
      }
      if (evRes.ok) {
        const data = await evRes.json() as { events?: Array<Record<string, unknown>> };
        const raw = Array.isArray(data.events) ? data.events : [];
        setEvents(raw.map((ev) => ({
          id: String(ev.id ?? ''),
          at: String(ev.createdAt ?? ev.at ?? ''),
          direction: ev.direction != null ? String(ev.direction) : undefined,
          event: String(ev.eventType ?? ev.event ?? 'event'),
          ok: String(ev.status ?? '') !== 'error',
          summary: ev.error != null ? String(ev.error) : ev.externalId != null ? `ext ${ev.externalId}` : undefined,
          payload: ev.payload,
        })));
      }
    } catch {
      setApiMissing(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    // #region agent log
    // #endregion
  }, [config.provider, apiMissing, loading]);

  async function save() {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        provider: config.provider,
        enabled: config.enabled,
        direction: config.direction,
        outboundUrl: config.outboundUrl,
      };
      if (secretDraft.trim()) body.webhookSecret = secretDraft.trim();
      const res = await fetch('/api/connectors/config', {
        method: 'PUT',
        headers: orgHeaders(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Connected systems saved');
      setSecretDraft('');
      await load();
    } catch {
      toast.error('Could not save connector config — is the API live?');
    } finally {
      setSaving(false);
    }
  }

  async function retryLast() {
    try {
      const res = await fetch('/api/connectors/queue/process', {
        method: 'POST',
        headers: orgHeaders(),
        body: '{}',
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { processed?: number };
      toast.success(data.processed != null ? `Processed ${data.processed} queued event(s)` : 'Queue processed');
      await load();
    } catch {
      toast.error('Outbound queue retry failed');
    }
  }

  async function syncMenu() {
    try {
      const res = await fetch('/api/connectors/menu/sync', {
        method: 'POST',
        headers: orgHeaders(),
        body: '{}',
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Menu sync recorded');
      await load();
    } catch {
      toast.error('Menu sync failed');
    }
  }

  function copyPayload(payload: unknown) {
    void navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    toast.success('Copied');
  }

  const completeness = config.menuCompleteness;
  const completePct =
    completeness && completeness.total > 0
      ? Math.round((completeness.declared / completeness.total) * 100)
      : null;

  return (
    <div className="space-y-4" data-testid="connected-systems-panel">
      <div className="flex items-start gap-3">
        <Plug className="mt-1 h-6 w-6 shrink-0 text-s2d-teal" />
        <div>
          <h2 className="text-xl font-bold text-s2d-teal-deep">Connected systems</h2>
          <p className="text-sm text-slate-600">
            Direction A: receive marketplace orders from Deliverect/Otter onto this board.
            Direction B: send phone orders into Square (or a delivery hub webhook).
          </p>
        </div>
      </div>

      <IntegrationsLogoStrip compact showIntro={false} />

      {apiMissing ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm font-semibold text-amber-950">
          Could not reach `/api/connectors/config` — check API auth / org header.
        </p>
      ) : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Provider</Label>
              <select
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-semibold"
                value={config.provider}
                onChange={(e) => {
                  const provider = e.target.value as Provider;
                  setConfig({
                    ...config,
                    provider,
                    ...(provider === 'square' ? { direction: 'outbound' as Direction } : {}),
                  });
                }}
                data-testid="connector-provider"
              >
                <option value="square">Square (POS outbound)</option>
                <option value="mock">Mock (E2E)</option>
                <option value="deliverect">Deliverect</option>
                <option value="otter">Otter</option>
                <option value="custom">Custom webhook</option>
              </select>
            </div>
            <div>
              <Label>Direction</Label>
              <select
                className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-semibold"
                value={config.direction}
                onChange={(e) => setConfig({ ...config, direction: e.target.value as Direction })}
                data-testid="connector-direction"
              >
                <option value="inbound">A — Receive into Sync2Dine</option>
                <option value="outbound">B — Send to hub</option>
                <option value="both">Both directions</option>
              </select>
            </div>
          </div>

          {config.provider === 'square' ? (
            <SquareConnectPanel />
          ) : (
            <>
          <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3">
            <span className="font-bold text-s2d-teal-deep">Enabled</span>
            <Switch checked={config.enabled} onCheckedChange={(v) => setConfig({ ...config, enabled: v })} />
          </label>

          <div>
            <Label htmlFor="connector-url">Outbound webhook URL</Label>
            <Input
              id="connector-url"
              className="mt-1 min-h-12"
              value={config.outboundUrl}
              onChange={(e) => setConfig({ ...config, outboundUrl: e.target.value })}
              placeholder="https://…"
              data-testid="connector-outbound-url"
            />
          </div>

          <div>
            <Label htmlFor="connector-secret">
              Webhook secret {config.hasSecret ? '(stored — leave blank to keep)' : ''}
            </Label>
            <Input
              id="connector-secret"
              type="password"
              autoComplete="new-password"
              className="mt-1 min-h-12"
              value={secretDraft}
              onChange={(e) => setSecretDraft(e.target.value)}
              placeholder={config.hasSecret ? (config.secretMasked || '••••••••') : 'Set a new secret'}
              data-testid="connector-secret"
            />
            {config.hasSecret ? (
              <p className="mt-1 text-xs text-slate-500">Secret is stored server-side and never shown again.</p>
            ) : null}
          </div>

          <div className="grid gap-2 rounded-xl bg-s2d-cream/60 p-3 text-sm sm:grid-cols-2">
            <p><span className="font-bold">Menu version:</span> {config.menuVersion || '—'}</p>
            <p><span className="font-bold">Last menu sync:</span> {config.lastMenuSyncAt ? new Date(config.lastMenuSyncAt).toLocaleString() : '—'}</p>
            <p><span className="font-bold">Last inbound:</span> {config.lastInboundAt ? new Date(config.lastInboundAt).toLocaleString() : '—'}</p>
            <p><span className="font-bold">Last outbound:</span> {config.lastOutboundAt ? new Date(config.lastOutboundAt).toLocaleString() : '—'}</p>
            <p className="sm:col-span-2">
              <span className="font-bold">Allergen completeness:</span>{' '}
              {completePct != null && completeness
                ? `${completeness.declared}/${completeness.total} dishes declared (${completePct}%)`
                : '—'}
            </p>
            {config.lastError ? (
              <p className="sm:col-span-2 font-semibold text-red-700">Last error: {config.lastError}</p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-12 flex-1 bg-s2d-teal-deep font-bold text-white hover:bg-s2d-teal sm:flex-none"
              disabled={saving || apiMissing}
              onClick={() => void save()}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void load()}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button type="button" variant="outline" className="min-h-12" disabled={apiMissing} onClick={() => void retryLast()}>
              Process outbound queue
            </Button>
            <Button type="button" variant="outline" className="min-h-12" disabled={apiMissing} onClick={() => void syncMenu()}>
              Sync menu
            </Button>
          </div>

          <div className="rounded-xl border border-slate-200">
            <button
              type="button"
              className="flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left font-bold text-s2d-teal-deep touch-manipulation"
              onClick={() => setLogOpen((o) => !o)}
              data-testid="connector-event-log-toggle"
            >
              {logOpen ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
              Event log ({events.length})
            </button>
            {logOpen && (
              <ul className="max-h-64 space-y-2 overflow-y-auto border-t px-3 py-3" data-testid="connector-event-log">
                {events.length === 0 && <li className="text-sm text-slate-500">No events yet.</li>}
                {events.map((ev) => (
                  <li key={ev.id} className="rounded-lg bg-slate-50 p-2 text-sm">
                    <button
                      type="button"
                      className="flex w-full items-start justify-between gap-2 text-left"
                      onClick={() => setExpandedEvent((id) => (id === ev.id ? null : ev.id))}
                    >
                      <span>
                        <span className="font-bold">{ev.event || 'event'}</span>
                        <span className="text-slate-500"> · {ev.at ? new Date(ev.at).toLocaleString() : ''}</span>
                        {ev.summary ? <span className="mt-0.5 block text-slate-700">{ev.summary}</span> : null}
                      </span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${ev.ok === false ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {ev.ok === false ? 'Error' : 'OK'}
                      </span>
                    </button>
                    {expandedEvent === ev.id && ev.payload != null && (
                      <div className="mt-2">
                        <pre className="max-w-full overflow-x-auto rounded-md bg-slate-900 p-2 text-[11px] text-slate-100">
                          {JSON.stringify(ev.payload, null, 2)}
                        </pre>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 min-h-10"
                          onClick={() => copyPayload(ev.payload)}
                        >
                          <Copy className="mr-1 h-3.5 w-3.5" />
                          Copy payload
                        </Button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
