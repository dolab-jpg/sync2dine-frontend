import Stripe from 'stripe';
import {
  getOrganizationById,
  PLAN_CONFIG,
  updateOrganization,
  type OrgPlan,
} from './organizations';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY?.trim();
    if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
    stripeClient = new Stripe(key);
  }
  return stripeClient;
}

function priceIdForPlan(plan: OrgPlan): string {
  const map: Record<OrgPlan, string | undefined> = {
    starter: process.env.STRIPE_PRICE_STARTER,
    pro: process.env.STRIPE_PRICE_PRO,
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE,
  };
  const id = map[plan]?.trim();
  if (!id) {
    throw new Error(`Stripe price not configured for plan "${plan}". Set STRIPE_PRICE_${plan.toUpperCase()} in env.`);
  }
  return id;
}

export async function createSubscriptionForOrg(
  orgId: string,
  email: string,
  name: string,
): Promise<void> {
  const org = getOrganizationById(orgId);
  if (!org) throw new Error('Organization not found');

  const stripe = getStripe();
  let customerId = org.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: { orgId, orgName: org.name },
    });
    customerId = customer.id;
    updateOrganization(orgId, { stripeCustomerId: customerId });
  }

  const priceId = priceIdForPlan(org.plan);
  const subscription = await stripe.subscriptions.create({
    customer: customerId,
    items: [{ price: priceId }],
    metadata: { orgId },
    payment_behavior: 'default_incomplete',
    expand: ['latest_invoice.payment_intent'],
  });

  updateOrganization(orgId, {
    stripeSubscriptionId: subscription.id,
    subscriptionStatus: subscription.status,
    currentPeriodEnd: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : undefined,
  });
}

export async function createCheckoutSessionForOrg(
  orgId: string,
  opts?: { metadata?: Record<string, string> },
): Promise<string> {
  const org = getOrganizationById(orgId);
  if (!org) throw new Error('Organization not found');

  const stripe = getStripe();
  let customerId = org.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: org.contactEmail,
      name: org.contactName,
      metadata: { orgId, orgName: org.name },
    });
    customerId = customer.id;
    updateOrganization(orgId, { stripeCustomerId: customerId });
  }

  const baseUrl = process.env.APP_BASE_URL?.trim() || 'http://localhost:5174';
  const extraMeta = opts?.metadata || {};
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceIdForPlan(org.plan), quantity: 1 }],
    success_url: `${baseUrl}/platform/clients?stripe=success&org=${orgId}`,
    cancel_url: `${baseUrl}/platform/clients?stripe=cancel&org=${orgId}`,
    metadata: { orgId, ...extraMeta },
    subscription_data: { metadata: { orgId, ...extraMeta } },
  });

  if (!session.url) throw new Error('Stripe did not return a checkout URL');
  updateOrganization(orgId, {
    notes: `${org.notes || ''}\n[sally_checkout] session=${session.id} at=${new Date().toISOString()}`.trim(),
  });
  return session.url;
}

/** Sally / ops: is this org paid / active on Stripe? */
export function getOrgPaymentStatus(orgId: string): {
  organizationId: string;
  status: string;
  subscriptionStatus: string | null;
  paid: boolean;
  currentPeriodEnd: string | null;
  contactEmail: string;
} | null {
  const org = getOrganizationById(orgId);
  if (!org) return null;
  const sub = (org.subscriptionStatus || '').toLowerCase();
  const paid = org.status === 'active'
    || sub === 'active'
    || sub === 'trialing';
  return {
    organizationId: org.id,
    status: org.status,
    subscriptionStatus: org.subscriptionStatus || null,
    paid,
    currentPeriodEnd: org.currentPeriodEnd || null,
    contactEmail: org.contactEmail,
  };
}

