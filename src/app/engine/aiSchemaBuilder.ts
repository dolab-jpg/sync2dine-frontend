import type { TradeConfig } from '../config/types';

export function buildExtractionSchema(trade: TradeConfig) {
  const fields = trade.aiExtraction?.extractableFields ?? [];
  const properties: Record<string, unknown> = {};
  for (const key of fields) {
    properties[key] = {
      type: 'object',
      properties: {
        value: { type: ['string', 'number'] },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string' },
      },
      required: ['value', 'confidence'],
    };
  }
  return {
    type: 'object',
    properties: {
      suggestions: { type: 'object', properties },
      risks: { type: 'array', items: { type: 'string' } },
      summary: { type: 'string' },
    },
    required: ['suggestions', 'summary'],
  };
}
