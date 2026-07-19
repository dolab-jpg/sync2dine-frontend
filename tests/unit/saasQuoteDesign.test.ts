import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFString } from 'pdf-lib';
import { buildSaasQuoteContent } from '../../src/app/engine/messaging/saasQuoteContent';
import { buildSaasQuoteEmail } from '../../src/app/engine/messaging/saasQuoteEmail';
import { generateSaasQuotePdf } from '../../src/app/engine/messaging/saasQuotePdf';

const CHECKOUT_URL = 'https://checkout.stripe.com/c/pay/test_sync2dine';

function completeProContent() {
  return buildSaasQuoteContent(
    {
      id: 'Q-S2D-1042',
      customerName: 'The Harbour Kitchen',
      createdAt: '2026-07-19T10:00:00.000Z',
      expiresAt: '2026-08-18T10:00:00.000Z',
      total: 323,
      wizardAnswers: {
        saas: true,
        packageId: 'combined_pro',
        billingInterval: 'weekly',
        launchActive: true,
      },
    },
    { checkoutUrl: CHECKOUT_URL },
  );
}

describe('SaaS quote content', () => {
  it('uses dynamic quote values and Complete Pro catalog facts', () => {
    const content = completeProContent();

    expect(content.customer.name).toBe('The Harbour Kitchen');
    expect(content.plan.name).toBe('Complete Pro');
    expect(content.plan.amountGbp).toBe(323);
    expect(content.plan.billingInterval).toBe('weekly');
    expect(content.quote.expiryDate).toBe('18/08/2026');
    expect(content.quote.checkoutUrl).toBe(CHECKOUT_URL);
    expect(content.inclusions).toContain('420 Judie AI minutes each week');
    expect(content.inclusions).toContain('60 outbound minutes each week');
    expect(content.inclusions).toContain('Atmosphere venue audio and promotional messaging');
    expect(content.fares).toContainEqual({
      label: 'Judie AI overage',
      value: '£0.30 per minute',
    });
    expect(content.brand.contact).toEqual({
      website: 'sync2dine.io',
      phone: '020 3745 3233',
      phoneTel: '+442037453233',
      email: 'info@sync2dine.io',
      sellerName: 'Sally',
      sellerTitle: 'Sync2Dine sales',
    });
  });

  it('shares checkout and package values with branded email output', () => {
    const email = buildSaasQuoteEmail(completeProContent());

    expect(email.subject).toContain('Complete Pro');
    expect(email.html).toContain('Pay securely with Stripe');
    expect(email.html).toContain(CHECKOUT_URL);
    expect(email.text).toContain(CHECKOUT_URL);
    expect(email.text).toContain('020 3745 3233');
  });

  it('includes Sally seller details and a click-to-call tel CTA', () => {
    const email = buildSaasQuoteEmail(completeProContent());

    expect(email.html).toContain('Your Sync2Dine contact');
    expect(email.html).toContain('Sally');
    expect(email.html).toContain('href="tel:+442037453233"');
    expect(email.html).toContain('Call Sally now');
    expect(email.html).toContain('020 3745 3233');
    expect(email.text).toContain('Your Sync2Dine contact: Sally');
    expect(email.text).toContain('tel:+442037453233');
  });
});

describe('SaaS quote PDF', () => {
  it('creates exactly two A4 pages with Stripe and tel URI annotations', async () => {
    const photoBytes = new Uint8Array(
      readFileSync(resolve(process.cwd(), 'public/quote-assets/sync2dine-phone-agent.jpg')),
    );
    const generated = await generateSaasQuotePdf(completeProContent(), { photoBytes });
    const bytes = Uint8Array.from(atob(generated.content), (character) => character.charCodeAt(0));
    const pdf = await PDFDocument.load(bytes);

    expect(generated.mimeType).toBe('application/pdf');
    expect(pdf.getPageCount()).toBe(2);
    for (const page of pdf.getPages()) {
      expect(page.getWidth()).toBeCloseTo(595.28, 1);
      expect(page.getHeight()).toBeCloseTo(841.89, 1);
    }

    const uris: string[] = [];
    for (const page of pdf.getPages()) {
      const annots = page.node.lookup(PDFName.of('Annots'), PDFArray);
      for (let index = 0; index < annots.size(); index += 1) {
        const annotation = pdf.context.lookup(annots.get(index), PDFDict);
        const action = annotation.lookup(PDFName.of('A'), PDFDict);
        const uri = action.lookup(PDFName.of('URI'), PDFString);
        uris.push(uri.decodeText());
      }
    }
    expect(uris).toContain(CHECKOUT_URL);
    expect(uris.some((uri) => uri === 'tel:+442037453233')).toBe(true);
  });
});
