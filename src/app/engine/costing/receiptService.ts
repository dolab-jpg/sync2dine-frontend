import { integrationService } from '../integrations/integrationService';

export interface ReceiptLineItem {
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
  category: string;
}

export interface ReceiptParseResult {
  supplier: string;
  date: string;
  items: ReceiptLineItem[];
  subtotal: number;
  vat: number;
  total: number;
  confidence: number;
  aiSummary: string;
  flagged: boolean;
}

async function resizeImage(dataUrl: string, maxSize = 1024): Promise<string> {
  return new Promise((resolve) => {
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
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

export async function parseReceiptPhoto(
  imageDataUrl: string,
  projectName?: string
): Promise<ReceiptParseResult> {
  const openaiConfig = integrationService.getConfig('openai');
  const resized = await resizeImage(imageDataUrl);

  const res = await fetch('/api/ai/receipt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: openaiConfig.apiKey || undefined,
      images: [resized],
      projectName,
    }),
  });

  if (!res.ok) {
    throw new Error(`Receipt parse failed: ${res.status}`);
  }

  return res.json() as Promise<ReceiptParseResult>;
}
