/**
 * Public Sync2Dine SaaS contract signing and self-serve checkout.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import {
  assertContractSignedForCheckout,
  createSaasContract,
  getSaasContractById,
  signSaasContract,
} from './saas-contracts';
import { createOrganization } from './organizations';
import { isSaasPackageId, judieTierToOrgPlan, getPackage } from './saas-packages';
import { isLaunchOfferActive } from './sally-offer-store';
import { resolvePackageLine } from './saas-products';
import type { OverageAction } from './saas-packages';

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

type CheckoutBody = {
  packageId?: string;
  interval?: string;
  additionalSites?: number;
  overageAction?: OverageAction;
  venueName?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  termsAccepted?: boolean;
  fairUseAccepted?: boolean;
  privacyAccepted?: boolean;
  marketingConsent?: boolean;
  signatureName?: string;
  contractId?: string;
  token?: string;
};

function orgPlanForPackage(packageId: string): 'starter' | 'pro' | 'enterprise' {
  if (!isSaasPackageId(packageId)) return 'starter';
  return judieTierToOrgPlan(getPackage(packageId).judieTier);
}

export async function handleSaasContractRoutes(
  req: IncomingMessage,
  res: ServerResponse,
  pathname: string,
): Promise<boolean> {
  if (pathname === '/api/public/saas-contract/sign' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
      const id = String(body.id || body.contractId || '').trim();
      const token = String(body.token || '').trim();
      const signatureName = String(body.signatureName || '').trim();
      const consents = body.consents as Record<string, boolean> | undefined;

      if (!id || !token || !signatureName) {
        sendJson(res, 400, { error: 'id, token, and signatureName required' });
        return true;
      }

      const contract = signSaasContract({
        id,
        token,
        signatureName,
        consents: {
          terms: Boolean(consents?.terms ?? body.termsAccepted),
          fairUse: Boolean(consents?.fairUse ?? body.fairUseAccepted),
          privacy: Boolean(consents?.privacy ?? body.privacyAccepted),
          acceptableUse: Boolean(consents?.acceptableUse ?? body.termsAccepted),
          marketing: Boolean(consents?.marketing ?? body.marketingConsent),
        },
      });

      sendJson(res, 200, { ok: true, contract: { id: contract.id, status: contract.status } });
    } catch (err) {
      sendJson(res, 400, { error: err instanceof Error ? err.message : 'Sign failed' });
    }
    return true;
  }

  if (pathname === '/api/public/checkout' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const body = raw ? (JSON.parse(raw) as CheckoutBody) : {};

      const packageId = String(body.packageId || '').trim();
      if (!isSaasPackageId(packageId)) {
        sendJson(res, 400, { error: 'Valid packageId required' });
        return true;
      }

      const restaurantName = String(body.venueName || '').trim();
      const contactName = String(body.contactName || '').trim();
      const contactEmail = String(body.email || '').trim().toLowerCase();
      const signatureName = String(body.signatureName || '').trim();

      if (!restaurantName || !contactName || !contactEmail || !signatureName) {
        sendJson(res, 400, { error: 'venueName, contactName, email, and signatureName required' });
        return true;
      }
      if (!body.termsAccepted || !body.fairUseAccepted || !body.privacyAccepted) {
        sendJson(res, 400, { error: 'Required legal consents missing' });
        return true;
      }

      const billingInterval = body.interval === 'annual' ? 'annual' : 'weekly';
      const additionalSites = Math.max(0, Math.floor(Number(body.additionalSites) || 0));
      const overageAction = (body.overageAction || 'continue_bill') as OverageAction;
      const plan = orgPlanForPackage(packageId);

      const org = createOrganization({
        name: restaurantName,
        contactName,
        contactEmail,
        contactPhone: String(body.phone || '').trim(),
        address: String(body.address || '').trim(),
        plan,
        status: 'trial',
        notes: `Self-serve checkout · package ${packageId} · ${billingInterval}`,
      });

      let contract = createSaasContract({
        packageId,
        billingInterval,
        additionalSites,
        overageAction,
        organizationId: org.id,
        restaurantName,
        contactName,
        contactEmail,
        contactPhone: String(body.phone || '').trim(),
        address: String(body.address || '').trim(),
        createdBy: 'public_checkout',
      });

      contract = signSaasContract({
        id: contract.id,
        token: contract.signingToken,
        signatureName,
        consents: {
          terms: true,
          fairUse: true,
          privacy: true,
          acceptableUse: true,
          marketing: Boolean(body.marketingConsent),
        },
      });

      assertContractSignedForCheckout({ contractId: contract.id });

      const useLaunch = isLaunchOfferActive() && contract.useLaunch;
      const lineItems = resolvePackageLine(contract.packageId, {
        interval: contract.billingInterval,
        useLaunch,
        additionalSites: contract.additionalSites,
      })
        .map((l) => ({
          description: l.description,
          unitAmountGbp: l.rate,
          quantity: l.quantity,
          recurring: l.category !== 'extra',
          interval: (l.unit === 'year' ? 'year' : 'week') as 'week' | 'year',
        }))
        .filter((l) => l.unitAmountGbp > 0);

      const { createCheckoutSessionForOrg } = await import('./stripe-service');
      const checkoutUrl = await createCheckoutSessionForOrg(org.id, {
        metadata: {
          contractId: contract.id,
          packageId: contract.packageId,
          billingInterval: contract.billingInterval,
          source: 'public_checkout',
        },
        lineItems,
      });

      sendJson(res, 200, {
        ok: true,
        checkoutUrl,
        contractId: contract.id,
        organizationId: org.id,
        message: 'Contract signed — redirecting to payment',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Checkout failed';
      if (message.includes('Stripe') || message.includes('STRIPE')) {
        sendJson(res, 503, {
          error: message,
          message:
            'Contract signed. Payment checkout is not configured yet — our team will follow up using your contact details.',
        });
        return true;
      }
      sendJson(res, 400, { error: message });
    }
    return true;
  }

  if (pathname.startsWith('/api/public/saas-contract/') && req.method === 'GET') {
    const id = pathname.replace('/api/public/saas-contract/', '').split('/')[0];
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const token = url.searchParams.get('token') || '';
    const contract = getSaasContractById(id);
    if (!contract || (token && contract.signingToken !== token)) {
      sendJson(res, 404, { error: 'Contract not found' });
      return true;
    }
    sendJson(res, 200, {
      contract: {
        id: contract.id,
        status: contract.status,
        packageId: contract.packageId,
        billingInterval: contract.billingInterval,
        amountGbp: contract.amountGbp,
        weeklyGbp: contract.weeklyGbp,
        standardWeeklyGbp: contract.standardWeeklyGbp,
        fareSummary: contract.fareSummary,
        restaurantName: contract.restaurantName,
        contactName: contract.contactName,
      },
    });
    return true;
  }

  return false;
}
