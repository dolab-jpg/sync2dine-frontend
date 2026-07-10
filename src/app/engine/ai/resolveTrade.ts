import { getTrade, isValidTradeId } from '../../config/trades';
import type { TradeId } from '../../config/types';
import type { DetectedTrade } from '../staffAiService';

export interface ResolveTradeInput {
  tradeOverride: boolean;
  overrideTradeId: TradeId | null;
  aiDetectedTrade: boolean;
  detectedTrades: DetectedTrade[];
  routeTradeId: TradeId | null;
  projectTradeId?: string | null;
  quoteTradeId?: string | null;
  customerInterestedTrades?: string[];
}

export interface ResolvedTrade {
  tradeId: TradeId | null;
  tradeName: string | null;
  source:
    | 'override'
    | 'ai_detected'
    | 'route'
    | 'project'
    | 'quote'
    | 'customer'
    | null;
}

function firstValidTradeId(...candidates: Array<string | null | undefined>): TradeId | null {
  for (const candidate of candidates) {
    if (candidate && isValidTradeId(candidate)) return candidate;
  }
  return null;
}

export function resolveActiveTrade(input: ResolveTradeInput): ResolvedTrade {
  if (input.tradeOverride && input.overrideTradeId) {
    return {
      tradeId: input.overrideTradeId,
      tradeName: getTrade(input.overrideTradeId).name,
      source: 'override',
    };
  }

  if (input.aiDetectedTrade && input.detectedTrades.length > 0) {
    const top = input.detectedTrades[0];
    if (isValidTradeId(top.tradeId)) {
      return {
        tradeId: top.tradeId,
        tradeName: getTrade(top.tradeId).name,
        source: 'ai_detected',
      };
    }
  }

  if (input.routeTradeId) {
    return {
      tradeId: input.routeTradeId,
      tradeName: getTrade(input.routeTradeId).name,
      source: 'route',
    };
  }

  const projectTrade = firstValidTradeId(input.projectTradeId);
  if (projectTrade) {
    return {
      tradeId: projectTrade,
      tradeName: getTrade(projectTrade).name,
      source: 'project',
    };
  }

  const quoteTrade = firstValidTradeId(input.quoteTradeId);
  if (quoteTrade) {
    return {
      tradeId: quoteTrade,
      tradeName: getTrade(quoteTrade).name,
      source: 'quote',
    };
  }

  const customerTrade = firstValidTradeId(...(input.customerInterestedTrades ?? []));
  if (customerTrade) {
    return {
      tradeId: customerTrade,
      tradeName: getTrade(customerTrade).name,
      source: 'customer',
    };
  }

  return { tradeId: null, tradeName: null, source: null };
}

export const GENERAL_PHOTO_GUIDANCE = [
  'Wide room or area overview',
  'Close-up of fixtures or finishes',
  'Access route and parking if relevant',
];
