import type { Product, PricingRule } from '../../App';
import type { TradeId, WizardAnswers } from '../../config/types';
import { calculateQuote } from '../quoteCalculator';
import { loadAIStudioConfig } from './aiStudioStore';

export interface IndicativeEstimate {
  baseTotal: number;
  low: number;
  high: number;
  midpoint: number;
  summary: string;
}

function roundUp(value: number, step: number): number {
  if (step <= 0) return Math.round(value);
  return Math.ceil(value / step) * step;
}

export function buildIndicativeEstimate(
  tradeId: TradeId,
  answers: WizardAnswers,
  products: Product[],
  pricingRules: PricingRule[]
): IndicativeEstimate {
  const config = loadAIStudioConfig();
  const result = calculateQuote(tradeId, answers, products, pricingRules);
  const baseTotal = result.total;
  const buffer = 1 + config.estimateBufferPercent / 100;
  const high = roundUp(baseTotal * buffer, config.estimateRoundUp);
  const low = roundUp(baseTotal * 0.95, config.estimateRoundUp);
  const midpoint = roundUp((low + high) / 2, config.estimateRoundUp);

  return {
    baseTotal,
    low,
    high,
    midpoint,
    summary: `Indicative range £${low.toLocaleString('en-GB')}–£${high.toLocaleString('en-GB')} (inc. cautious buffer).`,
  };
}

export function formatDisclaimer(low: number, high: number): string {
  const config = loadAIStudioConfig();
  const fmt = (n: number) => `£${n.toLocaleString('en-GB')}`;
  return config.disclaimerTemplate
    .replace(/\{\{low\}\}/g, fmt(low))
    .replace(/\{\{high\}\}/g, fmt(high))
    .replace(/\*\*/g, '');
}

export function suggestionsToAnswers(
  suggestions: Record<string, { value: unknown; confidence: number; reason?: string }>
): WizardAnswers {
  const answers: WizardAnswers = {};
  Object.entries(suggestions).forEach(([key, sug]) => {
    if (sug.confidence >= 0.4) {
      answers[key] = sug.value;
    }
  });
  return answers;
}
