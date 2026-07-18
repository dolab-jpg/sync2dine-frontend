import { integrationService } from '../integrations/integrationService';
import type { PaymentStage } from '../contracts/types';

export interface TemplateVariables {
  CUSTOMER_NAME?: string;
  CUSTOMER_EMAIL?: string;
  CUSTOMER_PHONE?: string;
  CUSTOMER_ADDRESS?: string;
  QUOTE_TOTAL?: string;
  QUOTE_EXPIRY?: string;
  LABOUR_DAYS?: string;
  COMPANY_NAME?: string;
  COMPANY_PHONE?: string;
  COMPANY_EMAIL?: string;
  COMPANY_WEBSITE?: string;
  COMPANY_REGISTRATION?: string;
  COMPANY_VAT?: string;
  USER_NAME?: string;
  DISCOUNT_MESSAGE?: string;
  BOOKING_DATE?: string;
  BOOKING_TIME?: string;
  PAYMENT_SCHEDULE?: string;
  DEPOSIT_AMOUNT?: string;
  CONTRACT_TOTAL?: string;
  CONTRACT_SIGN_LINK?: string;
  JOB_LINE_ITEMS?: string;
  RESTAURANT_NAME?: string;
  MONTHLY_PRICE?: string;
  SETUP_FEE?: string;
  DEMO_PHONE?: string;
  DEMO_VIDEO_URL?: string;
  SALES_PDF_URL?: string;
  ASSETS_BLOCK?: string;
  CHECKOUT_LINK?: string;
  [key: string]: string | undefined;
}

const gbp = (n: number) => n.toLocaleString('en-GB', { maximumFractionDigits: 0 });

/** Format a stage payment schedule as readable plain text for emails. */
export function formatPaymentSchedule(stages: PaymentStage[]): string {
  if (!stages.length) return '';
  return stages
    .map((s) => `• ${s.label} — £${gbp(s.amount)} (${s.percent}%)${s.dueTrigger ? ` — ${s.dueTrigger}` : ''}`)
    .join('\n');
}

/** Format job line items (and optional labour/extras) as readable plain text. */
export function formatJobLineItems(
  items: { name: string; total: number }[],
  labour: { description: string; total: number }[] = [],
  extras: { description: string; price: number }[] = []
): string {
  const lines = [
    ...items.map((i) => `• ${i.name} — £${gbp(i.total)}`),
    ...labour.map((l) => `• ${l.description} — £${gbp(l.total)}`),
    ...extras.map((e) => `• ${e.description} — £${gbp(e.price)}`),
  ];
  return lines.join('\n');
}

export function renderTemplate(template: string, variables: TemplateVariables): string {
  const company = integrationService.getConfig('company');
  const merged: TemplateVariables = {
    COMPANY_NAME: company.companyName || 'Sync2Dine',
    COMPANY_PHONE: company.phone || '020 3745 3233',
    COMPANY_EMAIL: company.email || 'info@sync2dine.io',
    COMPANY_WEBSITE: company.website || 'https://sync2dine.io',
    COMPANY_REGISTRATION: company.companyRegistrationNumber || '',
    COMPANY_VAT: company.vatNumber || '',
    MONTHLY_PRICE: '350',
    SETUP_FEE: '0',
    DEMO_PHONE: '',
    RESTAURANT_NAME: variables.RESTAURANT_NAME || 'your restaurant',
    ASSETS_BLOCK: variables.ASSETS_BLOCK || '',
    CHECKOUT_LINK: variables.CHECKOUT_LINK || '',
    ...variables,
  };

  return template.replace(/\{([A-Z_]+)\}/g, (_, key: string) => merged[key] ?? `{${key}}`);
}

export function buildQuoteVariables(
  customer: { name: string; email: string; phone: string; address: string },
  quote: { total: number; expiresAt: string; labour?: { days?: number }[] },
  userName?: string,
  discount?: number
): TemplateVariables {
  const labourDays = quote.labour?.reduce((sum, l) => sum + (l.days ?? 0), 0) ?? 0;
  return {
    CUSTOMER_NAME: customer.name,
    CUSTOMER_EMAIL: customer.email,
    CUSTOMER_PHONE: customer.phone,
    CUSTOMER_ADDRESS: customer.address,
    QUOTE_TOTAL: quote.total.toLocaleString('en-GB', { minimumFractionDigits: 2 }),
    QUOTE_EXPIRY: new Date(quote.expiresAt).toLocaleDateString('en-GB'),
    LABOUR_DAYS: String(labourDays),
    USER_NAME: userName ?? 'Builder Diddies Team',
    DISCOUNT_MESSAGE: discount && discount > 0
      ? `You have received a ${discount}% discount on this quote.`
      : '',
  };
}
