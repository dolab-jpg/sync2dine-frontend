import { getActiveOrgId, getSupabaseAccessToken } from '../platform/orgContext';
import { getHomeOrgId } from '../platform/homeOrg';
import type { Quote } from '../../App';

export type QuoteCheckoutLink = {
  quoteId: string;
  checkoutUrl: string;
  expiresAt: string;
};

export async function createQuoteCheckoutLink(quote: Quote): Promise<QuoteCheckoutLink> {
  const quoteId = quote.id;
  const token = await getSupabaseAccessToken();
  if (!token) throw new Error('Sign in again before creating a payment link');
  const orgId = getActiveOrgId() ?? getHomeOrgId();
  const response = await fetch(`/api/quotes/${encodeURIComponent(quoteId)}/checkout-link`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'X-Org-Id': orgId,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ quote }),
  });
  const payload = await response.json().catch(() => ({})) as Partial<QuoteCheckoutLink> & { error?: string };
  if (!response.ok || !payload.checkoutUrl) {
    throw new Error(payload.error || 'Could not create secure Stripe payment link');
  }
  return payload as QuoteCheckoutLink;
}
