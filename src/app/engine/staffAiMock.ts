import { getAllTrades } from '../config/trades';
import type { TradeId } from '../config/types';
import type { StaffAIContext, StaffAIResult } from './staffAiService';

function inferTrades(text: string): Array<{ tradeId: TradeId; confidence: number; reason?: string }> {
  const lower = text.toLowerCase();
  const detected: Array<{ tradeId: TradeId; confidence: number; reason?: string }> = [];

  for (const trade of getAllTrades()) {
    const desc = `${trade.name} ${trade.description}`.toLowerCase();
    const keywords = desc.split(/\s+/).filter(w => w.length > 4);
    const hits = keywords.filter(k => lower.includes(k));
    if (hits.length >= 2 || lower.includes(trade.id) || lower.includes(trade.name.toLowerCase())) {
      detected.push({ tradeId: trade.id, confidence: 0.7, reason: `Matched ${trade.name}` });
    }
  }

  if (lower.includes('consumer unit') || lower.includes('rewire') || lower.includes('electrical')) {
    if (!detected.some(d => d.tradeId === 'electrical')) {
      detected.push({ tradeId: 'electrical', confidence: 0.85, reason: 'Electrical work mentioned' });
    }
  }
  if (lower.includes('bathroom') || lower.includes('shower') || lower.includes('toilet')) {
    if (!detected.some(d => d.tradeId === 'bathroom')) {
      detected.push({ tradeId: 'bathroom', confidence: 0.85, reason: 'Bathroom work mentioned' });
    }
  }
  if (lower.includes('kitchen') || lower.includes('worktop')) {
    if (!detected.some(d => d.tradeId === 'kitchen')) {
      detected.push({ tradeId: 'kitchen', confidence: 0.8, reason: 'Kitchen work mentioned' });
    }
  }

  return detected.sort((a, b) => b.confidence - a.confidence);
}

export function mockStaffAIClient(userMessage: string, ctx: StaffAIContext): StaffAIResult {
  const lower = userMessage.toLowerCase();
  const detected = inferTrades(userMessage);
  const contextTrade = ctx.tradeId && typeof ctx.tradeId === 'string' ? ctx.tradeId as TradeId : null;
  const primary = detected[0]?.tradeId ?? contextTrade;

  const proposedActions: StaffAIResult['proposedActions'] = [];

  if (detected.length > 0) {
    proposedActions.push({
      action: 'detectTrades',
      input: {},
      output: { trades: detected },
    });
  }

  const customers = ctx.customers ?? [];
  const existing = customers.find(c => lower.includes(c.name.toLowerCase()));

  if (primary && detected.length > 0) {
    proposedActions.push({
      action: 'proposeQuoteFields',
      input: {},
      output: { tradeId: primary, fields: {} },
    });
  }

  if (existing || lower.includes('customer') || lower.includes('for ')) {
    proposedActions.push({
      action: 'linkCustomer',
      input: {},
      output: {
        customerId: existing?.id,
        name: existing?.name ?? '',
        interestedTrades: detected.length > 0
          ? detected.map(d => d.tradeId)
          : (primary ? [primary] : []),
        isNew: !existing,
      },
    });
  }

  return {
    content: detected.length > 0
      ? `I detected: ${detected.map(d => d.tradeId).join(', ')}. Review the actions below.`
      : 'Describe the job and I\'ll detect trades and prepare a quote.',
    proposedActions,
    detectedTrades: detected.length > 0 ? detected : undefined,
  };
}
