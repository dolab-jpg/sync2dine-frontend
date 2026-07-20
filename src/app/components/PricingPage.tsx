import { useState } from 'react';
import { Link } from 'react-router';
import { Check, ChevronDown } from 'lucide-react';
import PublicMarketingLayout from './PublicMarketingLayout';
import AskSync2DineHero from './marketing/AskSync2DineHero';
import { Button } from './ui/button';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from './ui/accordion';
import {
  ADDITIONAL_SITE_ANNUAL_GBP,
  ADDITIONAL_SITE_WEEKLY_GBP,
  FARE_SCHEDULE_VERSION,
  NEED_CARDS,
  OUTBOUND_OVERAGE,
  SAAS_PACKAGES,
  type BillingInterval,
  type SaasPackageDef,
  type SaasPackageId,
  getPackage,
  priceForInterval,
} from '../engine/saas/saasPackages';

const SCALE_PACKAGE_ORDER: SaasPackageId[] = [
  'judie_payg_inbound',
  'judie_pro',
  'judie_enterprise',
  'combined_pro',
  'atmosphere_enterprise',
  'combined_enterprise',
];

function formatGbp(amount: number, suffix?: string): string {
  return `£${amount.toLocaleString('en-GB')}${suffix ? ` ${suffix}` : ''}`;
}

function PriceBlock({ pkg, interval }: { pkg: SaasPackageDef; interval: BillingInterval }) {
  if (interval === 'annual') {
    return (
      <div className="mt-4">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="text-3xl font-black tracking-tight text-s2d-teal-deep sm:text-4xl">
            {formatGbp(pkg.annualPrepayGbp)}
          </span>
          <span className="text-sm text-slate-500">/ year prepay</span>
        </p>
        <p className="mt-1 text-xs text-slate-500">50% off annualized launch rate</p>
      </div>
    );
  }

  return (
    <div className="mt-4">
      <p className="flex flex-wrap items-baseline gap-2">
        <span className="text-lg text-slate-400 line-through">{formatGbp(pkg.standardWeeklyGbp)}</span>
        <span className="text-3xl font-black tracking-tight text-s2d-teal-deep sm:text-4xl">
          {formatGbp(pkg.launchWeeklyGbp)}
        </span>
        <span className="text-sm text-slate-500">/ week</span>
      </p>
      <p className="mt-1 text-xs text-teal-700 font-medium">Launch offer · 40% off standard</p>
    </div>
  );
}

