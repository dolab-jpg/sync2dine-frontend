import {
  PDFArray,
  PDFDocument,
  PDFName,
  PDFString,
  StandardFonts,
  clip,
  endPath,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  type PDFFont,
  type PDFImage,
  type PDFPage,
} from 'pdf-lib';
import type { DocumentAttachment } from './types';
import type { SaasQuoteContent } from './saasQuoteContent';

const A4: [number, number] = [595.28, 841.89];
const PHOTO_URL = '/quote-assets/sync2dine-phone-agent.jpg';
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

export type SaasQuotePdfOptions = {
  /** Overrides the tracked public portrait, useful for tests or alternate hosting. */
  photoUrl?: string;
  /** Bypasses fetch when the caller already has the JPEG bytes. */
  photoBytes?: Uint8Array;
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
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

function wrapText(text: string, font: PDFFont, size: number, width: number): string[] {
  const words = safeText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= width || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawParagraph(
  page: PDFPage,
  text: string,
  options: {
    x: number;
    y: number;
    width: number;
    font: PDFFont;
    size: number;
    lineHeight: number;
    color?: ReturnType<typeof rgb>;
    maxLines?: number;
  },
): number {
  const lines = wrapText(text, options.font, options.size, options.width).slice(0, options.maxLines);
  let y = options.y;
  for (const line of lines) {
    page.drawText(line, {
      x: options.x,
      y,
      font: options.font,
      size: options.size,
      color: options.color ?? C.ink,
    });
    y -= options.lineHeight;
  }
  return y;
}

/** Matches public/brand/brand-icon.svg geometry (rounded teal tile + gold arcs). */
function drawBrand(page: PDFPage, fonts: Fonts, x = 44, y = 786, inverse = false): void {
  const tile = inverse ? C.gold : C.teal;
  const arc = inverse ? C.tealDeep : C.gold;
  const arcSoft = inverse ? C.teal : C.creamBright;
  page.drawRectangle({ x, y: y - 5, width: 34, height: 34, color: tile });
  // Upper soft arc
  page.drawLine({
    start: { x: x + 8, y: y + 14 },
    end: { x: x + 26, y: y + 14 },
    thickness: 2.5,
    color: arcSoft,
  });
  // Lower gold arc
  page.drawLine({
    start: { x: x + 7, y: y + 8 },
    end: { x: x + 27, y: y + 8 },
    thickness: 3,
    color: arc,
  });
  page.drawCircle({ x: x + 17, y: y + 4, size: 2.8, color: arc });
  page.drawText('Sync2Dine', {
    x: x + 44,
    y: y + 8,
    font: fonts.bold,
    size: 17,
    color: inverse ? C.creamBright : C.teal,
  });
}

function drawFooter(
  doc: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  pageNumber: number,
  content: SaasQuoteContent,
): void {
  const { contact } = content.brand;
  page.drawLine({
    start: { x: 44, y: 46 },
    end: { x: A4[0] - 44, y: 46 },
    thickness: 0.6,
    color: C.gold,
  });
  const footerLeft = `${contact.sellerName} · ${contact.website}  |  ${contact.phone}  |  ${contact.email}`;
  page.drawText(footerLeft, {
    x: 44,
    y: 28,
    font: fonts.regular,
    size: 8.2,
    color: C.muted,
  });
  // Phone span in the footer is clickable (approx position after "Sally · sync2dine.io  |  ").
  const phonePrefix = `${contact.sellerName} · ${contact.website}  |  `;
  const phoneX = 44 + fonts.regular.widthOfTextAtSize(phonePrefix, 8.2);
  const phoneW = fonts.regular.widthOfTextAtSize(contact.phone, 8.2);
  addUriAnnotation(doc, page, `tel:${contact.phoneTel}`, phoneX, 24, phoneW + 4, 14);
  page.drawText(`${pageNumber} / 2`, {
    x: A4[0] - 65,
    y: 28,
    font: fonts.bold,
    size: 8.2,
    color: C.teal,
  });
}

function drawSellerContactBand(
  doc: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  content: SaasQuoteContent,
  x: number,
  y: number,
  width: number,
): void {
  const { contact } = content.brand;
  const height = 58;
  page.drawRectangle({ x, y, width, height, color: C.tealDeep });
  page.drawText('YOUR SYNC2DINE CONTACT', {
    x: x + 16,
    y: y + 40,
    font: fonts.bold,
    size: 7.5,
    color: C.goldSoft,
  });
  page.drawText(safeText(`${contact.sellerName}  ·  ${contact.sellerTitle}`), {
    x: x + 16,
    y: y + 24,
    font: fonts.bold,
    size: 11,
    color: C.white,
  });
  page.drawText(safeText(contact.phone), {
    x: x + 16,
    y: y + 8,
    font: fonts.bold,
    size: 15,
    color: C.gold,
  });
  page.drawText('UK landline · tap to call', {
    x: x + 16 + fonts.bold.widthOfTextAtSize(contact.phone, 15) + 10,
    y: y + 10,
    font: fonts.regular,
    size: 8,
    color: C.cream,
  });
  addUriAnnotation(doc, page, `tel:${contact.phoneTel}`, x + 14, y + 4, width - 28, height - 8);
}

function drawSectionLabel(page: PDFPage, fonts: Fonts, label: string, x: number, y: number): void {
  page.drawText(safeText(label.toUpperCase()), {
    x,
    y,
    font: fonts.bold,
    size: 8.5,
    color: C.tealSoft,
  });
  page.drawRectangle({ x, y: y - 7, width: 28, height: 2, color: C.gold });
}

function drawCroppedPortrait(page: PDFPage, image: PDFImage, x: number, y: number, width: number, height: number): void {
  page.pushOperators(pushGraphicsState(), rectangle(x, y, width, height), clip(), endPath());
  // Zoom and top-align: the visible source is face, headset and shoulders only.
  const drawWidth = width * 1.42;
  const drawHeight = (image.height / image.width) * drawWidth;
  page.drawImage(image, {
    x: x - (drawWidth - width) / 2,
    y: y + height - drawHeight,
    width: drawWidth,
    height: drawHeight,
  });
  page.pushOperators(popGraphicsState());
  page.drawRectangle({ x, y, width, height, borderColor: C.gold, borderWidth: 1.2 });
}

function addUriAnnotation(
  doc: PDFDocument,
  page: PDFPage,
  url: string,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const annotation = doc.context.register(
    doc.context.obj({
      Type: 'Annot',
      Subtype: 'Link',
      Rect: [x, y, x + width, y + height],
      Border: [0, 0, 0],
      A: {
        Type: 'Action',
        S: 'URI',
        URI: PDFString.of(url),
      },
    }),
  );
  const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray);
  if (annots) {
    annots.push(annotation);
  } else {
    page.node.set(PDFName.of('Annots'), doc.context.obj([annotation]));
  }
}

function drawCheckoutButton(
  doc: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  url: string,
  x: number,
  y: number,
  width: number,
  label = 'PAY SECURELY',
): void {
  page.drawRectangle({ x, y, width, height: 38, color: C.gold });
  const labelWidth = fonts.bold.widthOfTextAtSize(label, 10);
  page.drawText(label, {
    x: x + (width - labelWidth) / 2,
    y: y + 14,
    font: fonts.bold,
    size: 10,
    color: C.tealDeep,
  });
  addUriAnnotation(doc, page, url, x, y, width, 38);
}

async function embedPortrait(
  doc: PDFDocument,
  options: SaasQuotePdfOptions,
): Promise<PDFImage | undefined> {
  try {
    const bytes =
      options.photoBytes ??
      new Uint8Array(await (await fetch(options.photoUrl ?? PHOTO_URL)).arrayBuffer());
    return await doc.embedJpg(bytes);
  } catch {
    return undefined;
  }
}

function drawCover(
  doc: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  content: SaasQuoteContent,
  portrait?: PDFImage,
): void {
  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: C.creamBright });
  page.drawRectangle({ x: 0, y: 760, width: A4[0], height: 82, color: C.tealDeep });
  drawBrand(page, fonts, 44, 785, true);
  page.drawText('PROPOSAL', {
    x: 465,
    y: 797,
    font: fonts.bold,
    size: 8.5,
    color: C.goldSoft,
  });
  page.drawText(safeText(content.quote.reference), {
    x: 465,
    y: 780,
    font: fonts.regular,
    size: 8.5,
    color: C.cream,
  });

  drawSectionLabel(page, fonts, 'Prepared for', 44, 713);
  page.drawText(safeText(content.customer.venueName || content.customer.name), {
    x: 44,
    y: 678,
    font: fonts.bold,
    size: 25,
    color: C.tealDeep,
  });
  if (content.customer.venueName && content.customer.name !== content.customer.venueName) {
    page.drawText(safeText(content.customer.name), {
      x: 44,
      y: 656,
      font: fonts.regular,
      size: 10,
      color: C.muted,
    });
  }

  page.drawText(safeText(content.plan.name), {
    x: 44,
    y: 607,
    font: fonts.bold,
    size: 31,
    color: C.teal,
  });
  drawParagraph(page, content.introduction, {
    x: 44,
    y: 575,
    width: 240,
    font: fonts.regular,
    size: 11,
    lineHeight: 16,
    color: C.muted,
    maxLines: 4,
  });

  if (portrait) {
    drawCroppedPortrait(page, portrait, 324, 430, 227, 300);
  } else {
    page.drawRectangle({ x: 324, y: 430, width: 227, height: 300, color: C.teal });
    page.drawText('Hospitality, always answered.', {
      x: 347,
      y: 570,
      font: fonts.bold,
      size: 15,
      color: C.goldSoft,
    });
  }

  page.drawRectangle({ x: 44, y: 394, width: 240, height: 142, color: C.tealDeep });
  page.drawText(content.plan.billingLabel.toUpperCase(), {
    x: 64,
    y: 503,
    font: fonts.bold,
    size: 8,
    color: C.goldSoft,
  });
  page.drawText(money(content.plan.amountGbp), {
    x: 64,
    y: 458,
    font: fonts.bold,
    size: 34,
    color: C.white,
  });
  page.drawText(
    content.plan.billingInterval === 'annual' ? 'one annual payment' : 'billed weekly',
    { x: 65, y: 437, font: fonts.regular, size: 9.5, color: C.cream },
  );
  if (content.plan.additionalSites > 0) {
    page.drawText(`Includes ${content.plan.additionalSites} additional site${content.plan.additionalSites > 1 ? 's' : ''}`, {
      x: 65,
      y: 417,
      font: fonts.regular,
      size: 8.5,
      color: C.goldSoft,
    });
  }

  drawSectionLabel(page, fonts, 'Why this works', 44, 345);
  const benefitPositions = [
    { x: 44, y: 307 },
    { x: 304, y: 307 },
    { x: 44, y: 218 },
    { x: 304, y: 218 },
  ];
  content.benefits.forEach((benefit, index) => {
    const position = benefitPositions[index];
    if (!position) return;
    page.drawCircle({ x: position.x + 5, y: position.y + 5, size: 5, color: C.gold });
    page.drawText(safeText(benefit.title), {
      x: position.x + 19,
      y: position.y,
      font: fonts.bold,
      size: 10.5,
      color: C.tealDeep,
    });
    drawParagraph(page, benefit.detail, {
      x: position.x + 19,
      y: position.y - 18,
      width: 214,
      font: fonts.regular,
      size: 8.7,
      lineHeight: 12,
      color: C.muted,
      maxLines: 4,
    });
  });

  if (content.quote.checkoutUrl) {
    drawCheckoutButton(doc, page, fonts, content.quote.checkoutUrl, 324, 375, 227, 'VIEW & PAY SECURELY');
  }
  page.drawText(`Issued ${content.quote.issuedDate}  |  Valid until ${content.quote.expiryDate}`, {
    x: 44,
    y: 118,
    font: fonts.regular,
    size: 8.7,
    color: C.muted,
  });
  drawSellerContactBand(doc, page, fonts, content, 44, 54, A4[0] - 88);
  drawFooter(doc, page, fonts, 1, content);
}

