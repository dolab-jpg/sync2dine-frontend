import { PDFDocument, StandardFonts, rgb, type PDFImage, type PDFPage } from 'pdf-lib';
import type { DocumentAttachment } from './types';
import { getCompanyProfile, type CompanyProfileValues } from '../integrations/companyProfileSync';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

async function embedLogo(doc: PDFDocument, logoUrl: string): Promise<PDFImage | null> {
  if (!logoUrl.trim()) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const lower = logoUrl.toLowerCase();
    if (lower.includes('.png') || res.headers.get('content-type')?.includes('png')) {
      return doc.embedPng(bytes);
    }
    return doc.embedJpg(bytes);
  } catch {
    return null;
  }
}

function legalFooterLines(company: CompanyProfileValues): string[] {
  const lines: string[] = [];
  if (company.website?.trim()) lines.push(company.website.trim());
  if (company.companyRegistrationNumber?.trim()) {
    lines.push(`Company reg. no. ${company.companyRegistrationNumber.trim()}`);
  }
  if (company.vatNumber?.trim()) lines.push(`VAT no. ${company.vatNumber.trim()}`);
  return lines;
}

function paymentLines(company: CompanyProfileValues): string[] {
  if (!company.sortCode?.trim() && !company.accountNumber?.trim()) return [];
  const lines: string[] = [];
  if (company.accountName?.trim()) lines.push(`Account name: ${company.accountName.trim()}`);
  if (company.sortCode?.trim()) lines.push(`Sort code: ${company.sortCode.trim()}`);
  if (company.accountNumber?.trim()) lines.push(`Account number: ${company.accountNumber.trim()}`);
  return lines;
}

interface BuildPdfOptions {
  title: string;
  sections: Array<{ heading: string; lines: string[] }>;
  includePaymentDetails?: boolean;
}

async function buildPdfDocument(options: BuildPdfOptions): Promise<Uint8Array> {
  const { title, sections, includePaymentDetails } = options;
  const company = getCompanyProfile();
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 48;
  const bottomMargin = 72;
  const topContent = pageHeight - 48;

  let page = doc.addPage([pageWidth, pageHeight]);
  let y = topContent;

  const logo = company.logoUrl ? await embedLogo(doc, company.logoUrl) : null;
  const logoWidth = 72;
  const logoHeight = logo ? (logo.height / logo.width) * logoWidth : 0;
  const headerRight = pageWidth - marginX;

  const ensureSpace = (needed: number) => {
    if (y - needed < bottomMargin) {
      drawLegalFooter(page, font, company, marginX);
      page = doc.addPage([pageWidth, pageHeight]);
      y = topContent;
      page.drawText(company.companyName?.trim() || 'Builder Diddies', {
        x: marginX,
        y,
        size: 10,
        font: bold,
        color: rgb(0.35, 0.35, 0.4),
      });
      y -= 18;
      page.drawText(title, { x: marginX, y, size: 12, font: bold, color: rgb(0.1, 0.1, 0.2) });
      y -= 20;
    }
  };

  if (logo) {
    page.drawImage(logo, {
      x: headerRight - logoWidth,
      y: y - logoHeight + 8,
      width: logoWidth,
      height: logoHeight,
    });
  }

  const companyName = company.companyName?.trim() || 'Builder Diddies';
  page.drawText(companyName, { x: marginX, y, size: 14, font: bold, color: rgb(0.1, 0.1, 0.2) });
  y -= 16;

  const headerLines = [company.address, company.phone, company.email, company.website].filter((l) => l?.trim());
  for (const line of headerLines) {
    ensureSpace(14);
    page.drawText(line!.trim(), { x: marginX, y, size: 9, font, color: rgb(0.35, 0.35, 0.4) });
    y -= 12;
  }

  y -= 8;
  page.drawLine({
    start: { x: marginX, y },
    end: { x: pageWidth - marginX, y },
    thickness: 0.5,
    color: rgb(0.85, 0.85, 0.88),
  });
  y -= 22;

  page.drawText(title, { x: marginX, y, size: 18, font: bold, color: rgb(0.1, 0.1, 0.2) });
  y -= 22;
  page.drawText(`Generated: ${new Date().toLocaleString('en-GB')}`, {
    x: marginX,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.45),
  });
  y -= 24;

  const allSections = [...sections];
  if (includePaymentDetails) {
    const pay = paymentLines(company);
    if (pay.length) allSections.push({ heading: 'Payment Details', lines: pay });
  }

  for (const section of allSections) {
    ensureSpace(30);
    page.drawText(section.heading, { x: marginX, y, size: 12, font: bold, color: rgb(0.15, 0.35, 0.55) });
    y -= 16;
    for (const line of section.lines) {
      if (!line) continue;
      // Soft wrap long lines for pdf-lib (no native wrap)
      const chunks: string[] = [];
      const maxChars = 90;
      let rest = line;
      while (rest.length > maxChars) {
        let breakAt = rest.lastIndexOf(' ', maxChars);
        if (breakAt < 40) breakAt = maxChars;
        chunks.push(rest.slice(0, breakAt));
        rest = rest.slice(breakAt).trimStart();
      }
      if (rest) chunks.push(rest);
      for (const chunk of chunks) {
        ensureSpace(16);
        page.drawText(chunk, { x: 56, y, size: 10, font, color: rgb(0.15, 0.15, 0.2) });
        y -= 14;
      }
    }
    y -= 10;
  }

  drawLegalFooter(page, font, company, marginX);

  return doc.save();
}