function PackageHighlights({ pkg }: { pkg: SaasPackageDef }) {
  const items: string[] = [];
  if (pkg.weeklyAiMinutes > 0) {
    items.push(
      `${pkg.weeklyAiMinutes} Judie AI min/week` +
        (pkg.inboundOnly ? ' (inbound only)' : '') +
        (pkg.weeklyOutboundMinutes > 0 ? ` · ${pkg.weeklyOutboundMinutes} outbound min/week` : ''),
    );
    items.push(`AI overage £${pkg.aiOverageGbpPerMinute.toFixed(2)}/min`);
  }
  if (pkg.includesAtmosphere) {
    items.push('Atmosphere venue audio, messaging & training');
  }
  if (!pkg.inboundOnly && pkg.weeklyOutboundMinutes > 0) {
    items.push(
      `Outbound overage £${OUTBOUND_OVERAGE.mobileGbpPerMin}/min mobile · £${OUTBOUND_OVERAGE.landlineGbpPerMin}/min landline`,
    );
  }
  items.push('Minutes reset weekly · cancel anytime');

  return (
    <ul className="mt-5 flex-1 space-y-2.5 text-sm text-slate-600">
      {items.map((line) => (
        <li key={line} className="flex gap-2">
          <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PricingPage() {
  const [interval, setInterval] = useState<BillingInterval>('weekly');
  const [scaleOpen, setScaleOpen] = useState(false);

  return (
    <PublicMarketingLayout>
      <AskSync2DineHero compact />

      <div className="mx-auto max-w-5xl px-4 pb-10 sm:pb-14">
        {/* Pricing intro */}
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-s2d-teal">Packages</p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-s2d-teal-deep sm:text-4xl">
            Pricing built around what you need
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-base text-slate-600">
            Judie answers every call. Atmosphere runs the floor. Complete bundles both — with transparent weekly fares
            and optional annual prepay.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-full bg-teal-700 px-3 py-1 text-xs font-bold text-white">40% launch offer</span>
            <span className="rounded-full border border-teal-700/30 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
              50% off annual prepay
            </span>
          </div>
        </div>

        {/* Billing toggle */}
        <div className="mt-10 flex flex-col items-center gap-3">
          <div
            className="inline-flex rounded-full border border-slate-200 bg-white p-1 shadow-sm"
            role="group"
            aria-label="Billing interval"
          >
            <button
              type="button"
              onClick={() => setInterval('weekly')}
              className={`min-h-11 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                interval === 'weekly'
                  ? 'bg-s2d-teal-deep text-white'
                  : 'text-slate-600 hover:text-s2d-teal-deep'
              }`}
            >
              Weekly
            </button>
            <button
              type="button"
              onClick={() => setInterval('annual')}
              className={`min-h-11 rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
                interval === 'annual'
                  ? 'bg-s2d-teal-deep text-white'
                  : 'text-slate-600 hover:text-s2d-teal-deep'
              }`}
            >
              Annual prepay
            </button>
          </div>
          <p className="text-xs text-slate-500">
            Additional site ≥ {formatGbp(ADDITIONAL_SITE_WEEKLY_GBP)}/week · {formatGbp(ADDITIONAL_SITE_ANNUAL_GBP)}/year
            on annual
          </p>
        </div>

        {/* Need cards — single column under md */}
        <div className="mt-10 flex flex-col gap-6 md:grid md:grid-cols-3">
          {NEED_CARDS.map((card) => {
            const pkg = getPackage(card.fromPackageId);
            const highlighted = card.id === 'complete' || card.badge;
            return (
              <div
                key={card.id}
                className={`relative flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                  highlighted ? 'border-teal-500 ring-2 ring-teal-500/25' : 'border-slate-200'
                }`}
              >
                {(card.badge || pkg.badge) && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-teal-700 px-3 py-0.5 text-xs font-semibold text-white">
                    {card.badge || pkg.badge}
                  </span>
                )}
                <p className="text-xs font-semibold uppercase tracking-wider text-s2d-teal">{card.tagline}</p>
                <h2 className="mt-1 text-xl font-bold text-slate-900">{card.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{card.description}</p>
                <PriceBlock pkg={pkg} interval={interval} />
                <PackageHighlights pkg={pkg} />
                <Button asChild className="mt-6 w-full min-h-11 bg-teal-700 hover:bg-teal-800">
                  <Link to={`/start?package=${pkg.id}&interval=${interval}`}>Get started</Link>
                </Button>
              </div>
            );
          })}
        </div>

        {/* Scale your operation */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <button
            type="button"
            onClick={() => setScaleOpen((o) => !o)}
            className="flex w-full min-h-12 items-center justify-between gap-3 px-5 py-4 text-left"
            aria-expanded={scaleOpen}
          >
            <span>
              <span className="block text-base font-bold text-slate-900">Scale your operation</span>
              <span className="text-sm text-slate-500">Pro, Enterprise, PAYG, and Complete upgrades</span>
            </span>
            <ChevronDown
              className={`h-5 w-5 shrink-0 text-slate-500 transition-transform ${scaleOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {scaleOpen ? (
            <div className="border-t border-slate-100 px-5 pb-5 pt-2">
              <div className="flex flex-col gap-3">
                {SCALE_PACKAGE_ORDER.map((id) => {
                  const pkg = SAAS_PACKAGES[id];
                  const amount = priceForInterval(pkg, interval);
                  return (
                    <div
                      key={id}
                      className="flex flex-col gap-3 rounded-xl border border-slate-100 bg-slate-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div>
                        <p className="font-semibold text-slate-900">{pkg.name}</p>
                        <p className="text-sm text-slate-600">{pkg.description}</p>
                      </div>
                      <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                        {interval === 'weekly' ? (
                          <p className="text-sm">
                            <span className="text-slate-400 line-through">{formatGbp(pkg.standardWeeklyGbp)}</span>{' '}
                            <span className="text-lg font-bold text-s2d-teal-deep">{formatGbp(pkg.launchWeeklyGbp)}</span>
                            <span className="text-slate-500"> /wk</span>
                          </p>
                        ) : (
                          <p className="text-lg font-bold text-s2d-teal-deep">
                            {formatGbp(amount)}
                            <span className="text-sm font-normal text-slate-500"> /yr</span>
                          </p>
                        )}
                        <Button asChild size="sm" variant="outline" className="min-h-10">
                          <Link to={`/start?package=${id}&interval=${interval}`}>Choose</Link>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Fare accordion */}
        <div className="mt-10">
          <Accordion type="single" collapsible className="rounded-2xl border border-slate-200 bg-white px-5 shadow-sm">
            <AccordionItem value="fares" className="border-none">
              <AccordionTrigger className="text-base font-bold text-slate-900 hover:no-underline">
                Fare details &amp; fair use
              </AccordionTrigger>
              <AccordionContent>
                <p className="text-sm text-slate-600">
                  Launch pricing is 40% off standard weekly rates. Annual prepay is 50% of the annualized launch weekly
                  rate. Included Judie minutes and outbound allowances reset each week; unused minutes do not roll over.
                </p>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                  <li>AI overage rates vary by package — see full schedule.</li>
                  <li>
                    Outbound overage: £{OUTBOUND_OVERAGE.mobileGbpPerMin}/min mobile · £
                    {OUTBOUND_OVERAGE.landlineGbpPerMin}/min landline (where outbound is included).
                  </li>
                  <li>
                    Additional sites from {formatGbp(ADDITIONAL_SITE_WEEKLY_GBP)}/week ({formatGbp(ADDITIONAL_SITE_ANNUAL_GBP)}
                    /year annual).
                  </li>
                </ul>
                <p className="mt-4 text-sm">
                  <Link
                    to="/legal/fair-use-and-fares"
                    className="font-semibold text-s2d-teal-deep underline-offset-2 hover:underline"
                  >
                    Read fair use &amp; fares ({FARE_SCHEDULE_VERSION}) →
                  </Link>
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Button asChild variant="outline" className="min-h-11">
            <Link to="/login">Already a customer? Sign in</Link>
          </Button>
        </div>
      </div>
    </PublicMarketingLayout>
  );
}
