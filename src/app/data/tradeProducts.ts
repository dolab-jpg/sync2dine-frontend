import type { Product } from '../App';
import type { PricingRule } from '../App';

const mk = (p: Omit<Product, 'sellPrice'> & { sellPrice?: number }): Product => ({
  ...p,
  sellPrice: p.sellPrice ?? p.basePrice * (1 + p.margin / 100),
});

export const bathroomProducts: Product[] = [
  mk({ id: '1', tradeId: 'bathroom', name: 'Wall Hung Toilet - White Ceramic', image: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=200', basePrice: 180, margin: 35, source: 'supplier', category: 'toilet' }),
  mk({ id: '2', tradeId: 'bathroom', name: 'Back to Wall Toilet - Rimless', image: 'https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=200', basePrice: 220, margin: 35, source: 'supplier', category: 'toilet' }),
  mk({ id: '5', tradeId: 'bathroom', name: 'Countertop Basin - Round White', image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=200', basePrice: 120, margin: 35, source: 'supplier', category: 'basin' }),
  mk({ id: '7', tradeId: 'bathroom', name: 'Vanity Unit with Basin - 800mm Oak', image: 'https://images.unsplash.com/photo-1604014237800-1c9102c219da?w=200', basePrice: 380, margin: 35, source: 'supplier', category: 'basin' }),
  mk({ id: '10', tradeId: 'bathroom', name: 'Walk-in Shower Screen - 1200mm', image: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=200', basePrice: 420, margin: 35, source: 'supplier', category: 'shower' }),
  mk({ id: '12', tradeId: 'bathroom', name: 'Wetroom Kit - Linear Drain 1200mm', image: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=200', basePrice: 560, margin: 35, source: 'supplier', category: 'shower' }),
  mk({ id: '15', tradeId: 'bathroom', name: 'Basin Mixer Tap - Chrome', image: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=200', basePrice: 45, margin: 40, source: 'supplier', category: 'tap' }),
  mk({ id: '16', tradeId: 'bathroom', name: 'Thermostatic Shower Mixer - Chrome', image: 'https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=200', basePrice: 120, margin: 35, source: 'supplier', category: 'tap' }),
];

export const kitchenProducts: Product[] = [
  mk({ id: 'k1', tradeId: 'kitchen', name: 'Shaker Base Unit 600mm', image: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=200', basePrice: 180, margin: 35, source: 'supplier', category: 'base-unit' }),
  mk({ id: 'k2', tradeId: 'kitchen', name: 'Wall Unit 600mm', image: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=200', basePrice: 120, margin: 35, source: 'supplier', category: 'wall-unit' }),
  mk({ id: 'k3', tradeId: 'kitchen', name: 'Integrated Appliance Package', image: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=200', basePrice: 2200, margin: 25, source: 'supplier', category: 'appliance' }),
  mk({ id: 'k4', tradeId: 'kitchen', name: 'Undermount Sink 1.5 Bowl', image: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=200', basePrice: 180, margin: 35, source: 'supplier', category: 'sink' }),
];

export const electricalProducts: Product[] = [
  mk({ id: 'e1', tradeId: 'electrical', name: '10-Way Consumer Unit RCBO', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200', basePrice: 280, margin: 40, source: 'supplier', category: 'consumer-unit' }),
  mk({ id: 'e2', tradeId: 'electrical', name: 'Double Socket - Chrome', image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=200', basePrice: 12, margin: 50, source: 'supplier', category: 'socket' }),
];

export const plumbingProducts: Product[] = [
  mk({ id: 'p1', tradeId: 'plumbing', name: 'Worcester Bosch 30kW Combi', image: 'https://images.unsplash.com/photo-1585704032915-e24119dd3ee2?w=200', basePrice: 1100, margin: 30, source: 'supplier', category: 'boiler' }),
  mk({ id: 'p2', tradeId: 'plumbing', name: 'Hive Smart Thermostat', image: 'https://images.unsplash.com/photo-1585704032915-e24119dd3ee2?w=200', basePrice: 180, margin: 35, source: 'supplier', category: 'controls' }),
];

export const windowsProducts: Product[] = [
  mk({ id: 'w1', tradeId: 'windows', name: 'uPVC Casement 1200x1200', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200', basePrice: 380, margin: 35, source: 'supplier', category: 'window' }),
  mk({ id: 'w2', tradeId: 'windows', name: 'Composite Front Door', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=200', basePrice: 950, margin: 30, source: 'supplier', category: 'door' }),
];

export const allTradeProducts: Product[] = [
  ...bathroomProducts,
  ...kitchenProducts,
  ...electricalProducts,
  ...plumbingProducts,
  ...windowsProducts,
];

export const tradePricingRules: PricingRule[] = [
  { id: '1', tradeId: 'bathroom', name: 'Microcement Application', type: 'per_sqm', basePrice: 85, category: 'finish' },
  { id: '2', tradeId: null, name: 'Labour Day Rate', type: 'per_day', basePrice: 250, category: 'labour' },
  { id: '3', tradeId: 'bathroom', name: 'Waterproofing', type: 'per_sqm', basePrice: 35, category: 'prep' },
  { id: '4', tradeId: null, name: 'Lighting Installation', type: 'per_item', basePrice: 120, category: 'electrical' },
  { id: '5', tradeId: 'bathroom', name: 'Niche/Insert', type: 'per_item', basePrice: 180, category: 'feature' },
  { id: '6', tradeId: null, name: 'Demolition', type: 'fixed', basePrice: 450, category: 'prep' },
  { id: '7', tradeId: 'kitchen', name: 'Kitchen Unit Install', type: 'per_item', basePrice: 85, category: 'labour' },
  { id: '8', tradeId: 'electrical', name: 'Socket Point', type: 'per_item', basePrice: 85, category: 'electrical' },
  { id: '9', tradeId: 'roofing', name: 'Roof Covering', type: 'per_sqm', basePrice: 55, category: 'finish' },
  { id: '10', tradeId: 'flooring', name: 'Floor Laying', type: 'per_sqm', basePrice: 28, category: 'labour' },
  { id: '11', tradeId: 'painting', name: 'Emulsion per m²', type: 'per_sqm', basePrice: 12, category: 'finish' },
  { id: '12', tradeId: 'plastering', name: 'Skim Coat', type: 'per_sqm', basePrice: 18, category: 'finish' },
];
