import {
  defaultCheckoutDraft,
  loadCheckoutDraft,
  saveCheckoutDraft,
  type CheckoutDraft,
} from './checkoutDraft';
import { isSaasPackageId, type BillingInterval, type OverageAction, type SaasPackageId } from './saasPackages';

export type SallyCheckoutHandoff = {
  startPath: string;
  venueName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  packageId?: SaasPackageId;
  interval?: BillingInterval;
  overageAction?: OverageAction;
};

/** Merge Sally web chat draft into local checkout draft + return path. */
export function applySallyCheckoutHandoff(handoff: SallyCheckoutHandoff | null | undefined): string {
  if (!handoff) return '/start';
  const existing = loadCheckoutDraft();
  const packageId: SaasPackageId =
    handoff.packageId && isSaasPackageId(handoff.packageId)
      ? handoff.packageId
      : existing?.packageId ?? 'judie_starter';
  const interval: BillingInterval =
    handoff.interval === 'annual' || handoff.interval === 'weekly'
      ? handoff.interval
      : existing?.interval ?? 'weekly';

  const base: CheckoutDraft = existing
    ? { ...existing, packageId, interval }
    : defaultCheckoutDraft(packageId, interval);

  const next: CheckoutDraft = {
    ...base,
    venueName: handoff.venueName?.trim() || base.venueName,
    contactName: handoff.contactName?.trim() || base.contactName,
    email: handoff.email?.trim() || base.email,
    phone: handoff.phone?.trim() || base.phone,
    address: handoff.address?.trim() || base.address,
    overageAction: handoff.overageAction || base.overageAction,
    step: Math.max(base.step, handoff.venueName || handoff.email ? 1 : 0),
  };
  saveCheckoutDraft(next);
  return handoff.startPath || '/start';
}
