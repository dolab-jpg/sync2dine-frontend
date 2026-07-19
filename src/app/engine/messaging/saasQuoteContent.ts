import {
  ADDITIONAL_SITE_ANNUAL_GBP,
  ADDITIONAL_SITE_WEEKLY_GBP,
  FARE_SCHEDULE_VERSION,
  OUTBOUND_OVERAGE,
  getPackage,
  isSaasPackageId,
  priceForInterval,
  type BillingInterval,
  type SaasPackageDef,
  type SaasPackageId,
} from '../saas/saasPackages';

/** Canonical Sync2Dine sales contact — landline is the primary CTA. */
export const SYNC2DINE_CONTACT = {
  website: 'sync2dine.io',
  phone: '020 3745 3233',
  /** E.164 for tel: links (click-to-call). */
  phoneTel: '+442037453233',
  email: 'info@sync2dine.io',
  sellerName: 'Sally',
  sellerTitle: 'Sync2Dine sales',
} as const;

export type SaasQuoteLike = {
  id?: string;
  customerName: string;
  createdAt?: string;
  expiresAt: string;
  total?: number;
  items?: Array<{ productId?: string; name?: string; total?: number }>;
  wizardAnswers?: Record<string, unknown>;
  customer?: {
    venueName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
};

export type SaasQuoteContentOptions = {
  packageId?: SaasPackageId;
  billingInterval?: BillingInterval;
  checkoutUrl?: string;
  issuedAt?: string;
};

export type SaasQuoteContent = {
  brand: {
    name: 'Sync2Dine';
    strapline: string;
    contact: typeof SYNC2DINE_CONTACT;
  };
  quote: {
    reference: string;
    issuedDate: string;
    expiryDate: string;
    checkoutUrl?: string;
  };
  customer: {
    name: string;
    venueName?: string;
    contactName?: string;
    email?: string;
    phone?: string;
    address?: string;
  };
  plan: {
    packageId: SaasPackageId;
    name: string;
    description: string;
    family: SaasPackageDef['family'];
    billingInterval: BillingInterval;
    billingLabel: string;
    amountGbp: number;
    standardWeeklyGbp: number;
    launchWeeklyGbp: number;
    annualPrepayGbp: number;
    additionalSites: number;
    launchActive: boolean;
    badge?: string;
  };
  headline: string;
  introduction: string;
  benefits: Array<{ title: string; detail: string }>;
  inclusions: string[];
  fares: Array<{ label: string; value: string }>;
  implementation: string[];
  terms: string[];
  notes?: string;
};

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatDate(value: string | undefined): string {
  if (!value) return new Date().toLocaleDateString('en-GB');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

function derivePackageId(quote: SaasQuoteLike, explicit?: SaasPackageId): SaasPackageId {
  if (explicit) return explicit;
  const wizardPackage = quote.wizardAnswers?.packageId;
  if (isSaasPackageId(wizardPackage)) return wizardPackage;
  const productPackage = quote.items?.find((item) => isSaasPackageId(item.productId))?.productId;
  return isSaasPackageId(productPackage) ? productPackage : 'judie_starter';
}

function buildBenefits(pkg: SaasPackageDef): SaasQuoteContent['benefits'] {
  const benefits: SaasQuoteContent['benefits'] = [];
  if (pkg.judieTier !== 'none') {
    benefits.push({
      title: 'Answer every opportunity',
      detail: 'Judie handles restaurant calls consistently, capturing orders and bookings while your team serves guests.',
    });
  }
  if (pkg.weeklyOutboundMinutes > 0) {
    benefits.push({
      title: 'Turn quiet periods into revenue',
      detail: 'Included outbound capacity supports confirmations, win-back activity and thoughtful guest follow-up.',
    });
  }
  if (pkg.includesAtmosphere) {
    benefits.push({
      title: 'A more valuable venue',
      detail: 'Atmosphere unifies venue audio, timely promotional messaging and practical staff training.',
    });
  }
  benefits.push({
    title: 'One hospitality platform',
    detail: 'Give managers a clear operational view without adding another fragmented point solution.',
  });
  return benefits.slice(0, 4);
}

function buildInclusions(pkg: SaasPackageDef): string[] {
  const inclusions: string[] = [];
  if (pkg.judieTier !== 'none') {
    inclusions.push(
      `${pkg.weeklyAiMinutes.toLocaleString('en-GB')} Judie AI minutes each week${pkg.inboundOnly ? ' (inbound only)' : ''}`,
    );
    inclusions.push(
      pkg.weeklyOutboundMinutes > 0
        ? `${pkg.weeklyOutboundMinutes.toLocaleString('en-GB')} outbound minutes each week`
        : 'Inbound call handling for orders and bookings',
    );
    inclusions.push('Restaurant call flows, booking and order capture, plus staff transfer rules');
  }
  if (pkg.includesAtmosphere) {
    inclusions.push('Atmosphere venue audio and promotional messaging');
    inclusions.push('Sync2Gear staff training experience');
  }
  inclusions.push('Guided onboarding, configuration and launch support');
  return inclusions;
}

function buildFares(pkg: SaasPackageDef): SaasQuoteContent['fares'] {
  const fares: SaasQuoteContent['fares'] = [
    { label: 'Standard weekly fare', value: `£${pkg.standardWeeklyGbp.toLocaleString('en-GB')}` },
    { label: 'Launch weekly fare', value: `£${pkg.launchWeeklyGbp.toLocaleString('en-GB')} (40% off)` },
    { label: 'Annual prepay', value: `£${pkg.annualPrepayGbp.toLocaleString('en-GB')}` },
  ];
  if (pkg.weeklyAiMinutes > 0) {
    fares.push({
      label: 'Judie AI overage',
      value: `£${pkg.aiOverageGbpPerMinute.toFixed(2)} per minute`,
    });
  }
  if (pkg.weeklyOutboundMinutes > 0) {
    fares.push({
      label: 'Outbound overage',
      value: `£${OUTBOUND_OVERAGE.mobileGbpPerMin.toFixed(2)} mobile / £${OUTBOUND_OVERAGE.landlineGbpPerMin.toFixed(2)} landline per minute`,
    });
  }
  return fares;
}

/**
 * Creates one presentation-ready source of truth for the SaaS PDF and email.
 * Quote-specific values win; catalog values supply package facts and fallbacks.
 */
export function buildSaasQuoteContent(
  quote: SaasQuoteLike,
  options: SaasQuoteContentOptions = {},
): SaasQuoteContent {
  const wizard = quote.wizardAnswers ?? {};
  const packageId = derivePackageId(quote, options.packageId);
  const pkg = getPackage(packageId);
  const billingInterval =
    options.billingInterval ?? (wizard.billingInterval === 'annual' ? 'annual' : 'weekly');
  const launchActive = wizard.launchActive !== false;
  const additionalSites = Math.max(0, Math.floor(numberValue(wizard.additionalSites)));
  const additionalSiteRate =
    billingInterval === 'annual' ? ADDITIONAL_SITE_ANNUAL_GBP : ADDITIONAL_SITE_WEEKLY_GBP;
  const catalogAmount =
    priceForInterval(pkg, billingInterval, launchActive) + additionalSites * additionalSiteRate;
  const amountGbp =
    Number.isFinite(quote.total) && Number(quote.total) > 0 ? Number(quote.total) : catalogAmount;
  const customer = quote.customer ?? {};
  const venueName = customer.venueName ?? stringValue(wizard.venueName);
  const contactName = customer.contactName ?? stringValue(wizard.contactName);
  const checkoutUrl = stringValue(options.checkoutUrl);
  const deploymentNotes = stringValue(wizard.deploymentNotes);
  const notes = stringValue(wizard.notes);
  const billingLabel = billingInterval === 'annual' ? 'Annual prepay' : 'Per week';

  return {
    brand: {
      name: 'Sync2Dine',
      strapline: 'Hospitality technology that answers, engages and grows',
      contact: SYNC2DINE_CONTACT,
    },
    quote: {
      reference: quote.id?.trim() || `S2D-${Date.now().toString(36).toUpperCase()}`,
      issuedDate: formatDate(options.issuedAt ?? quote.createdAt),
      expiryDate: formatDate(quote.expiresAt),
      ...(checkoutUrl ? { checkoutUrl } : {}),
    },
    customer: {
      name: quote.customerName.trim() || 'Valued customer',
      ...(venueName ? { venueName } : {}),
      ...(contactName ? { contactName } : {}),
      ...(customer.email ? { email: customer.email } : {}),
      ...(customer.phone ? { phone: customer.phone } : {}),
      ...(customer.address ? { address: customer.address } : {}),
    },
    plan: {
      packageId,
      name: pkg.name,
      description: pkg.description,
      family: pkg.family,
      billingInterval,
      billingLabel,
      amountGbp,
      standardWeeklyGbp: pkg.standardWeeklyGbp,
      launchWeeklyGbp: pkg.launchWeeklyGbp,
      annualPrepayGbp: pkg.annualPrepayGbp,
      additionalSites,
      launchActive,
      ...(pkg.badge ? { badge: pkg.badge } : {}),
    },
    headline: `${pkg.name}, shaped for ${venueName || quote.customerName}`,
    introduction:
      'A clear, managed route to stronger guest response, smoother service and more consistent revenue capture.',
    benefits: buildBenefits(pkg),
    inclusions: buildInclusions(pkg),
    fares: buildFares(pkg),
    implementation: [
      'Discovery and venue configuration',
      'Call, booking, order and escalation setup as applicable',
      'Team handover, launch checks and go-live support',
      ...(deploymentNotes ? [`Venue note: ${deploymentNotes}`] : []),
    ],
    terms: [
      `This quotation is valid until ${formatDate(quote.expiresAt)}.`,
      'Prices are shown in GBP. VAT applies where chargeable.',
      'Included minutes reset weekly and unused minutes do not roll over.',
      `Usage and overage are governed by fare schedule ${FARE_SCHEDULE_VERSION}.`,
      'Service is subject to the Sync2Dine terms, fair-use policy and agreed billing mandate.',
    ],
    ...(notes ? { notes } : {}),
  };
}
