import { useCallback, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { BadgePoundSterling, Save } from 'lucide-react';
import {
  fetchSallyOffer,
  saveSallyOffer,
  type SallyOfferTerms,
} from '../../engine/platform/platformApi';
import { SAAS_PRODUCTS, defaultSaasProductPrices } from '../../engine/saas/saasProducts';
import { ORG_PLAN_IDS, PLAN_TIERS } from '../../engine/saas/planTiers';
import { Link } from 'react-router';

function toDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string {
  if (!value.trim()) return '';
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : '';
}

const emptyForm: SallyOfferTerms = {
  monthlyPriceGbp: 199,
  setupFeeGbp: 0,
  billing: 'weekly subscription',
  minimumTerm: 'Weekly rolling; annual is 12-month prepay',
  cancelPolicy:
    'Weekly: cancel before the next billing week. Annual: 12-month prepay; 30-day renewal notice.',
  demoPhone: '',
  demoVideoUrl: '',
  salesPdfUrl: '',
  offerEndsAt: null,
  patentRefs: '',
  founderName: '',
  authorityBlurb: '',
  products: defaultSaasProductPrices(),
};

export default function SallyOfferSettings() {
  const [form, setForm] = useState<SallyOfferTerms>(emptyForm);
  const [packages, setPackages] = useState<SallyOfferTerms['packages']>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSallyOffer();
      setForm({
        ...emptyForm,
        ...data.offer,
        products: {
          ...defaultSaasProductPrices(),
          ...(data.offer.products || {}),
        },
        offerEndsAt: data.offer.offerEndsAt ?? data.stored?.offerEndsAt ?? null,
        patentRefs: data.offer.patentRefs ?? data.stored?.patentRefs ?? '',
        founderName: data.offer.founderName ?? data.stored?.founderName ?? '',
        authorityBlurb: data.offer.authorityBlurb ?? data.stored?.authorityBlurb ?? '',
      });
      setPackages(data.offer.packages || []);
      setUpdatedAt(data.stored?.updatedAt || null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load Sally offer');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const save = async () => {
    setSaving(true);
    try {
      const data = await saveSallyOffer({
        monthlyPriceGbp: Number(form.products.phone_agent.monthlyPriceGbp),
        setupFeeGbp: Number(form.products.phone_agent.setupFeeGbp),
        products: form.products,
        minimumTerm: form.minimumTerm,
        cancelPolicy: form.cancelPolicy,
        demoPhone: form.demoPhone,
        demoVideoUrl: form.demoVideoUrl,
        salesPdfUrl: form.salesPdfUrl,
        offerEndsAt: form.offerEndsAt || '',
        patentRefs: form.patentRefs,
        founderName: form.founderName,
        authorityBlurb: form.authorityBlurb,
      });
      setForm({
        ...emptyForm,
        ...data.offer,
        products: {
          ...defaultSaasProductPrices(),
          ...(data.offer.products || {}),
        },
        offerEndsAt: data.offer.offerEndsAt ?? data.stored?.offerEndsAt ?? null,
        patentRefs: data.offer.patentRefs ?? data.stored?.patentRefs ?? '',
        founderName: data.offer.founderName ?? data.stored?.founderName ?? '',
        authorityBlurb: data.offer.authorityBlurb ?? data.stored?.authorityBlurb ?? '',
      });
      setPackages(data.offer.packages || []);
      setUpdatedAt(data.stored?.updatedAt || null);
      toast.success('Sally offer saved — live on the next call/chat');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const setProductPrice = (
    id: 'phone_agent' | 'audio_management',
    field: 'monthlyPriceGbp' | 'setupFeeGbp',
    value: number,
  ) => {
    setForm((f) => ({
      ...f,
      products: {
        ...f.products,
        [id]: { ...f.products[id], [field]: value },
      },
      ...(id === 'phone_agent' && field === 'monthlyPriceGbp' ? { monthlyPriceGbp: value } : {}),
      ...(id === 'phone_agent' && field === 'setupFeeGbp' ? { setupFeeGbp: value } : {}),
    }));
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-s2d-teal">Platform</p>
        <h1 className="mt-1 flex items-center gap-2 text-2xl font-black tracking-tight text-s2d-teal-deep sm:text-3xl">
          <BadgePoundSterling className="h-7 w-7" />
          Sally offer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Judie / Atmosphere packages are catalog-fixed. Configure launch end date, authority copy, and optional
          legacy product overrides. Public page:{' '}
          <Link className="text-s2d-teal underline" to="/pricing">
            /pricing
          </Link>
        </p>
        {updatedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            Last saved {new Date(updatedAt).toLocaleString()}
          </p>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Judie plan tiers (catalog-fixed)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {ORG_PLAN_IDS.map((id) => {
            const t = PLAN_TIERS[id];
            return (
              <div
                key={id}
                className={`rounded-xl border p-3 text-sm ${t.badge ? 'border-s2d-teal bg-s2d-teal/5' : 'border-border'}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold">
                    {t.label}
                    {t.badge ? ` · ${t.badge}` : ''}
                  </p>
                  <p className="font-bold text-s2d-teal-deep">
                    <span className="text-muted-foreground line-through">£{t.standardWeeklyGbp}</span>
                    {' → '}
                    £{t.weeklyPriceGbp}/wk
                  </p>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.includedAiMinutes} Judie AI min/week · {t.includedOutboundMinutes} outbound min/week · AI
                  overage £{t.aiOverageGbpPerMinute.toFixed(2)}/min · annual prepay £{t.annualPrepayGbp}
                </p>
              </div>
            );
          })}
          <p className="text-xs text-muted-foreground">
            Package fares live in the SaaS catalog ({form.fareScheduleVersion || 's2d-fare-2026-07-19'}). Launch
            pricing ends when offerEndsAt passes.
          </p>
        </CardContent>
      </Card>

      {packages && packages.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">All packages snapshot</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {packages.map((p) => (
              <div key={p.packageId} className="rounded-lg border border-border p-2 text-xs">
                <span className="font-semibold">{p.name}</span>
                {' — '}
                <span className="line-through text-muted-foreground">£{p.standardWeeklyGbp}/wk</span>
                {' → '}
                £{p.weeklyGbp}/wk
                {p.weeklyAiMinutes > 0
                  ? ` · ${p.weeklyAiMinutes} AI min/wk · ${p.weeklyOutboundMinutes} outbound`
                  : ''}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Launch offer &amp; authority</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="offerEndsAt">Launch offer ends (local time)</Label>
            <Input
              id="offerEndsAt"
              type="datetime-local"
              disabled={loading}
              value={toDatetimeLocal(form.offerEndsAt)}
              onChange={(e) =>
                setForm((f) => ({ ...f, offerEndsAt: fromDatetimeLocal(e.target.value) || null }))
              }
            />
            <p className="text-xs text-muted-foreground">
              After this datetime, Sally quotes standard weekly rates instead of launch pricing.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="founderName">Founder name</Label>
            <Input
              id="founderName"
              disabled={loading}
              placeholder="Shervin Dolab"
              value={form.founderName || ''}
              onChange={(e) => setForm((f) => ({ ...f, founderName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="patentRefs">Patent references</Label>
            <Input
              id="patentRefs"
              disabled={loading}
              placeholder="GB …, US …"
              value={form.patentRefs || ''}
              onChange={(e) => setForm((f) => ({ ...f, patentRefs: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="authorityBlurb">Authority blurb (Sally intro)</Label>
            <Textarea
              id="authorityBlurb"
              rows={4}
              disabled={loading}
              placeholder="Sync2Dine is the restaurant side of Sync2Gear…"
              value={form.authorityBlurb || ''}
              onChange={(e) => setForm((f) => ({ ...f, authorityBlurb: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Legacy product pricing (optional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-xs text-muted-foreground">
            Optional overrides for legacy Judie / Atmosphere SKU fields. Canonical pricing comes from the package
            catalog above.
          </p>
          {(['phone_agent', 'audio_management'] as const).map((id) => {
            const def = SAAS_PRODUCTS[id];
            const price = form.products[id];
            return (
              <div key={id} className="rounded-xl border border-border p-4">
                <p className="font-semibold text-foreground">{def.name}</p>
                <p className="mb-3 text-xs text-muted-foreground">{def.description}</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-monthly`}>Monthly equivalent (£)</Label>
                    <Input
                      id={`${id}-monthly`}
                      type="number"
                      min={1}
                      step={1}
                      disabled={loading}
                      value={price.monthlyPriceGbp}
                      onChange={(e) => setProductPrice(id, 'monthlyPriceGbp', Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${id}-setup`}>Setup fee (£)</Label>
                    <Input
                      id={`${id}-setup`}
                      type="number"
                      min={0}
                      step={1}
                      disabled={loading}
                      value={price.setupFeeGbp}
                      onChange={(e) => setProductPrice(id, 'setupFeeGbp', Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Terms</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="term">Minimum term</Label>
            <Input
              id="term"
              disabled={loading}
              value={form.minimumTerm}
              onChange={(e) => setForm((f) => ({ ...f, minimumTerm: e.target.value }))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="cancel">Cancel policy</Label>
            <Textarea
              id="cancel"
              rows={3}
              disabled={loading}
              value={form.cancelPolicy}
              onChange={(e) => setForm((f) => ({ ...f, cancelPolicy: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Demo assets</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="demoPhone">Demo phone</Label>
            <Input
              id="demoPhone"
              disabled={loading}
              placeholder="+44…"
              value={form.demoPhone}
              onChange={(e) => setForm((f) => ({ ...f, demoPhone: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="demoVideo">Demo video URL</Label>
            <Input
              id="demoVideo"
              disabled={loading}
              placeholder="https://…"
              value={form.demoVideoUrl}
              onChange={(e) => setForm((f) => ({ ...f, demoVideoUrl: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="salesPdf">Sales PDF URL</Label>
            <Input
              id="salesPdf"
              disabled={loading}
              placeholder="https://…"
              value={form.salesPdfUrl}
              onChange={(e) => setForm((f) => ({ ...f, salesPdfUrl: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          onClick={() => void save()}
          disabled={loading || saving}
          className="min-h-11 rounded-xl bg-s2d-teal font-bold text-white hover:bg-s2d-teal-deep"
        >
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving…' : 'Save offer'}
        </Button>
        <Button type="button" variant="outline" disabled={loading || saving} onClick={() => void reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
