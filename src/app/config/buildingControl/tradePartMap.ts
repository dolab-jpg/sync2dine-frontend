import type { TradeId } from '../types';

/** Maps trades to relevant UK Approved Documents / building control topics. */
export const TRADE_PART_MAP: Record<TradeId, string[]> = {
  bathroom: ['part-f-ventilation', 'part-h-drainage', 'part-p-electrical', 'part-g-water', 'waterproofing-wet-rooms'],
  kitchen: ['part-f-ventilation', 'part-h-drainage', 'part-p-electrical', 'part-g-water'],
  electrical: ['part-p-electrical', 'bs7671-electrical'],
  plumbing: ['part-g-water', 'part-h-drainage'],
  roofing: ['part-a-structure', 'part-l-energy'],
  flooring: ['part-e-fire', 'part-l-energy'],
  painting: ['part-b-fire', 'part-l-energy'],
  plastering: ['part-a-structure', 'part-l-energy'],
  extensions: ['part-a-structure', 'part-b-fire', 'part-l-energy', 'part-h-drainage'],
  windows: ['part-l-energy', 'part-q-security'],
  loft: ['part-a-structure', 'part-b-fire', 'part-l-energy'],
  landscaping: ['part-h-drainage'],
};

export function getDocIdsForTrade(tradeId: TradeId | string): string[] {
  return TRADE_PART_MAP[tradeId as TradeId] ?? [];
}
