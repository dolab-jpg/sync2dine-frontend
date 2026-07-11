import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { DocumentAttachment } from './types';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function buildPdfDocument(
  title: string,
  sections: Array<{ heading: string; lines: string[] }>
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  const { height } = page.getSize();
  let y = height - 56;

  page.drawText(title, { x: 48, y, size: 20, font: bold, color: rgb(0.1, 0.1, 0.2) });
  y -= 28;
  page.drawText(`Generated: ${new Date().toLocaleString('en-GB')}`, {
    x: 48,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.45),
  });
  y -= 24;

  for (const section of sections) {
    if (y < 80) break;
    page.drawText(section.heading, { x: 48, y, size: 12, font: bold, color: rgb(0.15, 0.35, 0.55) });
    y -= 16;
    for (const line of section.lines) {
      if (y < 56) break;
      page.drawText(line, { x: 56, y, size: 10, font, color: rgb(0.15, 0.15, 0.2) });
      y -= 14;
    }
    y -= 10;
  }

  return doc.save();
}

export async function generateQuotePdf(
  customerName: string,
  total: number,
  tradeName?: string,
  lineItems?: Array<{ description: string; amount: number }>
): Promise<DocumentAttachment> {
  const items = lineItems?.length
    ? lineItems.map((i) => `  ${i.description}: £${i.amount.toFixed(2)}`)
    : [`  Total project cost: £${total.toFixed(2)}`];
  const bytes = await buildPdfDocument('QUOTATION', [
    { heading: 'Customer', lines: [customerName, `Trade: ${tradeName ?? 'General'}`] },
    { heading: 'Line Items', lines: items },
    { heading: 'Total', lines: [`£${total.toFixed(2)} (GBP)`, 'Valid for 7 days from issue date.'] },
  ]);
  return {
    filename: `quote-${customerName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    mimeType: 'application/pdf',
    content: toBase64(bytes),
  };
}

export async function generateQuotePdfStub(
  customerName: string,
  total: number,
  tradeName?: string
): Promise<DocumentAttachment> {
  return generateQuotePdf(customerName, total, tradeName);
}

export async function generateInvoicePdf(
  customerName: string,
  projectName: string,
  lineItems: Array<{ description: string; amount: number }>,
  total: number,
  invoiceId: string
): Promise<DocumentAttachment> {
  const bytes = await buildPdfDocument('INVOICE', [
    { heading: 'Bill To', lines: [customerName, `Project: ${projectName}`] },
    { heading: 'Invoice', lines: [`Reference: ${invoiceId}`, `Date: ${new Date().toLocaleDateString('en-GB')}`] },
    {
      heading: 'Items',
      lines: lineItems.map((i) => `${i.description}: £${i.amount.toFixed(2)}`),
    },
    { heading: 'Amount Due', lines: [`£${total.toFixed(2)} (GBP)`, 'Payment due within 14 days.'] },
  ]);
  return {
    filename: `invoice-${invoiceId}.pdf`,
    mimeType: 'application/pdf',
    content: toBase64(bytes),
  };
}

export async function generateReceiptPdf(
  customerName: string,
  projectName: string,
  amount: number,
  stageName?: string,
  receiptId?: string
): Promise<DocumentAttachment> {
  const ref = receiptId ?? `RCP-${Date.now()}`;
  const bytes = await buildPdfDocument('PAYMENT RECEIPT', [
    { heading: 'Received From', lines: [customerName] },
    {
      heading: 'Payment Details',
      lines: [
        `Project: ${projectName}`,
        stageName ? `Stage: ${stageName}` : '',
        `Amount: £${amount.toFixed(2)} (GBP)`,
        `Date: ${new Date().toLocaleDateString('en-GB')}`,
        `Reference: ${ref}`,
      ].filter(Boolean),
    },
    { heading: 'Confirmation', lines: ['Thank you for your payment. Please retain this receipt for your records.'] },
  ]);
  return {
    filename: `receipt-${ref}.pdf`,
    mimeType: 'application/pdf',
    content: toBase64(bytes),
  };
}

export async function generateContractPdf(
  customerName: string,
  projectName: string,
  terms: string,
  total: number
): Promise<DocumentAttachment> {
  const bytes = await buildPdfDocument('CONTRACT OF WORKS', [
    { heading: 'Parties', lines: [`Customer: ${customerName}`, `Project: ${projectName}`, `Agreed value: £${total.toFixed(2)} (GBP)`] },
    { heading: 'Terms and Conditions', lines: terms.split('\n').filter(Boolean) },
    {
      heading: 'Standard Clauses',
      lines: [
        'Subject to site inspection during strip-out.',
        'Variations require written change order approval.',
        '14-day cooling-off period applies where applicable under UK consumer law.',
        'Customer to provide clear access on agreed working days.',
      ],
    },
  ]);
  return {
    filename: `contract-${customerName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    mimeType: 'application/pdf',
    content: toBase64(bytes),
  };
}
