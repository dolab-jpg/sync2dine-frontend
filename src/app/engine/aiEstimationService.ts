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
    img.src = dataUrl;
  });
}

function mockEstimation(tradeId: TradeId): EstimationResult {
  const trade = getTrade(tradeId);
  const mocks: Record<string, EstimationResult> = {
    bathroom: {
      suggestions: {
        length: { value: 2.4, confidence: 0.72, reason: 'Estimated from room proportions' },
        width: { value: 1.8, confidence: 0.68 },
        floorLocation: { value: 'upstairs', confidence: 0.85 },
        removal: { value: 'standard', confidence: 0.6 },
        finish: { value: 'microcement-grey', confidence: 0.55 },
      },
      risks: ['Verify exact dimensions on site', 'Check for hidden water damage'],
      summary: 'Small upstairs bathroom, approx 4.3m². Standard strip-out likely.',
    },
    kitchen: {
      suggestions: {
        length: { value: 4.2, confidence: 0.7 },
        width: { value: 3.0, confidence: 0.65 },
        floorLocation: { value: 'ground', confidence: 0.8 },
        access: { value: 'easy', confidence: 0.7 },
        removal: { value: 'standard', confidence: 0.6 },
        finish: { value: 'quartz', confidence: 0.5 },
      },
      risks: ['Confirm appliance locations', 'Check gas supply'],
      summary: 'L-shaped kitchen approximately 12.6m² floor area.',
    },
    electrical: {
      suggestions: {
        rooms: { value: 4, confidence: 0.7, reason: 'Typical 3-bed property' },
        jobType: { value: 'partial-rewire', confidence: 0.55 },
        consumerUnit: { value: 'rcd-split', confidence: 0.65 },
        sockets: { value: 24, confidence: 0.5 },
        lights: { value: 12, confidence: 0.5 },
      },
      risks: ['EICR recommended before work', 'Check earthing and bonding'],
      summary: 'Partial rewire likely — consumer unit upgrade may be required.',
    },
    plumbing: {
      suggestions: {
        rooms: { value: 3, confidence: 0.65 },
        boilerType: { value: 'combi', confidence: 0.6 },
        radiators: { value: 8, confidence: 0.55 },
        cylinder: { value: 'none', confidence: 0.7 },
      },
      risks: ['Confirm boiler age and flue route', 'Check water pressure'],
      summary: 'Heating system upgrade — combi boiler replacement candidate.',
    },
    roofing: {
      suggestions: {
        area: { value: 65, confidence: 0.55 },
        finish: { value: 'concrete-tile', confidence: 0.6 },
        roofType: { value: 'pitched', confidence: 0.75 },
        removal: { value: 'overlay', confidence: 0.5 },
      },
      risks: ['Check structure and battens', 'Scaffold access required'],
      summary: 'Pitched roof approx 65m² — tile replacement or overlay.',
    },
    flooring: {
      suggestions: {
        length: { value: 5.0, confidence: 0.65 },
        width: { value: 4.0, confidence: 0.6 },
        finish: { value: 'laminate', confidence: 0.55 },
        subfloor: { value: 'plywood', confidence: 0.5 },
        rooms: { value: 2, confidence: 0.7 },
      },
      risks: ['Check subfloor moisture levels', 'Door clearance after install'],
      summary: 'Two rooms, approx 20m² total — laminate over plywood subfloor.',
    },
    painting: {
      suggestions: {
        rooms: { value: 3, confidence: 0.7 },
        length: { value: 4.5, confidence: 0.55 },
        width: { value: 3.8, confidence: 0.55 },
        prepLevel: { value: 'medium', confidence: 0.5 },
        finish: { value: 'emulsion', confidence: 0.65 },
      },
      risks: ['Allow drying time between coats', 'Check for artex or wallpaper'],
      summary: 'Three rooms — medium prep, emulsion walls and ceilings.',
    },
    plastering: {
      suggestions: {
        length: { value: 4.0, confidence: 0.6 },
        width: { value: 3.5, confidence: 0.58 },
        finish: { value: 'skim', confidence: 0.65 },
        removal: { value: 'none', confidence: 0.7 },
      },
      risks: ['Check for blown plaster', 'Allow curing time before decorating'],
      summary: 'Single room skim coat — approx 14m² wall area.',
    },
    extensions: {
      suggestions: {
        length: { value: 6.0, confidence: 0.55 },
        width: { value: 4.0, confidence: 0.55 },
        storeys: { value: 1, confidence: 0.8 },
        specLevel: { value: 'standard', confidence: 0.5 },
        access: { value: 'restricted', confidence: 0.6 },
      },
      risks: ['Building regs and planning may apply', 'Party wall agreement if terraced'],
      summary: 'Single-storey rear extension approx 24m² footprint.',
    },
    windows: {
      suggestions: {
        windows: { value: 6, confidence: 0.65 },
        doors: { value: 1, confidence: 0.7 },
        finish: { value: 'upvc-white', confidence: 0.6 },
      },
      risks: ['FENSA certification required', 'Check trickle vents and fire egress'],
      summary: 'Six windows and one door — UPVC replacement likely.',
    },
    loft: {
      suggestions: {
        area: { value: 35, confidence: 0.5 },
        conversionType: { value: 'dormer', confidence: 0.55 },
        rooms: { value: 2, confidence: 0.6 },
        bathroom: { value: 'ensuite', confidence: 0.45 },
      },
      risks: ['Check head height and steels', 'Building regs sign-off required'],
      summary: 'Dormer loft conversion — two rooms with ensuite potential.',
    },
    landscaping: {
      suggestions: {
        length: { value: 10, confidence: 0.55 },
        width: { value: 6, confidence: 0.55 },
        surfaceType: { value: 'patio', confidence: 0.6 },
        linearMetres: { value: 12, confidence: 0.5 },
        access: { value: 'side-gate', confidence: 0.65 },
      },
      risks: ['Check drainage falls', 'Waste skip access for delivery'],
      summary: 'Rear garden patio approx 60m² with 12m fencing.',
    },
  };
  return mocks[tradeId] ?? {
    suggestions: { area: { value: 20, confidence: 0.5 } },
    risks: ['AI mock mode — configure OPENAI_API_KEY for real analysis'],
    summary: `Mock estimation for ${trade.name}. Upload photos with API key configured for real results.`,
  };
}

export async function estimateFromPhotos(
  tradeId: TradeId,
  images: string[],
  context?: Record<string, unknown>
): Promise<EstimationResult> {
  const trade = getTrade(tradeId);
  const openaiConfig = integrationService.getConfig('openai');
  const resized = await Promise.all(images.slice(0, 5).map(img => resizeImage(img)));

  try {
    const res = await fetch('/api/ai/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tradeId,
        images: resized,
        context,
        systemPrompt: buildEstimationSystemPrompt(trade),
        schema: buildExtractionSchema(trade),
        apiKey: openaiConfig.apiKey || undefined,
      }),
    });

    if (res.ok) {
      return await res.json();
    }
  } catch {
    // mock fallback
  }

  return mockEstimation(tradeId);
}

export function clampSuggestion(
  tradeId: TradeId,
  key: string,
  value: unknown
): unknown {
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  if (key === 'length' || key === 'width') return Number.isFinite(n) ? Math.min(30, Math.max(0.5, n)) : value;
  if (key === 'area') return Number.isFinite(n) ? Math.min(500, Math.max(1, n)) : value;
  if (key === 'rooms' || key === 'windows') return Number.isFinite(n) ? Math.min(50, Math.max(0, Math.round(n))) : value;
  return value;
}