async function stampCrmPaidForOrg(orgId: string, detail: string): Promise<void> {
  try {
    const org = getOrganizationById(orgId);
    if (!org) return;
    const { getDataStore, saveCustomerRecord, appendCustomerCallActivity, syncData } = await import('./data-store');
    const store = getDataStore();
    const email = (org.contactEmail || '').trim().toLowerCase();
    const phone = (org.contactPhone || '').replace(/\D/g, '');
    let touched = false;
    for (const c of (store.customers as Array<Record<string, unknown>>) || []) {
      const cEmail = String(c.email || '').trim().toLowerCase();
      const cPhone = String(c.phone || '').replace(/\D/g, '');
      const match = (email && cEmail === email)
        || (phone && cPhone && cPhone.endsWith(phone.slice(-10)))
        || String(c.organizationId || '') === orgId
        || String(c.saasOrgId || '') === orgId;
      if (!match) continue;
      saveCustomerRecord({
        ...c,
        saasOrgId: orgId,
        saasPaymentStatus: 'paid',
        status: String(c.status || '') === 'lead' ? 'customer' : c.status,
      });
      appendCustomerCallActivity({
        customerId: String(c.id),
        summary: 'Stripe payment confirmed',
        detail,
        aim: 'paid',
        type: 'note',
        createdBy: 'stripe',
      });
      touched = true;
    }
    if (touched) syncData({ customers: store.customers });
  } catch (err) {
    console.warn('[stripe] stampCrmPaidForOrg failed:', err instanceof Error ? err.message : err);
  }
}

export function mapStripeStatusToOrgStatus(
  subscriptionStatus: string,
): 'active' | 'past_due' | 'suspended' | 'cancelled' | 'trial' {
  switch (subscriptionStatus) {
    case 'active':
    case 'trialing':
      return subscriptionStatus === 'trialing' ? 'trial' : 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'cancelled';
    case 'paused':
    case 'incomplete':
      return 'suspended';
    default:
      return 'active';
  }
}

export async function handleStripeWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      let org = orgId ? getOrganizationById(orgId) : undefined;
      if (!org) {
        const { getOrganizationByStripeSubscriptionId } = await import('./organizations');
        org = getOrganizationByStripeSubscriptionId(sub.id);
      }
      if (!org) return;

      const status = event.type === 'customer.subscription.deleted'
        ? 'cancelled'
        : mapStripeStatusToOrgStatus(sub.status);

      updateOrganization(org.id, {
        stripeSubscriptionId: sub.id,
        subscriptionStatus: sub.status,
        status,
        currentPeriodEnd: sub.current_period_end
          ? new Date(sub.current_period_end * 1000).toISOString()
          : undefined,
      });
      if (status === 'active' || status === 'trial') {
        await stampCrmPaidForOrg(org.id, `Subscription ${sub.id} → ${sub.status}`);
      }
      break;
    }
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const { getOrganizationByStripeCustomerId } = await import('./organizations');
      const org = getOrganizationByStripeCustomerId(customerId);
      if (!org) return;
      updateOrganization(org.id, { status: 'past_due', subscriptionStatus: 'past_due' });
      break;
    }
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) return;
      const { getOrganizationByStripeCustomerId } = await import('./organizations');
      const org = getOrganizationByStripeCustomerId(customerId);
      if (!org) return;
      updateOrganization(org.id, { status: 'active', subscriptionStatus: 'active' });
      await stampCrmPaidForOrg(org.id, `Invoice paid ${invoice.id || ''}`.trim());
      break;
    }
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const orgId = session.metadata?.orgId;
      if (!orgId) break;
      const org = getOrganizationById(orgId);
      if (!org) break;
      if (session.mode === 'subscription' || session.payment_status === 'paid') {
        updateOrganization(orgId, {
          status: 'active',
          subscriptionStatus: org.subscriptionStatus || 'active',
        });
        await stampCrmPaidForOrg(orgId, `Checkout completed ${session.id}`);
      }
      break;
    }
    default:
      break;
  }
}

export function computeMrrForPlan(plan: OrgPlan): number {
  return PLAN_CONFIG[plan].monthlyPriceGbp;
}