function drawLegalFooter(
  page: PDFPage,
  font: Awaited<ReturnType<PDFDocument['embedFont']>>,
  company: CompanyProfileValues,
  x: number
): void {
  const lines = legalFooterLines(company);
  if (!lines.length) return;
  let y = 52;
  for (const line of lines) {
    page.drawText(line, { x, y, size: 8, font, color: rgb(0.45, 0.45, 0.5) });
    y += 11;
  }
}

export async function generateQuotePdf(
  customerName: string,
  total: number,
  tradeName?: string,
  lineItems?: Array<{ description: string; amount: number }>
): Promise<DocumentAttachment> {
  const items = lineItems?.length
    ? lineItems.map((i) => `${i.description}: £${i.amount.toFixed(2)}`)
    : [`Total project cost: £${total.toFixed(2)}`];
  const bytes = await buildPdfDocument({
    title: 'QUOTATION',
    sections: [
      { heading: 'Customer', lines: [customerName, `Trade: ${tradeName ?? 'General'}`] },
      { heading: 'Line Items', lines: items },
      { heading: 'Total', lines: [`£${total.toFixed(2)} (GBP)`, 'Valid for 7 days from issue date.'] },
    ],
  });
  return {
    filename: `quote-${customerName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    mimeType: 'application/pdf',
    content: toBase64(bytes),
  };
}

export async function generateQuotePdfStub(
  customerName: string,
  total: number,
  tradeName?: string,
  lineItems?: Array<{ description: string; amount: number }>
): Promise<DocumentAttachment> {
  return generateQuotePdf(customerName, total, tradeName, lineItems);
}

export async function generateInvoicePdf(
  customerName: string,
  projectName: string,
  lineItems: Array<{ description: string; amount: number }>,
  total: number,
  invoiceId: string
): Promise<DocumentAttachment> {
  const bytes = await buildPdfDocument({
    title: 'INVOICE',
    includePaymentDetails: true,
    sections: [
      { heading: 'Bill To', lines: [customerName, `Project: ${projectName}`] },
      { heading: 'Invoice', lines: [`Reference: ${invoiceId}`, `Date: ${new Date().toLocaleDateString('en-GB')}`] },
      {
        heading: 'Items',
        lines: lineItems.map((i) => `${i.description}: £${i.amount.toFixed(2)}`),
      },
      { heading: 'Amount Due', lines: [`£${total.toFixed(2)} (GBP)`, 'Payment due within 14 days.'] },
    ],
  });
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
  const bytes = await buildPdfDocument({
    title: 'PAYMENT RECEIPT',
    sections: [
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
    ],
  });
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
  const bytes = await buildPdfDocument({
    title: 'CONTRACT OF WORKS',
    sections: [
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
    ],
  });
  return {
    filename: `contract-${customerName.replace(/\s+/g, '-').toLowerCase()}.pdf`,
    mimeType: 'application/pdf',
    content: toBase64(bytes),
  };
}
