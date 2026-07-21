import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ExternalLink, Plug, RefreshCw, Unplug } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import { getActiveOrgId } from '../../engine/platform/orgContext';

type SquareConfig = {
  provider?: string;
  enabled?: boolean;
  direction?: string;
  posPush?: 'manual_only' | 'on_place' | 'off';
  squareLocationId?: string;
  squareConnectionStatus?: 'not_connected' | 'connected' | 'token_expired';
  hasSquareToken?: boolean;
  squareTokenMasked?: string;
  squareMerchantId?: string;
  defaultPickupName?: string;
  defaultPickupPhone?: string;
  fulfillmentAddressLine1?: string;
  fulfillmentAddressCity?: string;
  fulfillmentAddressPostcode?: string;
  fulfillmentAddressCountry?: string;
  lastError?: string;
  lastOutboundAt?: string;
  lastTestPushAt?: string;
  lastTestPushOk?: boolean;
  lastMenuSyncAt?: string;
  menuCompleteness?: { declared: number; total: number };
};

type SquareLocation = {
  id: string;
  name: string;
  addressLine1?: string;
  locality?: string;
  postalCode?: string;
  country?: string;
};

type MappingRow = {
  id: string;
  name: string;
  category: string;
  squareVariationId: string;
};

type Variation = {
  variationId: string;
  label: string;
  itemName: string;
};

function orgHeaders(): HeadersInit {
  const orgId = getActiveOrgId();
  return {
    'Content-Type': 'application/json',
    ...(orgId ? { 'x-org-id': orgId } : {}),
  };
}

