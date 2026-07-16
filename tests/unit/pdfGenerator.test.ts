import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PDFDocument } from 'pdf-lib';

// Minimal 1x1 PNG
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

vi.mock('../../src/app/engine/integrations/companyProfileSync', () => ({
  getCompanyProfile: vi.fn(() => ({
    companyName: 'Acme Bathrooms Ltd',
    address: '1 High Street',
    phone: '01234567890',
    email: 'hello@acme.test',
    website: 'https://acme.test',
    logoUrl: 'https://cdn.example.com/logo.png',
    companyRegistrationNumber: '12345678',
    vatNumber: 'GB123',
  })),
}));

vi.mock('../../src/app/engine/storage/storageService', () => ({
  uploadBase64File: vi.fn(async (_projectId: string, filename: string, mimeType: string, base64: string) => ({
    id: 'F1',
    storagePath: `projects/P1/${filename}`,
    filename,
    mimeType,
    source: 'document',
    uploadedBy: 'test',
    takenAt: new Date().toISOString(),
    dataUrl: `data:${mimeType};base64,${base64}`,
  })),
  resolveFileUrl: vi.fn(async (file: { dataUrl?: string; storagePath: string }) => file.dataUrl || file.storagePath),
}));

import { generateQuotePdf, generateInvoicePdf } from '../../src/app/engine/messaging/pdfGenerator';
import { quoteLinesToPdfItems, quoteToPdfLineItems } from '../../src/app/engine/messaging/quotePdfHelpers';
import { persistGeneratedPdf, pdfPathFromAttachment } from '../../src/app/engine/messaging/documentPersist';
import { getCompanyProfile } from '../../src/app/engine/integrations/companyProfileSync';

describe('pdfGenerator company branding', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        headers: { get: () => 'image/png' },
        arrayBuffer: async () => Uint8Array.from(atob(TINY_PNG_B64), (c) => c.charCodeAt(0)).buffer,
      }))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('embeds company logo when logoUrl is fetchable', async () => {
    const pdf = await generateQuotePdf('Test Customer', 1234, 'Bathroomrooms', [
      { description: 'Suite install', amount: 1234 },
    ]);
    expect(pdf.mimeType).toBe('application/pdf');
    expect(pdf.filename).toContain('quote-test-customer');
    expect(pdf.content.length).toBeGreaterThan(100);

    const bytes = Uint8Array.from(atob(pdf.content), (c) => c.charCodeAt(0));
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(1);
    // pdf-lib embeds images — company profile was consulted
    expect(getCompanyProfile).toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith('https://cdn.example.com/logo.png');
  });

  it('still builds PDF when logo fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) }))
    );
    const pdf = await generateInvoicePdf(
      'Cust',
      'Project A',
      [{ description: 'Stage 1', amount: 500 }],
      500,
      'INV-1'
    );
    expect(pdf.filename).toBe('invoice-INV-1.pdf');
    expect(pdf.content.length).toBeGreaterThan(50);
  });
});

describe('quote PDF line items', () => {
  it('maps quote lines to PDF amounts with qty/unit', () => {
    const items = quoteLinesToPdfItems([
      {
        id: '1',
        description: 'Tiles',
        quantity: 10,
        unit: 'sqm',
        rate: 40,
        total: 400,
      },
      {
        id: '2',
        description: 'Labour',
        quantity: 1,
        unit: 'fixed',
        rate: 200,
        total: 200,
      },
    ]);
    expect(items).toEqual([
      { description: 'Tiles (10 sqm)', amount: 400 },
      { description: 'Labour', amount: 200 },
    ]);
  });

  it('migrates legacy quote items for PDF', () => {
    const items = quoteToPdfLineItems({
      lines: undefined,
      items: [{ productId: 'p1', name: 'Vanity', quantity: 1, price: 300, total: 300 }],
      labour: [],
      extras: [],
    });
    expect(items[0]?.description).toContain('Vanity');
    expect(items[0]?.amount).toBe(300);
  });
});

describe('document persist', () => {
  it('stores under project and returns storage path for pdfPath', async () => {
    const attachment = await persistGeneratedPdf(
      {
        filename: 'invoice-1.pdf',
        mimeType: 'application/pdf',
        content: btoa('%PDF-1.4'),
      },
      { projectId: 'P1', uploadedBy: 'test' }
    );
    expect(attachment.storagePath).toContain('projects/P1/');
    expect(attachment.url).toMatch(/^data:application\/pdf;base64,/);
    expect(pdfPathFromAttachment(attachment)).toContain('projects/P1/');
  });

  it('falls back to data URL without projectId', async () => {
    const attachment = await persistGeneratedPdf({
      filename: 'quote.pdf',
      mimeType: 'application/pdf',
      content: btoa('%PDF'),
    });
    expect(attachment.url).toMatch(/^data:application\/pdf;base64,/);
    expect(pdfPathFromAttachment(attachment)).toBe('quote.pdf');
  });
});

describe('send-path gap fixes (wiring presence)', () => {
  it('quote PDF helper and sales close flow export send with PDF', async () => {
    const helpers = await import('../../src/app/engine/messaging/quotePdfHelpers');
    const salesSrc = await import('../../src/app/engine/salesCloseFlow');
    expect(helpers.buildQuotePdfAttachment).toBeTypeOf('function');
    expect(helpers.quoteToPdfLineItems).toBeTypeOf('function');
    expect(salesSrc.sendPricePack).toBeTypeOf('function');
  });
});
