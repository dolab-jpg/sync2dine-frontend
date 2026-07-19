import type { Quote, QuoteLine } from '../../App';
import { migrateQuoteToLines } from '../quotes/quoteLineUtils';
import { generateQuotePdf } from './pdfGenerator';
import type { DocumentAttachment } from './types';
import { persistGeneratedPdf } from './documentPersist';
import { buildSaasQuoteContent } from './saasQuoteContent';
import { generateSaasQuotePdf } from './saasQuotePdf';

export function quoteLinesToPdfItems(
  lines: QuoteLine[]
): Array<{ description: string; amount: number }> {
  return lines
    .filter((l) => l.description.trim())
    .map((l) => ({
      description:
        l.quantity && l.unit && l.unit !== 'fixed'
          ? `${l.description} (${l.quantity} ${l.unit})`
          : l.description,
      amount: Number.isFinite(l.total) ? l.total : l.quantity * l.rate,
    }));
}

export function quoteToPdfLineItems(quote: Pick<Quote, 'lines' | 'items' | 'labour' | 'extras'>): Array<{
  description: string;
  amount: number;
}> {
  return quoteLinesToPdfItems(migrateQuoteToLines(quote as Quote));
}

/** Build a branded quote PDF with full line items (not totals-only). */
export async function buildQuotePdfAttachment(
  quote: Pick<
    Quote,
    | 'id'
    | 'customerName'
    | 'createdAt'
    | 'expiresAt'
    | 'total'
    | 'tradeName'
    | 'lines'
    | 'items'
    | 'labour'
    | 'extras'
    | 'projectId'
    | 'wizardAnswers'
    | 'checkoutLandingUrl'
  >,
  options: { checkoutUrl?: string } = {},
): Promise<DocumentAttachment> {
  const isSaas = quote.wizardAnswers?.saas === true || quote.tradeName === 'Sync2Dine SaaS';
  if (isSaas) {
    const content = buildSaasQuoteContent(quote, {
      checkoutUrl: options.checkoutUrl ?? quote.checkoutLandingUrl,
    });
    const pdf = await generateSaasQuotePdf(content);
    return persistGeneratedPdf(pdf, {
      projectId: quote.projectId,
      uploadedBy: 'saas-quote-pdf',
    });
  }

  const lineItems = quoteToPdfLineItems(quote);
  const pdf = await generateQuotePdf(
    quote.customerName,
    quote.total,
    quote.tradeName,
    lineItems.length ? lineItems : undefined
  );
  return persistGeneratedPdf(pdf, {
    projectId: quote.projectId,
    uploadedBy: 'quote-pdf',
  });
}
