import type { TradeConfig } from '../config/types';
import { buildBritishVoicePrompt } from './ai/britishVoice';
import { loadAIStudioConfig } from './ai/aiStudioStore';

export function buildEstimationSystemPrompt(trade: TradeConfig): string {
  const studio = loadAIStudioConfig();
  return `${buildBritishVoicePrompt(studio.humourLevel, 'staff', studio.companyInstructions)}

You are a UK construction estimator specialising in ${trade.name}.
${trade.aiExtraction?.promptContext ?? ''}
Estimate dimensions and site conditions from photos. Never invent exact measurements — use confidence scores when uncertain.
Output valid JSON only matching the requested schema.
Always use UK pricing context (£ GBP).`;
}

export function buildChatSystemPrompt(tradeName: string | null, pageContext: Record<string, unknown>): string {
  const studio = loadAIStudioConfig();
  const role = String(pageContext.userRole ?? 'staff');
  const tradeLine = tradeName
    ? `Current trade context: ${tradeName}.`
    : 'No trade selected yet — infer the trade from the user message before quoting.';
  return `${buildBritishVoicePrompt(studio.humourLevel, role, studio.companyInstructions)}

${tradeLine}
Current page: ${pageContext.route ?? 'unknown'}.
Help with quoting, site surveys, and customer questions across UK trades.
Be direct and practical — dry British wit when it fits. Always act in the company's best interests (margin, cashflow, reputation). If suggesting estimate fields, note they must be verified on site.`;
}
