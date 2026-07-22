import { SYNC2DINE_CONTACT } from './saasQuoteContent';

/** Customer-facing weekly usage invoice model — sell lines only, never margins/cost. */
export type SaasUsageInvoiceLine = {
  description: string;
  quantity: number;
  unitPriceGbp: number;
  amountGbp: number;
};

export type SaasUsageInvoiceContent = {
  brand: {
    name: 'Sync2Dine';
    contact: typeof SYNC2DINE_CONTACT;
  };
  invoice: {
    reference: string;
    status: 'paid' | 'due' | 'open';
    issuedDate: string;
    periodLabel: string;
    isoWeek: string;
    hostedInvoiceUrl?: string;
  };
  customer: {
    name: string;
    venueName?: string;
    email?: string;
    address?: string;
  };
  plan: {
    packageName: string;
  };
  usageSummary: Array<{ label: string; included: number; used: number; unit: string }>;
  lines: SaasUsageInvoiceLine[];
  amountGbp: number;
  paymentNote: string;
};

export type WeeklyUsageBreakdownLike = {
  orgId?: string;
  packageName: string;
  weekLabel: string;
  isoWeek: string;
  customerSubtotalGbp: number;
  customerLines: Array<{
    description: string;
    quantity: number;
    unitPriceGbp: number;
    amountGbp: number;
  }>;
  usageSummary: Array<{ label: string; included: number; used: number; unit: string }>;
  /** Must never be read into customer content. */
  internalMargins?: unknown;
};

function formatDate(value?: string): string {
  if (!value) return new Date().toLocaleDateString('en-GB');
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-GB');
}

export function buildSaasUsageInvoiceContent(input: {
  breakdown: WeeklyUsageBreakdownLike;
  customerName: string;
  venueName?: string;
  customerEmail?: string;
  customerAddress?: string;
  stripeInvoiceId?: string;
  hostedInvoiceUrl?: string;
  status?: 'paid' | 'due' | 'open';
  issuedAt?: string;
}): SaasUsageInvoiceContent {
  const { breakdown } = input;
  const status = input.status
    ?? (input.hostedInvoiceUrl && breakdown.customerSubtotalGbp > 0 ? 'due' : 'open');
  const paymentNote = status === 'paid'
    ? 'This amount was charged to the card on file for your Sync2Dine subscription.'
    : input.hostedInvoiceUrl
      ? 'We could not debit your card automatically. Please complete payment using the secure Stripe invoice link.'
      : 'This amount will be charged to the card on file for your Sync2Dine subscription.';

  return {
    brand: {
      name: 'Sync2Dine',
      contact: SYNC2DINE_CONTACT,
    },
    invoice: {
      reference: input.stripeInvoiceId
        || `USAGE-${breakdown.isoWeek}-${String(breakdown.orgId || 'org').slice(0, 8)}`,
      status,
      issuedDate: formatDate(input.issuedAt),
      periodLabel: breakdown.weekLabel,
      isoWeek: breakdown.isoWeek,
      hostedInvoiceUrl: input.hostedInvoiceUrl,
    },
    customer: {
      name: input.customerName,
      venueName: input.venueName,
      email: input.customerEmail,
      address: input.customerAddress,
    },
    plan: { packageName: breakdown.packageName },
    usageSummary: breakdown.usageSummary.map((row) => ({
      label: row.label,
      included: row.included,
      used: row.used,
      unit: row.unit,
    })),
    lines: breakdown.customerLines.map((line) => ({
      description: line.description,
      quantity: line.quantity,
      unitPriceGbp: line.unitPriceGbp,
      amountGbp: line.amountGbp,
    })),
    amountGbp: breakdown.customerSubtotalGbp,
    paymentNote,
  };
}
