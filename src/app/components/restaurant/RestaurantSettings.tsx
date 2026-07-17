import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { Copy, MapPinned, Megaphone, MonitorSmartphone, PhoneCall, Store, UserPlus, Users, X } from 'lucide-react';
import { Button } from '../ui/button';
import { Switch } from '../ui/switch';
import { Textarea } from '../ui/textarea';
import { Input } from '../ui/input';
import { buildPublicKioskUrl, getActiveOrgId } from '../../engine/platform/orgContext';
import { isOrgUuid } from '../../engine/platform/homeOrg';

/**
 * Restaurant settings (Super Master B2): phone agent on/off, About us,
 * Say today, and delivery postcode prefixes for Lizzie.
 */

function normalizePrefix(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export default function RestaurantSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [aboutUs, setAboutUs] = useState('');
  const [sayToday, setSayToday] = useState('');
  const [deliveryPrefixes, setDeliveryPrefixes] = useState<string[]>([]);
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [prefixDraft, setPrefixDraft] = useState('');
  const orgId = getActiveOrgId();
  const kioskUrl = isOrgUuid(orgId) ? buildPublicKioskUrl(orgId) : '';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/agent/settings');
        const data = await res.json() as {
          isActive?: boolean;
          aboutUs?: string;
          sayToday?: string;
          deliveryPostcodePrefixes?: string[];
          deliveryNotes?: string;
        };
        if (cancelled) return;
        setIsActive(data.isActive !== false);
        setAboutUs(data.aboutUs ?? '');
        setSayToday(data.sayToday ?? '');
        setDeliveryPrefixes(
          Array.isArray(data.deliveryPostcodePrefixes)
            ? data.deliveryPostcodePrefixes.map((p) => normalizePrefix(String(p))).filter(Boolean)
            : [],
        );
        setDeliveryNotes(data.deliveryNotes ?? '');
      } catch {
        toast.error('Could not load settings — API offline?');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  function addPrefix(raw: string) {
    const next = normalizePrefix(raw);
    if (!next) return;
    setDeliveryPrefixes((prev) => (prev.includes(next) ? prev : [...prev, next].sort((a, b) => b.length - a.length || a.localeCompare(b))));
    setPrefixDraft('');
  }

  function onPrefixKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
      e.preventDefault();
      addPrefix(prefixDraft);
    } else if (e.key === 'Backspace' && !prefixDraft && deliveryPrefixes.length) {
      setDeliveryPrefixes((prev) => prev.slice(0, -1));
    }
  }

  async function toggleActive(checked: boolean) {
    setIsActive(checked);
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: checked }),
      });
      const data = await res.json();
      setIsActive(data.isActive !== false);
      toast.success(checked ? 'Phone agent answering' : 'Phone agent paused');
    } catch {
      toast.error('Could not update the phone agent');
    }
  }

  async function save() {
    setSaving(true);
    try {
      if (prefixDraft.trim()) addPrefix(prefixDraft);
      const prefixes = prefixDraft.trim()
        ? [...new Set([...deliveryPrefixes, normalizePrefix(prefixDraft)])].filter(Boolean)
        : deliveryPrefixes;
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          aboutUs,
          sayToday,
          deliveryPostcodePrefixes: prefixes,
          deliveryNotes,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json() as { deliveryPostcodePrefixes?: string[] };
      if (Array.isArray(data.deliveryPostcodePrefixes)) {
        setDeliveryPrefixes(data.deliveryPostcodePrefixes.map((p) => normalizePrefix(String(p))).filter(Boolean));
      }
      setPrefixDraft('');
      toast.success('Saved — the phone agent will use this on the next call');
      // #region agent log
      fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'342d7b'},body:JSON.stringify({sessionId:'342d7b',runId:'pre-fix',hypothesisId:'E',location:'RestaurantSettings.tsx:save',message:'settings saved',data:{ok:true,prefixCount:prefixes.length,prefixes:prefixes.slice(0,8),notesLen:deliveryNotes.length},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } catch {
      toast.error('Save failed');
      // #region agent log
      fetch('http://127.0.0.1:7261/ingest/6cf14313-b666-4982-884a-814f1f19f4c6',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'342d7b'},body:JSON.stringify({sessionId:'342d7b',runId:'pre-fix',hypothesisId:'E',location:'RestaurantSettings.tsx:save',message:'settings save failed',data:{ok:false},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-s2d-cream p-3 sm:p-5">
      <section className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-[1.75rem] bg-s2d-teal-deep p-4 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-s2d-gold">Settings</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">Your restaurant & phone agent</h1>
        </div>

        <div className="rounded-[1.5rem] border border-s2d-teal/15 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <MonitorSmartphone className="mt-1 h-6 w-6 text-s2d-teal" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-s2d-teal-deep">Counter kiosk</h2>
              <p className="mb-2 text-sm text-slate-600">
                Open this link on the front tablet — diners order with no login. Staff still use /login.
              </p>
              {kioskUrl ? (
                <>
                  <p className="break-all rounded-xl bg-s2d-cream/60 px-3 py-2 font-mono text-sm text-s2d-teal-deep">
                    {kioskUrl}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    className="mt-3 min-h-11"
                    onClick={() => {
                      void navigator.clipboard.writeText(kioskUrl);
                      toast.success('Kiosk URL copied');
                    }}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy kiosk URL
                  </Button>
                </>
              ) : (
                <p className="text-sm text-amber-700">Restaurant org not loaded yet — refresh and try again.</p>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-s2d-teal/15 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <PhoneCall className="mt-1 h-6 w-6 text-s2d-teal" />
              <div>
                <h2 className="text-xl font-bold text-s2d-teal-deep">Phone agent</h2>
                <p className="text-sm text-slate-600">When on, Lizzie answers your calls and takes orders.</p>
              </div>
            </div>
            <Switch checked={isActive} onCheckedChange={(c) => void toggleActive(c)} disabled={loading} />
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-s2d-teal/15 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Store className="mt-1 h-6 w-6 text-s2d-teal" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-s2d-teal-deep">About us</h2>
              <p className="mb-2 text-sm text-slate-600">
                Opening hours, address, parking, allergens — shared with callers when they ask.
              </p>
              <Textarea
                value={aboutUs}
                onChange={(e) => setAboutUs(e.target.value)}
                rows={5}
                disabled={loading}
                placeholder="Open Tue–Sun 5pm–11pm. Collection and delivery within 3 miles. Card and cash at the desk."
                className="min-h-28 rounded-xl text-base"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-s2d-teal/15 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Megaphone className="mt-1 h-6 w-6 text-s2d-teal" />
            <div className="flex-1">
              <h2 className="text-xl font-bold text-s2d-teal-deep">Say today</h2>
              <p className="mb-2 text-sm text-slate-600">
                A daily line the agent mentions on calls — today's special, closing early, etc.
              </p>
              <Textarea
                value={sayToday}
                onChange={(e) => setSayToday(e.target.value)}
                rows={2}
                disabled={loading}
                placeholder="Today's special: lamb karahi with free naan on orders over £25."
                className="rounded-xl text-base"
              />
            </div>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-s2d-teal/15 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <MapPinned className="mt-1 h-6 w-6 text-s2d-teal" />
            <div className="flex-1 space-y-3">
              <div>
                <h2 className="text-xl font-bold text-s2d-teal-deep">Delivery areas</h2>
                <p className="mb-2 text-sm text-slate-600">
                  Postcode beginnings Lizzie accepts for delivery (e.g. B1, B11, CV1). Longer matches win — B11 before B1.
                </p>
                <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-xl border border-s2d-teal/20 bg-s2d-cream/40 px-3 py-2">
                  {deliveryPrefixes.map((prefix) => (
                    <span
                      key={prefix}
                      className="inline-flex items-center gap-1 rounded-full bg-s2d-teal-deep px-3 py-1 text-sm font-bold text-white"
                    >
                      {prefix}
                      <button
                        type="button"
                        className="rounded-full p-0.5 hover:bg-white/20"
                        aria-label={`Remove ${prefix}`}
                        disabled={loading}
                        onClick={() => setDeliveryPrefixes((prev) => prev.filter((p) => p !== prefix))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                  <Input
                    value={prefixDraft}
                    onChange={(e) => setPrefixDraft(e.target.value.toUpperCase())}
                    onKeyDown={onPrefixKeyDown}
                    onBlur={() => { if (prefixDraft.trim()) addPrefix(prefixDraft); }}
                    disabled={loading}
                    placeholder="Type prefix, Enter"
                    className="h-10 min-w-[8rem] flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
              <div>
                <p className="mb-1 text-sm font-semibold text-s2d-teal-deep">Delivery notes</p>
                <Textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  rows={2}
                  disabled={loading}
                  placeholder="£2.50 delivery · £15 minimum · Free delivery over £30"
                  className="rounded-xl text-base"
                />
              </div>
            </div>
          </div>
        </div>

        <Button
          type="button"
          onClick={() => void save()}
          disabled={saving || loading}
          className="min-h-[52px] w-full rounded-xl bg-s2d-teal-deep text-base font-bold text-white hover:bg-s2d-teal sm:w-auto sm:px-10"
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>

        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            to="/team"
            className="flex min-h-[52px] items-center gap-3 rounded-[1.25rem] border border-s2d-teal/15 bg-white px-4 py-3 font-bold text-s2d-teal-deep shadow-sm transition hover:border-s2d-teal/40"
          >
            <UserPlus className="h-5 w-5 text-s2d-teal" />
            Team & invites
          </Link>
          <Link
            to="/customers"
            className="flex min-h-[52px] items-center gap-3 rounded-[1.25rem] border border-s2d-teal/15 bg-white px-4 py-3 font-bold text-s2d-teal-deep shadow-sm transition hover:border-s2d-teal/40"
          >
            <Users className="h-5 w-5 text-s2d-teal" />
            Customers
          </Link>
        </div>
      </section>
    </div>
  );
}
