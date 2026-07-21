import { useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { AppContext } from '../App';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import { ArrowLeft, FileText, Save } from 'lucide-react';
import {
  SAAS_PRODUCTS,
  SAAS_PRODUCT_IDS,
  resolvePackageLine,
  sumQuoteTotal,
  type SaasProductId,
  type BillingInterval,
} from '../engine/saas/saasProducts';
import {
  ADDITIONAL_SITE_WEEKLY_GBP,
  formatFareSummary,
  getPackage,
  isSaasPackageId,
  primaryPackages,
  scalePackages,
  priceForInterval,
  type SaasPackageId,
} from '../engine/saas/saasPackages';
import { fetchSallyOffer } from '../engine/platform/platformApi';
import { createQuoteLine } from '../engine/quotes/quoteLineUtils';

export default function SaasQuoteBuilder() {
  const context = useContext(AppContext);
  const navigate = useNavigate();
  const { customerId: routeCustomerId } = useParams<{ customerId?: string }>();
  const [searchParams] = useSearchParams();

  const paramPackage = searchParams.get('package');
  const initialPackageId: SaasPackageId =
    paramPackage && isSaasPackageId(paramPackage) ? paramPackage : 'judie_starter';

  const [customerId, setCustomerId] = useState(routeCustomerId || searchParams.get('customerId') || '');
  const [packageId, setPackageId] = useState<SaasPackageId>(initialPackageId);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('weekly');
  const [additionalSites, setAdditionalSites] = useState(0);
  const [showLegacyProducts, setShowLegacyProducts] = useState(false);
  const [selected, setSelected] = useState<Set<SaasProductId>>(new Set());
  const [launchActive, setLaunchActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [deploymentNotes, setDeploymentNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const pkg = useMemo(() => getPackage(packageId), [packageId]);

  useEffect(() => {
    void fetchSallyOffer()
      .then((data) => {
        setLaunchActive(data.offer.launchActive !== false);
      })
      .catch(() => {
        /* use defaults */
      });
  }, []);

  useEffect(() => {
    if (routeCustomerId) setCustomerId(routeCustomerId);
  }, [routeCustomerId]);

  const lines = useMemo(
    () =>
      resolvePackageLine(packageId, {
        interval: billingInterval,
        useLaunch: launchActive,
        additionalSites,
      }),
    [packageId, billingInterval, launchActive, additionalSites],
  );
  const total = sumQuoteTotal(lines);
  const weeklyRate = priceForInterval(pkg, 'weekly', launchActive);
  const standardWeekly = pkg.standardWeeklyGbp;
  const annualRate = priceForInterval(pkg, 'annual', launchActive);
  const fareSummary = formatFareSummary(pkg);
  const unitSuffix = billingInterval === 'annual' ? '/yr' : '/wk';

  if (!context) return null;
  const { customers, addQuote } = context;

  const toggleProduct = (id: SaasProductId, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!customerId) {
      toast.error('Select a customer / prospect');
      return;
    }
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) {
      toast.error('Customer not found');
      return;
    }

    setSaving(true);
    try {
      const quoteLines = lines.map((l) =>
        createQuoteLine({
          id: l.id,
          description: l.description,
          quantity: l.quantity,
          unit: l.unit,
          rate: l.rate,
          total: l.total,
          category: l.category,
        }),
      );
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const legacyProducts = SAAS_PRODUCT_IDS.filter((id) => selected.has(id));

      const created = addQuote({
        customerId: customer.id,
        customerName: customer.name,
        tradeName: 'Sync2Dine SaaS',
        expiresAt: expiresAt.toISOString(),
        items: lines
          .filter((l) => l.category === 'product')
          .map((l) => ({
            productId: l.productId,
            name: l.description,
            quantity: l.quantity,
            price: l.rate,
            total: l.total,
          })),
        labour: [],
        extras: lines
          .filter((l) => l.category === 'extra' || l.category === 'site')
          .map((l) => ({ description: l.description, price: l.total })),
        lines: quoteLines,
        discount: 0,
        total,
        status: 'draft',
        wizardAnswers: {
          saas: true,
          packageId,
          billingInterval,
          fareSummary,
          weeklyTotal: billingInterval === 'weekly' ? total : weeklyRate,
          annualTotal: billingInterval === 'annual' ? total : annualRate,
          additionalSites,
          launchActive,
          ...(legacyProducts.length ? { products: legacyProducts } : {}),
          deploymentNotes: deploymentNotes.trim() || undefined,
          notes: notes.trim() || undefined,
        },
      });

      toast.success(`Quote ${created.id} saved — £${total}${unitSuffix}`);
      navigate('/quotes');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save quote');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button type="button" variant="ghost" size="sm" className="-ml-2 mb-1" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <FileText className="h-7 w-7 text-s2d-teal" />
            Sync2Dine quote
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            Judie and Atmosphere packages — weekly or annual prepay.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">1. Customer</CardTitle>
        </CardHeader>
        <CardContent>
          <Label htmlFor="customer">Prospect / restaurant</Label>
          <Select value={customerId || undefined} onValueChange={setCustomerId}>
            <SelectTrigger id="customer" className="mt-2">
              <SelectValue placeholder="Select customer…" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">2. Package</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="package">Package</Label>
            <Select value={packageId} onValueChange={(v) => setPackageId(v as SaasPackageId)}>
              <SelectTrigger id="package" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Primary packages</SelectLabel>
                  {primaryPackages().map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                      {p.badge ? ` · ${p.badge}` : ''}
                    </SelectItem>
                  ))}
                </SelectGroup>
                <SelectGroup>
                  <SelectLabel>Scale packages</SelectLabel>
                  {scalePackages().map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{pkg.description}</p>
          </div>

          <div className="space-y-2">
            <Label>Billing interval</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={billingInterval === 'weekly' ? 'default' : 'outline'}
                className={billingInterval === 'weekly' ? 'bg-s2d-teal hover:bg-s2d-teal-deep' : ''}
                onClick={() => setBillingInterval('weekly')}
              >
                Weekly
              </Button>
              <Button
                type="button"
                variant={billingInterval === 'annual' ? 'default' : 'outline'}
                className={billingInterval === 'annual' ? 'bg-s2d-teal hover:bg-s2d-teal-deep' : ''}
                onClick={() => setBillingInterval('annual')}
              >
                Annual prepay
              </Button>
            </div>
          </div>

          {billingInterval === 'weekly' && launchActive && (
            <div className="rounded-xl border border-s2d-teal/30 bg-s2d-teal/5 p-4 text-sm">
              <p className="font-semibold text-s2d-teal-deep">
                <span className="text-muted-foreground line-through">£{standardWeekly}/week</span>
                {' → '}
                £{weeklyRate}/week launch
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Annual prepay alternative: £{annualRate}/year (50% off annualized launch)
              </p>
            </div>
          )}

          {billingInterval === 'weekly' && !launchActive && (
            <p className="text-sm font-semibold text-s2d-teal-deep">£{weeklyRate}/week</p>
          )}

          {billingInterval === 'annual' && (
            <p className="text-sm font-semibold text-s2d-teal-deep">£{annualRate}/year prepay</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="sites">Additional sites (£{ADDITIONAL_SITE_WEEKLY_GBP}/week each)</Label>
            <Input
              id="sites"
              type="number"
              min={0}
              value={additionalSites}
              onChange={(e) => setAdditionalSites(Math.max(0, Number(e.target.value) || 0))}
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            {fareSummary}
          </div>

          <div className="border-t pt-4">
            <button
              type="button"
              className="text-xs font-semibold text-s2d-teal underline"
              onClick={() => setShowLegacyProducts((v) => !v)}
            >
              {showLegacyProducts ? 'Hide' : 'Show'} legacy product toggles (optional)
            </button>
            {showLegacyProducts && (
              <div className="mt-3 space-y-2">
                {SAAS_PRODUCT_IDS.map((id) => {
                  const def = SAAS_PRODUCTS[id];
                  const on = selected.has(id);
                  return (
                    <div key={id} className="flex items-center gap-2">
                      <Checkbox
                        id={`legacy-${id}`}
                        checked={on}
                        onCheckedChange={(v) => toggleProduct(id, v === true)}
                      />
                      <Label htmlFor={`legacy-${id}`} className="cursor-pointer text-sm font-normal">
                        {def.name} — {def.description}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">3. Deployment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="deploy">Deployment notes</Label>
            <Textarea
              id="deploy"
              rows={2}
              placeholder="Go-live date, venues, contacts…"
              value={deploymentNotes}
              onChange={(e) => setDeploymentNotes(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Quote notes</Label>
            <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">4. Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {lines.map((l) => (
            <div key={l.id} className="flex justify-between text-sm">
              <span>
                {l.description}
                {l.quantity > 1 ? ` × ${l.quantity}` : ''}
              </span>
              <span className="font-medium">
                £{l.total}
                {l.unit === 'week' ? '/wk' : l.unit === 'year' ? '/yr' : ''}
              </span>
            </div>
          ))}
          <div className="mt-3 flex justify-between border-t pt-3 font-bold">
            <span>{billingInterval === 'annual' ? 'Annual total' : 'Weekly total'}</span>
            <span>
              £{total}
              {unitSuffix}
            </span>
          </div>
          <Button
            type="button"
            className="mt-4 min-h-11 w-full rounded-xl bg-s2d-teal font-bold text-white hover:bg-s2d-teal-deep"
            disabled={saving}
            onClick={handleSave}
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving…' : 'Save draft quote'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