function drawList(
  page: PDFPage,
  fonts: Fonts,
  items: string[],
  x: number,
  startY: number,
  width: number,
  maxLinesPerItem = 3,
): number {
  let y = startY;
  for (const item of items) {
    page.drawCircle({ x: x + 4, y: y + 3.5, size: 3.5, color: C.gold });
    y = drawParagraph(page, item, {
      x: x + 16,
      y,
      width: width - 16,
      font: fonts.regular,
      size: 9.2,
      lineHeight: 12.5,
      color: C.ink,
      maxLines: maxLinesPerItem,
    }) - 9;
  }
  return y;
}

function drawDetailsPage(
  doc: PDFDocument,
  page: PDFPage,
  fonts: Fonts,
  content: SaasQuoteContent,
): void {
  page.drawRectangle({ x: 0, y: 0, width: A4[0], height: A4[1], color: C.white });
  page.drawRectangle({ x: 0, y: 744, width: A4[0], height: 98, color: C.tealDeep });
  drawBrand(page, fonts, 44, 784, true);
  page.drawText('YOUR PLAN, AT A GLANCE', {
    x: 44,
    y: 757,
    font: fonts.bold,
    size: 8.5,
    color: C.goldSoft,
  });
  page.drawText(safeText(content.plan.name), {
    x: 352,
    y: 787,
    font: fonts.bold,
    size: 17,
    color: C.white,
  });
  page.drawText(`${money(content.plan.amountGbp)} ${content.plan.billingInterval === 'annual' ? '/ year' : '/ week'}`, {
    x: 352,
    y: 762,
    font: fonts.regular,
    size: 11,
    color: C.goldSoft,
  });

  drawSectionLabel(page, fonts, "What's included", 44, 704);
  drawList(page, fonts, content.inclusions, 44, 671, 235);

  drawSectionLabel(page, fonts, 'Fare schedule', 316, 704);
  let fareY = 671;
  content.fares.forEach((fare) => {
    page.drawText(safeText(fare.label), {
      x: 316,
      y: fareY,
      font: fonts.regular,
      size: 8.5,
      color: C.muted,
    });
    fareY = drawParagraph(page, fare.value, {
      x: 316,
      y: fareY - 15,
      width: 235,
      font: fonts.bold,
      size: 10.2,
      lineHeight: 13,
      color: C.tealDeep,
      maxLines: 2,
    }) - 13;
  });

  page.drawLine({
    start: { x: 297, y: 390 },
    end: { x: 297, y: 714 },
    thickness: 0.5,
    color: C.goldSoft,
  });
  drawSectionLabel(page, fonts, 'Implementation', 44, 365);
  drawList(page, fonts, content.implementation, 44, 332, 235, 2);

  drawSectionLabel(page, fonts, 'Commercial terms', 316, 365);
  drawList(page, fonts, content.terms, 316, 332, 235, 3);

  if (content.notes) {
    page.drawText('NOTE', {
      x: 44,
      y: 153,
      font: fonts.bold,
      size: 8,
      color: C.tealSoft,
    });
    drawParagraph(page, content.notes, {
      x: 44,
      y: 135,
      width: content.quote.checkoutUrl ? 260 : 507,
      font: fonts.regular,
      size: 8.5,
      lineHeight: 11,
      color: C.muted,
      maxLines: 3,
    });
  }

  const { contact } = content.brand;
  if (content.quote.checkoutUrl) {
    page.drawText('Ready to move forward?', {
      x: 316,
      y: 168,
      font: fonts.bold,
      size: 12,
      color: C.tealDeep,
    });
    page.drawText('Open Stripe to accept, or call Sally.', {
      x: 316,
      y: 150,
      font: fonts.regular,
      size: 8.5,
      color: C.muted,
    });
    drawCheckoutButton(doc, page, fonts, content.quote.checkoutUrl, 316, 102, 235);
    page.drawRectangle({ x: 316, y: 58, width: 235, height: 34, color: C.tealDeep });
    const callLabel = `CALL ${contact.phone}`;
    const callLabelWidth = fonts.bold.widthOfTextAtSize(callLabel, 9.5);
    page.drawText(callLabel, {
      x: 316 + (235 - callLabelWidth) / 2,
      y: 70,
      font: fonts.bold,
      size: 9.5,
      color: C.gold,
    });
    addUriAnnotation(doc, page, `tel:${contact.phoneTel}`, 316, 58, 235, 34);
  } else {
    page.drawRectangle({ x: 316, y: 58, width: 235, height: 98, color: C.cream });
    page.drawText('NEXT STEP', {
      x: 334,
      y: 132,
      font: fonts.bold,
      size: 8,
      color: C.tealSoft,
    });
    page.drawText(`Speak with ${contact.sellerName}`, {
      x: 334,
      y: 112,
      font: fonts.bold,
      size: 11,
      color: C.tealDeep,
    });
    page.drawText(safeText(contact.phone), {
      x: 334,
      y: 90,
      font: fonts.bold,
      size: 14,
      color: C.teal,
    });
    page.drawText('UK landline · tap to call', {
      x: 334,
      y: 72,
      font: fonts.regular,
      size: 8,
      color: C.muted,
    });
    addUriAnnotation(doc, page, `tel:${contact.phoneTel}`, 316, 58, 235, 98);
  }
  drawFooter(doc, page, fonts, 2, content);
}

/**
 * Generates a fixed, print-safe two-page A4 proposal in the standard
 * DocumentAttachment shape used by the existing messaging PDF generator.
 */
export async function generateSaasQuotePdf(
  content: SaasQuoteContent,
  options: SaasQuotePdfOptions = {},
): Promise<DocumentAttachment> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${content.plan.name} proposal for ${content.customer.name}`);
  doc.setAuthor('Sync2Dine');
  doc.setSubject('Sync2Dine SaaS quotation');
  doc.setProducer('Sync2Dine');
  const fonts: Fonts = {
    regular: await doc.embedFont(StandardFonts.Helvetica),
    bold: await doc.embedFont(StandardFonts.HelveticaBold),
  };
  const portrait = await embedPortrait(doc, options);
  drawCover(doc, doc.addPage(A4), fonts, content, portrait);
  drawDetailsPage(doc, doc.addPage(A4), fonts, content);
  const bytes = await doc.save({ useObjectStreams: false });
  const customerSlug =
    content.customer.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'customer';
  return {
    filename: `sync2dine-quote-${customerSlug}.pdf`,
    mimeType: 'application/pdf',
    content: toBase64(bytes),
    logoEmbedded: true,
  };
}
