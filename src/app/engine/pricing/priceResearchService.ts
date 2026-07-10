import { integrationService } from '../integrations/integrationService';
import { loadAIStudioConfig } from '../ai/aiStudioStore';
import type { PricingResearch, PricingResearchLine } from '../../App';

export interface PriceResearchRequest {
  tasks: string[];
  tradeName?: string;
  postcode?: string;
}

/** Round a value up to the nearest step (e.g. £250). step <= 0 just rounds. */
export function roundUpTo(value: number, step: number): number {
  if (step <= 0) return Math.round(value);
  return Math.ceil(value / step) * step;
}

/**
 * Bias a researched price range toward the higher end (premium installer pricing),
 * applying the configured cautious buffer and round-up from AI Studio settings.
 */
export function pickHigherEnd(line: { low: number; typical: number; high: number }): number {
  const config = loadAIStudioConfig();
  const buffer = 1 + (config.estimateBufferPercent ?? 12) / 100;
  const candidate = Math.max(line.high || 0, (line.typical || 0) * buffer, line.low || 0);
  return roundUpTo(candidate, config.estimateRoundUp || 1);
}

/**
 * Call the live price-research backend. Falls back to an empty result on failure;
 * the server itself returns deterministic mock ranges when no OpenAI key is present.
 */
export async function researchPrices(req: PriceResearchRequest): Promise<PricingResearch> {
  const cfg = integrationService.getConfig('price_research');
  const openai = integrationService.getConfig('openai');
  const region = cfg.region || 'UK';
  let lines: PricingResearchLine[] = [];
  let provider = 'mock';
  let summary: string | undefined;

  try {
    const res = await fetch('/api/ai/price-research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: req.tasks,
        tradeName: req.tradeName,
        postcode: req.postcode,
        region,
        provider: cfg.provider || 'openai_web',
        searchApiKey: cfg.apiKey || undefined,
        apiKey: openai.apiKey || undefined,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      lines = Array.isArray(data.items) ? (data.items as PricingResearchLine[]) : [];
      provider = data.provider ?? provider;
      summary = data.note;
    }
  } catch {
    // fall through to empty result
  }

  return { provider, region, summary, lines, generatedAt: new Date().toISOString() };
}