export default function SquareConnectPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<SquareConfig>({});
  const [tokenDraft, setTokenDraft] = useState('');
  const [locations, setLocations] = useState<SquareLocation[]>([]);
  const [mappings, setMappings] = useState<MappingRow[]>([]);
  const [variations, setVariations] = useState<Variation[]>([]);
  const [autoPush, setAutoPush] = useState(false);

  const completeness = config.menuCompleteness;
  const completePct =
    completeness && completeness.total > 0
      ? Math.round((completeness.declared / completeness.total) * 100)
      : null;

  const selectedLocation = useMemo(
    () => locations.find((l) => l.id === config.squareLocationId),
    [locations, config.squareLocationId],
  );

  const connected = config.squareConnectionStatus === 'connected' || config.hasSquareToken === true;
  const ready =
    connected
    && Boolean(config.squareLocationId)
    && (completePct == null || completePct >= 100 || (completeness?.declared ?? 0) > 0)
    && (config.lastTestPushOk === true || (completeness?.declared === completeness?.total && (completeness?.total ?? 0) > 0));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const cfgRes = await fetch('/api/connectors/config', { headers: orgHeaders() });
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b4e46'},body:JSON.stringify({sessionId:'6b4e46',runId:'debug-square',hypothesisId:'A',location:'SquareConnectPanel.tsx:load-config',message:'connectors config response',data:{status:cfgRes.status,ok:cfgRes.ok,host:window.location.host,path:window.location.pathname},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      if (!cfgRes.ok) throw new Error(String(cfgRes.status));
      const cfgData = await cfgRes.json() as { config?: SquareConfig | null };
      const cfg = cfgData.config ?? {};
      setConfig(cfg);
      setAutoPush(
        cfg.posPush === 'on_place'
        || (cfg.posPush == null
          && cfg.enabled === true
          && (cfg.direction === 'outbound' || cfg.direction === 'both')),
      );
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b4e46'},body:JSON.stringify({sessionId:'6b4e46',runId:'debug-square',hypothesisId:'B',location:'SquareConnectPanel.tsx:config-parsed',message:'square config fields present',data:{provider:cfg.provider??null,hasSquareToken:!!cfg.hasSquareToken,connectionStatus:cfg.squareConnectionStatus??null,locationId:cfg.squareLocationId??null,enabled:!!cfg.enabled,direction:cfg.direction??null,hasMenuCompleteness:!!cfg.menuCompleteness},timestamp:Date.now()})}).catch(()=>{});
      // #endregion

      if (cfg.hasSquareToken || cfg.squareConnectionStatus === 'connected') {
        const [locRes, mapRes] = await Promise.all([
          fetch('/api/connectors/square/locations', { headers: orgHeaders() }),
          fetch('/api/connectors/menu/mapping', { headers: orgHeaders() }),
        ]);
        // #region agent log
        fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b4e46'},body:JSON.stringify({sessionId:'6b4e46',runId:'debug-square',hypothesisId:'C',location:'SquareConnectPanel.tsx:locations-mapping',message:'square locations/mapping responses',data:{locStatus:locRes.status,mapStatus:mapRes.status},timestamp:Date.now()})}).catch(()=>{});
        // #endregion
        if (locRes.ok) {
          const locData = await locRes.json() as { locations?: SquareLocation[] };
          setLocations(Array.isArray(locData.locations) ? locData.locations : []);
        }
        if (mapRes.ok) {
          const mapData = await mapRes.json() as {
            items?: MappingRow[];
            variations?: Variation[];
            menuCompleteness?: { declared: number; total: number };
          };
          setMappings(Array.isArray(mapData.items) ? mapData.items : []);
          setVariations(Array.isArray(mapData.variations) ? mapData.variations : []);
          if (mapData.menuCompleteness) {
            setConfig((c) => ({ ...c, menuCompleteness: mapData.menuCompleteness }));
          }
        }
      }
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b4e46'},body:JSON.stringify({sessionId:'6b4e46',runId:'debug-square',hypothesisId:'A',location:'SquareConnectPanel.tsx:load-error',message:'square panel load failed',data:{error:err instanceof Error?err.message:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      toast.error('Could not load Square connector config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    if (params.get('square') === 'connected') {
      toast.success('Square connected');
      params.delete('square');
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', next);
    } else if (params.get('square') === 'error') {
      toast.error(`Square connect failed: ${params.get('reason') || 'unknown'}`);
    }
  }, [load]);

  async function saveConfig(patch: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch('/api/connectors/config', {
        method: 'PUT',
        headers: orgHeaders(),
        body: JSON.stringify({
          provider: 'square',
          direction: 'outbound',
          enabled: autoPush,
          // OrderService reads posPush: on_place pushes after place; manual_only = staff retry only
          posPush: autoPush ? 'on_place' : 'manual_only',
          ...patch,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { config?: SquareConfig };
      if (data.config) setConfig(data.config);
      toast.success('Square settings saved');
      await load();
    } catch {
      toast.error('Could not save Square settings');
    } finally {
      setSaving(false);
    }
  }

  function connectOAuth() {
    // #region agent log
    fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'6b4e46'},body:JSON.stringify({sessionId:'6b4e46',runId:'debug-square',hypothesisId:'D',location:'SquareConnectPanel.tsx:oauth-start',message:'user starting Square OAuth',data:{href:'/api/connectors/square/oauth/start',host:window.location.host},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    window.location.href = '/api/connectors/square/oauth/start';
  }

  async function savePat() {
    if (!tokenDraft.trim()) {
      toast.error('Paste a Square access token first');
      return;
    }
    await saveConfig({
      oauthAccessToken: tokenDraft.trim(),
      provider: 'square',
      direction: 'outbound',
    });
    setTokenDraft('');
  }

  async function disconnect() {
    try {
      const res = await fetch('/api/connectors/square/disconnect', {
        method: 'POST',
        headers: orgHeaders(),
        body: '{}',
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Square disconnected');
      setLocations([]);
      setMappings([]);
      await load();
    } catch {
      toast.error('Disconnect failed');
    }
  }

  async function syncCatalog() {
    try {
      const res = await fetch('/api/connectors/menu/sync', {
        method: 'POST',
        headers: orgHeaders(),
        body: '{}',
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Square catalog synced');
      await load();
    } catch {
      toast.error('Catalog sync failed — is Square connected?');
    }
  }

  async function applySuggested() {
    try {
      const res = await fetch('/api/connectors/menu/mapping', {
        method: 'PUT',
        headers: orgHeaders(),
        body: JSON.stringify({ applySuggested: true }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { updated?: number };
      toast.success(`Applied ${data.updated ?? 0} suggested match(es)`);
      await load();
    } catch {
      toast.error('Could not apply suggestions');
    }
  }

  async function saveMappings() {
    try {
      const res = await fetch('/api/connectors/menu/mapping', {
        method: 'PUT',
        headers: orgHeaders(),
        body: JSON.stringify({
          mappings: mappings.map((m) => ({
            menuItemId: m.id,
            squareVariationId: m.squareVariationId,
          })),
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      toast.success('Menu mapping saved');
      await load();
    } catch {
      toast.error('Could not save mapping');
    }
  }

  async function testPush() {
    try {
      const res = await fetch('/api/connectors/square/test-push', {
        method: 'POST',
        headers: orgHeaders(),
        body: '{}',
      });
      const data = await res.json() as { ok?: boolean; error?: string; externalId?: string };
      if (!res.ok || !data.ok) {
        toast.error(data.error || 'Test push failed');
      } else {
        toast.success(`Test order sent to Square (${data.externalId || 'ok'})`);
      }
      await load();
    } catch {
      toast.error('Test push failed');
    }
  }

  async function retryQueue() {
    try {
      const res = await fetch('/api/connectors/queue/process', {
        method: 'POST',
        headers: orgHeaders(),
        body: '{}',
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { processed?: number };
      toast.success(`Processed ${data.processed ?? 0} queued event(s)`);
      await load();
    } catch {
      toast.error('Queue retry failed');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-500">Loading Square integration…</p>;
  }

  return (
    <div className="space-y-5 rounded-2xl border border-s2d-teal/20 bg-white p-4" data-testid="square-connect-panel">
      <div className="flex items-start gap-3">
        <Plug className="mt-1 h-6 w-6 shrink-0 text-s2d-teal" />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold text-s2d-teal-deep">Square — POS outbound</h3>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                ready
                  ? 'bg-emerald-100 text-emerald-900'
                  : connected
                    ? 'bg-amber-100 text-amber-950'
                    : 'bg-slate-200 text-slate-800'
              }`}
            >
              {ready ? 'Ready' : connected ? 'Setup in progress' : 'Not connected'}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-600">
            Phone orders go to your Square till/kitchen. Sync2Dine stays the call screen.
          </p>
          <a
            href="https://squareup.com/signup"
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-s2d-teal-deep underline"
          >
            Don’t have Square? Create an account
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Step B — Connect */}
      <section className="space-y-3 rounded-xl border border-slate-200 p-3">
        <h4 className="font-bold text-s2d-teal-deep">1. Connect account</h4>
        <p className="text-sm text-slate-600">
          Status:{' '}
          <span className="font-semibold">
            {config.squareConnectionStatus === 'token_expired'
              ? 'Token expired'
              : connected
                ? `Connected${config.squareMerchantId ? ` (${config.squareMerchantId})` : ''}`
                : 'Not connected'}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-12 bg-s2d-teal-deep font-bold text-white" onClick={connectOAuth}>
            {connected ? 'Reconnect with Square' : 'Connect with Square'}
          </Button>
          {connected ? (
            <Button type="button" variant="outline" className="min-h-12" onClick={() => void disconnect()}>
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          ) : null}
        </div>
        <div>
          <Label htmlFor="square-pat">Sandbox / personal access token (optional)</Label>
          <Input
            id="square-pat"
            type="password"
            autoComplete="new-password"
            className="mt-1 min-h-12"
            value={tokenDraft}
            onChange={(e) => setTokenDraft(e.target.value)}
            placeholder={config.hasSquareToken ? (config.squareTokenMasked || '•••• stored') : 'sq0atp-…'}
          />
          <Button type="button" variant="outline" className="mt-2 min-h-11" disabled={saving} onClick={() => void savePat()}>
            Save token
          </Button>
        </div>
      </section>

      {/* Step C — Location */}
      <section className="space-y-3 rounded-xl border border-slate-200 p-3">
        <h4 className="font-bold text-s2d-teal-deep">2. Location</h4>
        <Label>Square location</Label>
        <select
          className="mt-1 min-h-12 w-full rounded-xl border border-slate-200 bg-white px-3 font-semibold"
          value={config.squareLocationId || ''}
          disabled={!connected}
          onChange={(e) => {
            const id = e.target.value;
            setConfig((c) => ({ ...c, squareLocationId: id }));
            void saveConfig({ squareLocationId: id, provider: 'square', direction: 'outbound' });
          }}
          data-testid="square-location"
        >
          <option value="">Select location…</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
        {selectedLocation ? (
          <p className="text-sm text-slate-600">
            {[selectedLocation.addressLine1, selectedLocation.locality, selectedLocation.postalCode, selectedLocation.country]
              .filter(Boolean)
              .join(', ') || 'No address on this location'}
          </p>
        ) : null}
        <Button type="button" variant="outline" className="min-h-11" disabled={!connected} onClick={() => void load()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh locations
        </Button>
      </section>

      {/* Step D — Fulfilment defaults */}
      <section className="space-y-3 rounded-xl border border-slate-200 p-3">
        <h4 className="font-bold text-s2d-teal-deep">3. Fulfilment defaults</h4>
        <p className="text-sm text-slate-600">
          Used when injecting to Square. Live phone-order address/postcode override these when collected.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Pickup / business name</Label>
            <Input
              className="mt-1 min-h-12"
              value={config.defaultPickupName || ''}
              onChange={(e) => setConfig((c) => ({ ...c, defaultPickupName: e.target.value }))}
            />
          </div>
          <div>
            <Label>Default phone</Label>
            <Input
              className="mt-1 min-h-12"
              value={config.defaultPickupPhone || ''}
              onChange={(e) => setConfig((c) => ({ ...c, defaultPickupPhone: e.target.value }))}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Default delivery address line</Label>
            <Input
              className="mt-1 min-h-12"
              value={config.fulfillmentAddressLine1 || ''}
              onChange={(e) => setConfig((c) => ({ ...c, fulfillmentAddressLine1: e.target.value }))}
            />
          </div>
          <div>
            <Label>City</Label>
            <Input
              className="mt-1 min-h-12"
              value={config.fulfillmentAddressCity || ''}
              onChange={(e) => setConfig((c) => ({ ...c, fulfillmentAddressCity: e.target.value }))}
            />
          </div>
          <div>
            <Label>Postcode</Label>
            <Input
              className="mt-1 min-h-12"
              value={config.fulfillmentAddressPostcode || ''}
              onChange={(e) => setConfig((c) => ({ ...c, fulfillmentAddressPostcode: e.target.value }))}
            />
          </div>
          <div>
            <Label>Country</Label>
            <Input
              className="mt-1 min-h-12"
              value={config.fulfillmentAddressCountry || 'GB'}
              onChange={(e) => setConfig((c) => ({ ...c, fulfillmentAddressCountry: e.target.value }))}
            />
          </div>
        </div>
        <label className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3">
          <span className="font-bold text-s2d-teal-deep">Auto-push phone orders to Square</span>
          <Switch checked={autoPush} onCheckedChange={setAutoPush} />
        </label>
        <Button
          type="button"
          className="min-h-12 bg-s2d-teal-deep font-bold text-white"
          disabled={saving}
          onClick={() => void saveConfig({
            provider: 'square',
            direction: 'outbound',
            enabled: autoPush,
            posPush: autoPush ? 'on_place' : 'manual_only',
            defaultPickupName: config.defaultPickupName,
            defaultPickupPhone: config.defaultPickupPhone,
            fulfillmentAddressLine1: config.fulfillmentAddressLine1,
            fulfillmentAddressCity: config.fulfillmentAddressCity,
            fulfillmentAddressPostcode: config.fulfillmentAddressPostcode,
            fulfillmentAddressCountry: config.fulfillmentAddressCountry || 'GB',
            squareLocationId: config.squareLocationId,
          })}
        >
          {saving ? 'Saving…' : 'Save fulfilment settings'}
        </Button>
      </section>

      {/* Step E — Menu map */}
      <section className="space-y-3 rounded-xl border border-slate-200 p-3">
        <h4 className="font-bold text-s2d-teal-deep">4. Link menu items</h4>
        <p className="text-sm text-slate-600">
          Completeness:{' '}
          {completePct != null && completeness
            ? `${completeness.declared}/${completeness.total} (${completePct}%)`
            : '—'}
        </p>
        {completePct != null && completePct < 100 ? (
          <p className="text-sm font-semibold text-amber-800">
            Map all phone-menu items before relying on auto-push — unmapped lines fail sync.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={!connected} onClick={() => void syncCatalog()}>
            Sync Square catalog
          </Button>
          <Button type="button" variant="outline" className="min-h-11" disabled={!connected} onClick={() => void applySuggested()}>
            Apply suggested matches
          </Button>
          <Button type="button" className="min-h-11 bg-s2d-teal-deep text-white" disabled={!connected} onClick={() => void saveMappings()}>
            Save mapping
          </Button>
        </div>
        <div className="max-h-72 space-y-2 overflow-y-auto">
          {mappings.length === 0 ? (
            <p className="text-sm text-slate-500">No menu items — add dishes under Menu, then sync.</p>
          ) : (
            mappings.map((row) => (
              <div key={row.id} className="grid gap-2 rounded-lg bg-slate-50 p-2 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <p className="font-semibold text-s2d-teal-deep">{row.name}</p>
                  <p className="text-xs text-slate-500">{row.category}</p>
                </div>
                <select
                  className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 text-sm"
                  value={row.squareVariationId || ''}
                  onChange={(e) => {
                    const v = e.target.value;
                    setMappings((list) => list.map((m) => (m.id === row.id ? { ...m, squareVariationId: v } : m)));
                  }}
                >
                  <option value="">Not mapped</option>
                  {variations.map((v) => (
                    <option key={v.variationId} value={v.variationId}>{v.label}</option>
                  ))}
                </select>
                <span className={`self-center text-xs font-bold ${row.squareVariationId ? 'text-emerald-700' : 'text-amber-700'}`}>
                  {row.squareVariationId ? 'Mapped' : 'Missing'}
                </span>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Step F — Test */}
      <section className="space-y-3 rounded-xl border border-slate-200 p-3">
        <h4 className="font-bold text-s2d-teal-deep">5. Test & go live</h4>
        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <p><span className="font-bold">Last outbound:</span> {config.lastOutboundAt ? new Date(config.lastOutboundAt).toLocaleString() : '—'}</p>
          <p><span className="font-bold">Last test:</span>{' '}
            {config.lastTestPushAt
              ? `${new Date(config.lastTestPushAt).toLocaleString()} (${config.lastTestPushOk ? 'ok' : 'failed'})`
              : '—'}
          </p>
          {config.lastError ? (
            <p className="sm:col-span-2 font-semibold text-red-700">Last error: {config.lastError}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-12 bg-s2d-teal-deep font-bold text-white" disabled={!connected} onClick={() => void testPush()}>
            Send test order
          </Button>
          <Button type="button" variant="outline" className="min-h-12" onClick={() => void retryQueue()}>
            Retry outbound queue
          </Button>
          <Button type="button" variant="outline" className="min-h-12" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        {ready ? (
          <p className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
            <CheckCircle2 className="h-4 w-4" />
            Square handoff is ready for phone orders when auto-push is on.
          </p>
        ) : null}
      </section>
    </div>
  );
}
