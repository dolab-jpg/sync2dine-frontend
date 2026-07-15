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
 * Call the live price-research backend powered by the company OpenAI brain.
 * Throws when OpenAI is not connected (no silent mock).
 */
export async function researchPrices(req: PriceResearchRequest): Promise<PricingResearch> {
  const cfg = integrationService.getConfig('price_research');
  const openai = integrationService.getConfig('openai');
  const region = cfg.region || 'UK';

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
      apiKey: integrationService.getLiveOpenAIApiKey(),
      deepseekApiKey: openai.deepseekApiKey || undefined,
      brainProvider: openai.provider || 'openai',
    }),
  });

  const data = await res.json().catch(() => ({})) as {
    items?: PricingResearchLine[];
    provider?: string;
    note?: string;
    error?: string;
  };

  if (!res.ok) {
    throw new Error(
      data.error
        || 'OpenAI not connected — add your API key in Settings → Integrations → Company AI Brain and Save.',
    );
  }

  return {
    provider: data.provider ?? 'openai',
    region,
    summary: data.note,
    lines: Array.isArray(data.items) ? data.items : [],
    generatedAt: new Date().toISOString(),
  };
}
