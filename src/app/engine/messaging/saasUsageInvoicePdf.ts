import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from 'pdf-lib';
import type { DocumentAttachment } from './types';
import type { SaasUsageInvoiceContent } from './saasUsageInvoiceContent';

const A4: [number, number] = [595.28, 841.89];
const C = {
  teal: rgb(15 / 255, 61 / 255, 62 / 255),
  tealDeep: rgb(16 / 255, 47 / 255, 48 / 255),
  tealSoft: rgb(22 / 255, 73 / 255, 74 / 255),
  cream: rgb(246 / 255, 239 / 255, 224 / 255),
  creamBright: rgb(1, 248 / 255, 223 / 255),
  gold: rgb(232 / 255, 194 / 255, 106 / 255),
  goldSoft: rgb(243 / 255, 221 / 255, 164 / 255),
  ink: rgb(11 / 255, 34 / 255, 35 / 255),
  muted: rgb(83 / 255, 101 / 255, 99 / 255),
  white: rgb(1, 1, 1),
};

type Fonts = { regular: PDFFont; bold: PDFFont };

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]!);
  }
  return btoa(binary);
}

function safeText(value: string): string {
  return value
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\u00a0/g, ' ');
}

function money(value: number): string {
  return `£${value.toLocaleString('en-GB', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) line = candidate;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** One-page branded usage invoice PDF (sell lines only). */
export async function generateSaasUsageInvoicePdf(
  content: SaasUsageInvoiceContent,
): Promise<DocumentAttachment> {
  const doc = await PDFDocument.create();
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const page = doc.addPage(A4);
  drawInvoicePage(page, fonts, content);
  const bytes = await doc.save();
  return {
    filename: `Sync2Dine-usage-invoice-${content.invoice.isoWeek}.pdf`,
    mimeType: 'application/pdf',
    content: toBase64(bytes),
  };
}

function drawInvoicePage(page: PDFPage, fonts: Fonts, content: SaasUsageInvoiceContent): void {
  const [width, height] = A4;
  page.drawRectangle({ x: 0, y: 0, width, height, color: C.cream });
  page.drawRectangle({ x: 0, y: height - 72, width, height: 72, color: C.tealDeep });
  page.drawText('Sync2Dine', {
    x: 44,
    y: height - 44,
    font: fonts.bold,
    size: 20,
    color: C.creamBright,
  });
  page.drawText(`INVOICE  ${safeText(content.invoice.reference)}`, {
    x: width - 260,
    y: height - 42,
    font: fonts.bold,
    size: 10,
    color: C.goldSoft,
  });

  let y = height - 110;
  page.drawText('WEEKLY USAGE INVOICE', {
    x: 44,
    y,
    font: fonts.bold,
    size: 9,
    color: C.tealSoft,
  });
  y -= 22;
  page.drawText(safeText(content.plan.packageName), {
    x: 44,
    y,
    font: fonts.bold,
    size: 22,
    color: C.teal,
  });
  y -= 18;
  const billTo = content.customer.venueName || content.customer.name;
  page.drawText(safeText(`Bill to: ${billTo}`), {
    x: 44,
    y,
    font: fonts.regular,
    size: 11,
    color: C.ink,
  });
  y -= 14;
  page.drawText(safeText(`Period: ${content.invoice.periodLabel}`), {
    x: 44,
    y,
    font: fonts.regular,
    size: 10,
    color: C.muted,
  });

  y -= 28;
  page.drawRectangle({ x: 44, y: y - 8, width: width - 88, height: 54, color: C.teal });
  page.drawText(content.invoice.status === 'paid' ? 'PAID' : 'AMOUNT DUE', {
    x: 60,
    y: y + 28,
    font: fonts.bold,
    size: 9,
    color: C.goldSoft,
  });
  page.drawText(money(content.amountGbp), {
    x: 60,
    y: y + 6,
    font: fonts.bold,
    size: 24,
    color: C.white,
  });
  page.drawText(`Issued ${safeText(content.invoice.issuedDate)}`, {
    x: width - 200,
    y: y + 18,
    font: fonts.regular,
    size: 10,
    color: C.cream,
  });

  y -= 40;
  page.drawText('Usage this week', {
    x: 44,
    y,
    font: fonts.bold,
    size: 13,
    color: C.tealDeep,
  });
  y -= 18;
  for (const row of content.usageSummary) {
    page.drawText(safeText(row.label), { x: 44, y, font: fonts.regular, size: 10, color: C.ink });
    page.drawText(`${row.used} / ${row.included} ${row.unit}`, {
      x: width - 180,
      y,
      font: fonts.bold,
      size: 10,
      color: C.teal,
    });
    y -= 16;
  }

  y -= 12;
  page.drawText('Charges', {
    x: 44,
    y,
    font: fonts.bold,
    size: 13,
    color: C.tealDeep,
  });
  y -= 8;
  page.drawLine({
    start: { x: 44, y },
    end: { x: width - 44, y },
    thickness: 0.8,
    color: C.gold,
  });
  y -= 18;

  if (!content.lines.length) {
    page.drawText('No overage charges this week.', {
      x: 44,
      y,
      font: fonts.regular,
      size: 10,
      color: C.muted,
    });
    y -= 16;
  } else {
    for (const line of content.lines) {
      const descLines = wrapText(line.description, fonts.regular, 9.5, width - 180);
      for (let i = 0; i < descLines.length; i += 1) {
        page.drawText(descLines[i]!, {
          x: 44,
          y,
          font: fonts.regular,
          size: 9.5,
          color: C.ink,
        });
        if (i === 0) {
          page.drawText(money(line.amountGbp), {
            x: width - 110,
            y,
            font: fonts.bold,
            size: 10,
            color: C.teal,
          });
        }
        y -= 13;
      }
      y -= 6;
      if (y < 120) break;
    }
  }

  y -= 10;
  const noteLines = wrapText(content.paymentNote, fonts.regular, 9.5, width - 88);
  for (const note of noteLines) {
    page.drawText(note, { x: 44, y, font: fonts.regular, size: 9.5, color: C.muted });
    y -= 13;
  }

  page.drawLine({
    start: { x: 44, y: 46 },
    end: { x: width - 44, y: 46 },
    thickness: 0.6,
    color: C.gold,
  });
  const { contact } = content.brand;
  page.drawText(`${contact.website}  |  ${contact.phone}  |  ${contact.email}`, {
    x: 44,
    y: 28,
    font: fonts.regular,
    size: 8.2,
    color: C.muted,
  });
}
