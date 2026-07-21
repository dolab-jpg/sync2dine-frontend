import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ArrowLeft, ArrowRight, Check, CreditCard } from 'lucide-react';
import PublicMarketingLayout from './PublicMarketingLayout';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { toast } from 'sonner';
import {
  ADDITIONAL_SITE_ANNUAL_GBP,
  ADDITIONAL_SITE_WEEKLY_GBP,
  FARE_SCHEDULE_VERSION,
  SAAS_PACKAGE_IDS,
  SAAS_PACKAGES,
  formatFareSummary,
  getPackage,
  isSaasPackageId,
  priceForInterval,
  type BillingInterval,
  type OverageAction,
  type SaasPackageId,
} from '../engine/saas/saasPackages';
import {
  OVERAGE_ACTION_LABELS,
  clearCheckoutDraft,
  defaultCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
  submitCheckoutDraft,
  validateEmail,
  validatePhone,
  type CheckoutDraft,
} from '../engine/saas/checkoutDraft';

const STEPS = [
  'Package & sites',
  'Venue details',
  'Review fare',
  'Consents',
  'Sign',
  'Pay',
] as const;

function siteAddonGbp(interval: BillingInterval, sites: number): number {
  if (sites <= 0) return 0;
  return sites * (interval === 'annual' ? ADDITIONAL_SITE_ANNUAL_GBP : ADDITIONAL_SITE_WEEKLY_GBP);
}

function totalDueGbp(draft: CheckoutDraft): number {
  const pkg = getPackage(draft.packageId);
  return priceForInterval(pkg, draft.interval) + siteAddonGbp(draft.interval, draft.additionalSites);
}

