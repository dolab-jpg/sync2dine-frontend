import type { DocumentAttachment } from './types';

function toBase64(text: string): string {
  return btoa(unescape(encodeURIComponent(text)));
}

function buildDocument(
  title: string,
  sections: Array<{ heading: string; lines: string[] }>
): string {
  const body = sections
    .map(s => `${s.heading}\n${'─'.repeat(40)}\n${s.lines.join('\n')}`)
    .join('\n\n');
  return `${title}\n${'='.repeat(title.length)}\n\n${body}\n\nGenerated: ${new Date().toLocaleString('en-GB')}`;
}

export function generateQuotePdf(
  customerName: string,
  total: number,
  tradeName?: string,
  lineItems?: Array<{ description: string; amount: number }>
): DocumentAttachment {
  const items = lineItems?.length
    ? lineItems.map(i => `  ${i.description}: £${i.amount.toFixed(2)}`)
    : [`  Total project cost: £${total.toFixed(2)}`];
  const content = buildDocument('QUOTATION', [
    { heading: 'Customer', lines: [customerName, `Trade: ${tradeName ?? 'General'}`] },
    { heading: 'Line Items', lines: items },
    { heading: 'Total', lines: [`£${total.toFixed(2)} (GBP)`, 'Valid for 7 days from issue date.'] },
  ]);
  return {
    filename: `quote-${customerName.replace(/\s+/g, '-').toLowerCase()}.pdf.txt`,
    mimeType: 'application/pdf',
    content: toBase64(content),
  };
}

export function generateQuotePdfStub(
  customerName: string,
  total: number,
  tradeName?: string
): DocumentAttachment {
  return generateQuotePdf(customerName, total, tradeName);
}

export function generateInvoicePdf(
  customerName: string,
  projectName: string,
  lineItems: Array<{ description: string; amount: number }>,
  total: number,
  invoiceId: string
): DocumentAttachment {
  const content = buildDocument('INVOICE', [
    { heading: 'Bill To', lines: [customerName, `Project: ${projectName}`] },
    { heading: 'Invoice', lines: [`Reference: ${invoiceId}`, `Date: ${new Date().toLocaleDateString('en-GB')}`] },
    {
      heading: 'Items',
      lines: lineItems.map(i => `${i.description}: £${i.amount.toFixed(2)}`),
    },
    { heading: 'Amount Due', lines: [`£${total.toFixed(2)} (GBP)`, 'Payment due within 14 days.'] },
  ]);
  return {
    filename: `invoice-${invoiceId}.pdf.txt`,
    mimeType: 'application/pdf',
    content: toBase64(content),
  };
}

export function generateContractPdf(
  customerName: string,
  projectName: string,
  terms: string,
  total: number
): DocumentAttachment {
  const content = buildDocument('CONTRACT OF WORKS', [
    { heading: 'Parties', lines: [`Customer: ${customerName}`, `Project: ${projectName}`, `Agreed value: £${total.toFixed(2)} (GBP)`] },
    { heading: 'Terms and Conditions', lines: terms.split('\n').filter(Boolean) },
    { heading: 'Standard Clauses', lines: [
      'Subject to site inspection during strip-out.',
      'Variations require written change order approval.',
      '14-day cooling-off period applies where applicable under UK consumer law.',
      'Customer to provide clear access on agreed working days.',
    ]},
  ]);
  return {
    filename: `contract-${customerName.replace(/\s+/g, '-').toLowerCase()}.pdf.txt`,
    mimeType: 'application/pdf',
    content: toBase64(content),
  };
}
