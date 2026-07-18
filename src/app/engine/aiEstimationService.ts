import { getTrade } from '../config/trades';
import type { TradeId } from '../config/types';
import { buildExtractionSchema } from './aiSchemaBuilder';
import { buildEstimationSystemPrompt } from './aiPromptBuilder';
import { integrationService } from './integrations/integrationService';

export interface EstimationResult {
  suggestions: Record<string, { value: unknown; confidence: number; reason?: string }>;
  risks: string[];
  summary: string;
}

async function resizeImage(dataUrl: string, maxSize = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > height && width > maxSize) {
        height = (height * maxSize) / width;
        width = maxSize;
      } else if (height > maxSize) {
        width = (width * maxSize) / height;
        height = maxSize;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = dataUrl;
  });
}

/** Convert PDF file first pages to JPEG data URLs for vision. */
export async function pdfFileToImages(file: File, maxPages = 3): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist');
  const { getDocument, GlobalWorkerOptions } = pdfjs;
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const images: string[] = [];

  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;
    await page.render({ canvasContext: ctx, viewport, canvas } as Parameters<typeof page.render>[0]).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.85));
  }
  return images;
}

/** Extract plain text from a PDF for brain context. */
export async function pdfFileToText(file: File, maxPages = 5): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const { getDocument, GlobalWorkerOptions } = pdfjs;
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url,
  ).toString();

  const data = await file.arrayBuffer();
  const pdf = await getDocument({ data }).promise;
  const pages = Math.min(pdf.numPages, maxPages);
  const parts: string[] = [];
  for (let i = 1; i <= pages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ('str' in item ? String((item as { str: string }).str) : ''))
      .join(' ');
    if (text.trim()) parts.push(text.trim());
  }
  return parts.join('\n\n');
}

export async function estimateFromPhotos(
  tradeId: TradeId,
  images: string[],
  context?: Record<string, unknown> & { documentText?: string },
): Promise<EstimationResult> {
  const trade = getTrade(tradeId);
  const resized = images.length
    ? await Promise.all(images.slice(0, 8).map((img) => resizeImage(img)))
    : [];
  const documentText = typeof context?.documentText === 'string' ? context.documentText : undefined;

  if (resized.length === 0 && !documentText?.trim()) {
    throw new Error('Add at least one photo or PDF for AI to analyse');
  }

  const res = await fetch('/api/ai/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      tradeId,
      images: resized,
      documentText,
      context,
      systemPrompt: buildEstimationSystemPrompt(trade),
      schema: buildExtractionSchema(trade),
      apiKey: integrationService.getLiveOpenAIApiKey(),
      provider: integrationService.getConfig('openai').provider || 'openai',
      deepseekApiKey: integrationService.getConfig('openai').deepseekApiKey || undefined,
    }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(
      data.error
        || 'AI brain not connected — add a DeepSeek or OpenAI key in Settings → Integrations → Company AI Brain and Save.',
    );
  }

  return await res.json() as EstimationResult;
}

export function clampSuggestion(
  tradeId: TradeId,
  key: string,
  value: unknown,
): unknown {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (key === 'length' || key === 'width') return Number.isFinite(n) ? Math.min(30, Math.max(0.5, n)) : value;
  if (key === 'area') return Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : value;
  if (key === 'rooms' || key === 'windows') return Number.isFinite(n) ? Math.min(50, Math.max(0, Math.round(n))) : value;
  return value;
}
