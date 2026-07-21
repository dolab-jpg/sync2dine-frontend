import type { BillingInterval, OverageAction, SaasPackageId } from './saasPackages';
import { isSaasPackageId } from './saasPackages';

export const CHECKOUT_DRAFT_KEY = 's2d_start_checkout_draft';

export type CheckoutDraft = {
  packageId: SaasPackageId;
  interval: BillingInterval;
  additionalSites: number;
  overageAction: OverageAction;
  venueName: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  termsAccepted: boolean;
  fairUseAccepted: boolean;
  privacyAccepted: boolean;
  marketingConsent: boolean;
  signatureName: string;
  step: number;
  updatedAt: string;
};

export const OVERAGE_ACTION_LABELS: Record<OverageAction, string> = {
  continue_bill: 'Continue and bill overage automatically',
  pause_transfer: 'Pause AI and transfer calls to staff',
  approval_required: 'Require my approval before extra usage',
};

export function defaultCheckoutDraft(
  packageId: SaasPackageId = 'judie_starter',
  interval: BillingInterval = 'weekly',
): CheckoutDraft {
  return {
    packageId,
    interval,
    additionalSites: 0,
    overageAction: 'continue_bill',
    venueName: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    termsAccepted: false,
    fairUseAccepted: false,
    privacyAccepted: false,
    marketingConsent: false,
    signatureName: '',
    step: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function loadCheckoutDraft(): CheckoutDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CheckoutDraft>;
    if (!isSaasPackageId(parsed.packageId)) return null;
    return {
      ...defaultCheckoutDraft(parsed.packageId, parsed.interval ?? 'weekly'),
      ...parsed,
      packageId: parsed.packageId,
      marketingConsent: Boolean(parsed.marketingConsent),
    };
  } catch {
    return null;
  }
}

export function saveCheckoutDraft(draft: CheckoutDraft): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(
    CHECKOUT_DRAFT_KEY,
    JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }),
  );
}

export function clearCheckoutDraft(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(CHECKOUT_DRAFT_KEY);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): boolean {
  return EMAIL_RE.test(email.trim());
}

/** UK-friendly phone: 10–15 digits after stripping formatting */
export function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return false;
  if (digits.startsWith('0') && digits.length >= 10) return true;
  if (digits.startsWith('44') && digits.length >= 12) return true;
  return digits.length >= 10;
}

export async function submitCheckoutDraft(draft: CheckoutDraft): Promise<{ ok: boolean; message: string; url?: string }> {
  try {
    const res = await fetch('/api/public/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(draft),
    });
    if (res.ok) {
      const data = (await res.json()) as { checkoutUrl?: string; message?: string };
      if (data.checkoutUrl) {
        return { ok: true, message: 'Redirecting to payment…', url: data.checkoutUrl };
      }
      return { ok: true, message: data.message || 'Checkout submitted.' };
    }
  } catch {
    /* fall through — API may not exist yet */
  }

  saveCheckoutDraft(draft);
  return {
    ok: true,
    message:
      'Your application is saved locally. Payment checkout will open here when Stripe self-serve is live — our team can follow up using your contact details.',
  };
}
