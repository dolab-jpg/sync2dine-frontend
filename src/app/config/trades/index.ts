import type { TradeConfig, TradeId } from '../types';
import { bathroomConfig } from './bathroom';
import { kitchenConfig } from './kitchen';
import { electricalConfig } from './electrical';
import { plumbingConfig } from './plumbing';
import { roofingConfig } from './roofing';
import {
  extensionsConfig,
  flooringConfig,
  landscapingConfig,
  loftConfig,
  paintingConfig,
  plasteringConfig,
  windowsConfig,
} from './remaining';

export const TRADES: Record<TradeId, TradeConfig> = {
  bathroom: bathroomConfig,
  kitchen: kitchenConfig,
  electrical: electricalConfig,
  plumbing: plumbingConfig,
  roofing: roofingConfig,
  flooring: flooringConfig,
  painting: paintingConfig,
  plastering: plasteringConfig,
  extensions: extensionsConfig,
  windows: windowsConfig,
  loft: loftConfig,
  landscaping: landscapingConfig,
};

export const TRADE_IDS = Object.keys(TRADES) as TradeId[];

export function getTrade(id: TradeId): TradeConfig {
  return TRADES[id];
}

export function getAllTrades(): TradeConfig[] {
  return TRADE_IDS.map(id => TRADES[id]);
}

export function getTradeProductCategories(tradeId: TradeId): string[] {
  return TRADES[tradeId].productCategoryGroups.flatMap(g => g.categories);
}

export function isValidTradeId(id: string): id is TradeId {
  return id in TRADES;
}

export { bathroomConfig, kitchenConfig, electricalConfig, plumbingConfig, roofingConfig };