export default function StartCheckoutFlow() {
  const [searchParams] = useSearchParams();
  const paramPackage = searchParams.get('package');
  const paramInterval = searchParams.get('interval');
  const paramVenue = searchParams.get('venue');
  const paramEmail = searchParams.get('email');
  const paramPhone = searchParams.get('phone');
  const paramAddress = searchParams.get('address');
  const paramContact = searchParams.get('contact') || searchParams.get('name');

  const [draft, setDraft] = useState<CheckoutDraft>(() => {
    const saved = loadCheckoutDraft();
    const pkgId =
      paramPackage && isSaasPackageId(paramPackage)
        ? paramPackage
        : saved?.packageId ?? 'judie_starter';
    const interval: BillingInterval =
      paramInterval === 'annual' || paramInterval === 'weekly'
        ? paramInterval
        : saved?.interval ?? 'weekly';
    const base = saved ? { ...saved, packageId: pkgId, interval } : defaultCheckoutDraft(pkgId, interval);
    return {
      ...base,
      venueName: paramVenue?.trim() || base.venueName,
      contactName: paramContact?.trim() || base.contactName,
      email: paramEmail?.trim() || base.email,
      phone: paramPhone?.trim() || base.phone,
      address: paramAddress?.trim() || base.address,
      step:
        paramVenue || paramEmail || paramPhone || paramAddress || paramContact
          ? Math.max(base.step, 1)
          : base.step,
    };
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [paying, setPaying] = useState(false);

  const persist = useCallback((next: CheckoutDraft) => {
    setDraft(next);
    saveCheckoutDraft(next);
  }, []);

  useEffect(() => {
    saveCheckoutDraft(draft);
  }, [draft]);

  const pkg = useMemo(() => getPackage(draft.packageId), [draft.packageId]);
  const total = useMemo(() => totalDueGbp(draft), [draft]);

  const setField = <K extends keyof CheckoutDraft>(key: K, value: CheckoutDraft[K]) => {
    persist({ ...draft, [key]: value });
  };

  const validateStep = (step: number): boolean => {
    const nextErrors: Record<string, string> = {};
    if (step === 0) {
      if (!draft.packageId) nextErrors.packageId = 'Select a package';
    }
    if (step === 1) {
      if (!draft.venueName.trim()) nextErrors.venueName = 'Venue name is required';
      if (!draft.contactName.trim()) nextErrors.contactName = 'Contact name is required';
      if (!validateEmail(draft.email)) nextErrors.email = 'Enter a valid email address';
      if (!validatePhone(draft.phone)) nextErrors.phone = 'Enter a valid UK phone number';
      if (!draft.address.trim()) nextErrors.address = 'Venue address is required';
    }
    if (step === 3) {
      if (!draft.termsAccepted) nextErrors.termsAccepted = 'Required';
      if (!draft.fairUseAccepted) nextErrors.fairUseAccepted = 'Required';
      if (!draft.privacyAccepted) nextErrors.privacyAccepted = 'Required';
    }
    if (step === 4) {
      if (!draft.signatureName.trim()) nextErrors.signatureName = 'Type your full name to sign';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const goNext = () => {
    if (!validateStep(draft.step)) {
      toast.error('Please fix the highlighted fields');
      return;
    }
    persist({ ...draft, step: Math.min(draft.step + 1, STEPS.length - 1) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    persist({ ...draft, step: Math.max(draft.step - 1, 0) });
  };

  const handlePay = async () => {
    if (!validateStep(3) || !validateStep(4)) {
      toast.error('Complete consents and signature first');
      return;
    }
    setPaying(true);
    try {
      const result = await submitCheckoutDraft(draft);
      if (result.url) {
        clearCheckoutDraft();
        window.location.href = result.url;
        return;
      }
      toast.success(result.message);
    } catch {
      toast.error('Could not start payment — try again or contact support');
    } finally {
      setPaying(false);
    }
  };

  return (
    <PublicMarketingLayout showFooter={draft.step < STEPS.length - 1}>
      <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
        <Link
          to="/pricing"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-s2d-teal-deep hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to pricing
        </Link>

        <h1 className="mt-4 text-2xl font-black text-s2d-teal-deep sm:text-3xl">Start with Sync2Dine</h1>
        <p className="mt-1 text-sm text-slate-600">Fare schedule {FARE_SCHEDULE_VERSION}</p>

        {/* Step indicator */}
        <ol className="mt-8 flex flex-wrap gap-2" aria-label="Checkout steps">
          {STEPS.map((label, idx) => (
            <li
              key={label}
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                idx === draft.step
                  ? 'bg-s2d-teal-deep text-white'
                  : idx < draft.step
                    ? 'bg-teal-100 text-teal-800'
                    : 'bg-slate-100 text-slate-500'
              }`}
            >
              {idx + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
          {draft.step === 0 && (
            <div className="space-y-6">
              <div>
                <Label htmlFor="package">Package</Label>
                <Select
                  value={draft.packageId}
                  onValueChange={(v) => setField('packageId', v as SaasPackageId)}
                >
                  <SelectTrigger id="package" className="mt-1.5 min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SAAS_PACKAGE_IDS.map((id) => (
                      <SelectItem key={id} value={id}>
                        {SAAS_PACKAGES[id].name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-sm text-slate-600">{pkg.description}</p>
              </div>

              <div>
                <Label>Billing interval</Label>
                <div className="mt-2 inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
                  {(['weekly', 'annual'] as BillingInterval[]).map((iv) => (
                    <button
                      key={iv}
                      type="button"
                      onClick={() => setField('interval', iv)}
                      className={`min-h-10 rounded-full px-4 text-sm font-semibold ${
                        draft.interval === iv ? 'bg-white text-s2d-teal-deep shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      {iv === 'weekly' ? 'Weekly' : 'Annual prepay'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="sites">Additional sites (beyond first venue)</Label>
                <Input
                  id="sites"
                  type="number"
                  min={0}
                  max={50}
                  value={draft.additionalSites}
                  onChange={(e) => setField('additionalSites', Math.max(0, Number(e.target.value) || 0))}
                  className="mt-1.5 min-h-11 max-w-[8rem]"
                />
                <p className="mt-1 text-xs text-slate-500">
                  ≥ £{ADDITIONAL_SITE_WEEKLY_GBP}/week or £{ADDITIONAL_SITE_ANNUAL_GBP}/year per extra site
                </p>
              </div>

              <div>
                <Label htmlFor="overage">When included minutes run out</Label>
                <Select
                  value={draft.overageAction}
                  onValueChange={(v) => setField('overageAction', v as OverageAction)}
                >
                  <SelectTrigger id="overage" className="mt-1.5 min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(OVERAGE_ACTION_LABELS) as OverageAction[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {OVERAGE_ACTION_LABELS[key]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {draft.step === 1 && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="venueName">Venue / trading name</Label>
                <Input
                  id="venueName"
                  value={draft.venueName}
                  onChange={(e) => setField('venueName', e.target.value)}
                  className="mt-1.5 min-h-11"
                  autoComplete="organization"
                />
                {errors.venueName ? <p className="mt-1 text-xs text-red-600">{errors.venueName}</p> : null}
              </div>
              <div>
                <Label htmlFor="contactName">Your name</Label>
                <Input
                  id="contactName"
                  value={draft.contactName}
                  onChange={(e) => setField('contactName', e.target.value)}
                  className="mt-1.5 min-h-11"
                  autoComplete="name"
                />
                {errors.contactName ? <p className="mt-1 text-xs text-red-600">{errors.contactName}</p> : null}
              </div>
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={draft.email}
                  onChange={(e) => setField('email', e.target.value)}
                  className="mt-1.5 min-h-11"
                  autoComplete="email"
                />
                {errors.email ? <p className="mt-1 text-xs text-red-600">{errors.email}</p> : null}
              </div>
              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={draft.phone}
                  onChange={(e) => setField('phone', e.target.value)}
                  className="mt-1.5 min-h-11"
                  autoComplete="tel"
                  placeholder="07… or +44…"
                />
                {errors.phone ? <p className="mt-1 text-xs text-red-600">{errors.phone}</p> : null}
              </div>
              <div>
                <Label htmlFor="address">Venue address</Label>
                <Input
                  id="address"
                  value={draft.address}
                  onChange={(e) => setField('address', e.target.value)}
                  className="mt-1.5 min-h-11"
                  autoComplete="street-address"
                />
                {errors.address ? <p className="mt-1 text-xs text-red-600">{errors.address}</p> : null}
              </div>
            </div>
          )}

          {draft.step === 2 && (
            <div className="space-y-4 text-sm text-slate-700">
              <h2 className="text-lg font-bold text-slate-900">Fare summary</h2>
              <p>{formatFareSummary(pkg)}</p>
              <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4">
                <div className="flex justify-between gap-4">
                  <dt>{pkg.name}</dt>
                  <dd className="font-semibold">
                    £{priceForInterval(pkg, draft.interval)}
                    {draft.interval === 'weekly' ? '/wk launch' : '/yr prepay'}
                  </dd>
                </div>
                {draft.additionalSites > 0 ? (
                  <div className="flex justify-between gap-4">
                    <dt>{draft.additionalSites} additional site(s)</dt>
                    <dd className="font-semibold">£{siteAddonGbp(draft.interval, draft.additionalSites)}</dd>
                  </div>
                ) : null}
                <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 text-base font-bold text-s2d-teal-deep">
                  <dt>Due at signup</dt>
                  <dd>£{total.toLocaleString('en-GB')}</dd>
                </div>
              </dl>
              <p className="text-xs text-slate-500">
                Overage preference: {OVERAGE_ACTION_LABELS[draft.overageAction]}. Full schedule:{' '}
                <Link to="/legal/fair-use-and-fares" className="text-s2d-teal-deep underline">
                  Fair use &amp; fares
                </Link>
              </p>
            </div>
          )}

          {draft.step === 3 && (
            <div className="space-y-5">
              <ConsentRow
                id="terms"
                checked={draft.termsAccepted}
                onCheckedChange={(v) => setField('termsAccepted', v === true)}
                error={errors.termsAccepted}
              >
                I agree to the{' '}
                <Link to="/legal/terms" target="_blank" className="text-s2d-teal-deep underline">
                  Terms of service
                </Link>
              </ConsentRow>
              <ConsentRow
                id="fairUse"
                checked={draft.fairUseAccepted}
                onCheckedChange={(v) => setField('fairUseAccepted', v === true)}
                error={errors.fairUseAccepted}
              >
                I accept the{' '}
                <Link to="/legal/fair-use-and-fares" target="_blank" className="text-s2d-teal-deep underline">
                  Fair use &amp; fares
                </Link>{' '}
                ({FARE_SCHEDULE_VERSION})
              </ConsentRow>
              <ConsentRow
                id="privacy"
                checked={draft.privacyAccepted}
                onCheckedChange={(v) => setField('privacyAccepted', v === true)}
                error={errors.privacyAccepted}
              >
                I have read the{' '}
                <Link to="/legal/privacy" target="_blank" className="text-s2d-teal-deep underline">
                  Privacy policy
                </Link>{' '}
                and{' '}
                <Link to="/legal/acceptable-use" target="_blank" className="text-s2d-teal-deep underline">
                  Acceptable use
                </Link>
              </ConsentRow>
              <div className="flex items-start gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4">
                <Checkbox
                  id="marketing"
                  checked={draft.marketingConsent}
                  onCheckedChange={(v) => setField('marketingConsent', v === true)}
                />
                <Label htmlFor="marketing" className="cursor-pointer text-sm font-normal leading-snug text-slate-700">
                  Optional: send me product updates and offers by email (you can unsubscribe anytime)
                </Label>
              </div>
            </div>
          )}

          {draft.step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600">
                Type your full legal name as an electronic signature. This confirms you are authorised to bind{' '}
                {draft.venueName || 'your venue'} to the agreement.
              </p>
              <div>
                <Label htmlFor="signature">Full name</Label>
                <Input
                  id="signature"
                  value={draft.signatureName}
                  onChange={(e) => setField('signatureName', e.target.value)}
                  className="mt-1.5 min-h-11 font-serif text-lg"
                  placeholder="As shown on your ID"
                />
                {errors.signatureName ? (
                  <p className="mt-1 text-xs text-red-600">{errors.signatureName}</p>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">
                See also{' '}
                <Link to="/legal/cancellation-refunds" className="underline">
                  Cancellation &amp; refunds
                </Link>{' '}
                and{' '}
                <Link to="/legal/cookies" className="underline">
                  Cookies
                </Link>
                .
              </p>
            </div>
          )}

          {draft.step === 5 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-teal-100">
                <CreditCard className="h-7 w-7 text-teal-700" aria-hidden />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900">Ready to pay</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {pkg.name} · £{total.toLocaleString('en-GB')}
                  {draft.interval === 'weekly' ? ' / week (launch)' : ' / year prepay'}
                  {draft.additionalSites > 0 ? ` incl. ${draft.additionalSites} extra site(s)` : ''}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Signed by {draft.signatureName} for {draft.venueName}
                </p>
              </div>
              <Button
                type="button"
                className="min-h-12 w-full bg-teal-700 text-base hover:bg-teal-800"
                disabled={paying}
                onClick={() => void handlePay()}
              >
                {paying ? 'Starting payment…' : `Pay £${total.toLocaleString('en-GB')} — secure checkout`}
              </Button>
              <p className="text-xs text-slate-500">
                Draft saved locally. Payment uses Stripe when configured; otherwise we will contact you at {draft.email}.
              </p>
            </div>
          )}
        </div>

        {draft.step < STEPS.length - 1 ? (
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={goBack}
              disabled={draft.step === 0}
            >
              Back
            </Button>
            <Button type="button" className="min-h-11 bg-teal-700 hover:bg-teal-800" onClick={goNext}>
              Continue
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        ) : null}
      </div>
    </PublicMarketingLayout>
  );
}

function ConsentRow({
  id,
  checked,
  onCheckedChange,
  error,
  children,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (v: boolean | 'indeterminate') => void;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="flex items-start gap-3">
        <Checkbox id={id} checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
        <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-snug text-slate-700">
          {children}
        </Label>
        {checked ? <Check className="ml-auto h-4 w-4 shrink-0 text-teal-600" aria-hidden /> : null}
      </div>
      {error ? <p className="mt-1 pl-7 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
