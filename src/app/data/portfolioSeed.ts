import type { TradeId } from '../config/types';

export interface PortfolioProject {
  id: string;
  tradeId: TradeId;
  title: string;
  category: string;
  before: string;
  after: string;
  description: string;
  cost: string;
}

const PORTFOLIO_KEY = 'portfolioProjects';

export const PORTFOLIO_SEED: PortfolioProject[] = [
  // Bathroom (9 existing demos)
  {
    id: 'b1',
    tradeId: 'bathroom',
    title: 'Modern Microcement Bathroom',
    category: 'microcement',
    before: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400',
    after: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400',
    description: 'Complete renovation with grey microcement finish',
    cost: '£8,500',
  },
  {
    id: 'b2',
    tradeId: 'bathroom',
    title: 'Luxury Walk-in Shower',
    category: 'shower',
    before: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400',
    after: 'https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=400',
    description: 'Frameless glass walk-in shower with rainfall head',
    cost: '£6,200',
  },
  {
    id: 'b3',
    tradeId: 'bathroom',
    title: 'Contemporary Family Bathroom',
    category: 'complete',
    before: 'https://images.unsplash.com/photo-1585128792304-b8b2b15e2d23?w=400',
    after: 'https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=400',
    description: 'Full bathroom suite with wall-hung fixtures',
    cost: '£7,800',
  },
  {
    id: 'b4',
    tradeId: 'bathroom',
    title: 'Marble Effect Tiles',
    category: 'tiles',
    before: 'https://images.unsplash.com/photo-1590490360182-c33d57733427?w=400',
    after: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400',
    description: 'Large format marble effect porcelain tiles',
    cost: '£5,900',
  },
  {
    id: 'b5',
    tradeId: 'bathroom',
    title: 'White Microcement with Gold Fixtures',
    category: 'microcement',
    before: 'https://images.unsplash.com/photo-1563298723-dcfebaa392e3?w=400',
    after: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400',
    description: 'Luxury white microcement with brass fixtures',
    cost: '£12,400',
  },
  {
    id: 'b6',
    tradeId: 'bathroom',
    title: 'Compact En-suite',
    category: 'complete',
    before: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400',
    after: 'https://images.unsplash.com/photo-1604709177225-055f99402ea3?w=400',
    description: 'Space-saving en-suite with walk-in shower',
    cost: '£5,200',
  },
  {
    id: 'b7',
    tradeId: 'bathroom',
    title: 'Charcoal Microcement',
    category: 'microcement',
    before: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400',
    after: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=400',
    description: 'Dark charcoal microcement with matte black fixtures',
    cost: '£9,800',
  },
  {
    id: 'b8',
    tradeId: 'bathroom',
    title: 'Large Format Porcelain',
    category: 'tiles',
    before: 'https://images.unsplash.com/photo-1604014237800-1c9102c219da?w=400',
    after: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400',
    description: '1200x600mm porcelain tiles throughout',
    cost: '£7,600',
  },
  {
    id: 'b9',
    tradeId: 'bathroom',
    title: 'Wetroom Conversion',
    category: 'shower',
    before: 'https://images.unsplash.com/photo-1600566753151-384129cf4e3e?w=400',
    after: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400',
    description: 'Full wetroom with linear drainage',
    cost: '£11,200',
  },
  // Kitchen
  {
    id: 'k1',
    tradeId: 'kitchen',
    title: 'Handleless Grey Kitchen',
    category: 'full-kitchen',
    before: 'https://images.unsplash.com/photo-1556911220-bff31c812dba?w=400',
    after: 'https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=400',
    description: 'Full kitchen refit with quartz worktops and island',
    cost: '£18,500',
  },
  {
    id: 'k2',
    tradeId: 'kitchen',
    title: 'Quartz Island Worktop',
    category: 'worktops',
    before: 'https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=400',
    after: 'https://images.unsplash.com/photo-1600489000022-2089d068fefb?w=400',
    description: 'Waterfall edge quartz island with breakfast bar',
    cost: '£4,200',
  },
  {
    id: 'k3',
    tradeId: 'kitchen',
    title: 'Integrated Appliance Package',
    category: 'appliances',
    before: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400',
    after: 'https://images.unsplash.com/photo-1556909172-6c0c5b8c8c8c?w=400',
    description: 'Built-in oven, hob, fridge-freezer and dishwasher',
    cost: '£6,800',
  },
  // Electrical
  {
    id: 'e1',
    tradeId: 'electrical',
    title: 'Full House Rewire',
    category: 'rewire',
    before: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400',
    after: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400',
    description: 'Complete rewire with new consumer unit and certification',
    cost: '£4,500',
  },
  {
    id: 'e2',
    tradeId: 'electrical',
    title: 'Consumer Unit Upgrade',
    category: 'consumer-unit',
    before: 'https://images.unsplash.com/photo-1558002038-bb6c3b5e1b1a?w=400',
    after: 'https://images.unsplash.com/photo-1621905252507-b35492da74c5?w=400',
    description: '18-way RCBO board with surge protection',
    cost: '£850',
  },
  {
    id: 'e3',
    tradeId: 'electrical',
    title: 'EV Charger Installation',
    category: 'ev-smart',
    before: 'https://images.unsplash.com/photo-1593941707882-a5bba14938bc?w=400',
    after: 'https://images.unsplash.com/photo-1619642751034-765df691d287?w=400',
    description: '7kW home charger with smart scheduling',
    cost: '£1,150',
  },
  // Flooring
  {
    id: 'f1',
    tradeId: 'flooring',
    title: 'Luxury Vinyl Throughout',
    category: 'lvt',
    before: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400',
    after: 'https://images.unsplash.com/photo-1615529328331-f8917597711f?w=400',
    description: 'Waterproof LVT across ground floor — herringbone pattern',
    cost: '£3,800',
  },
  {
    id: 'f2',
    tradeId: 'flooring',
    title: 'Stair Carpet & Landing',
    category: 'carpet',
    before: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400',
    after: 'https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=400',
    description: 'Premium wool carpet with oak stair rods',
    cost: '£2,100',
  },
  {
    id: 'f3',
    tradeId: 'flooring',
    title: 'Full Ground Floor Refit',
    category: 'full-refit',
    before: 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400',
    after: 'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=400',
    description: 'Engineered wood living areas, tiles in kitchen and utility',
    cost: '£8,900',
  },
];

function migrateProject(p: PortfolioProject & { tradeId?: TradeId }): PortfolioProject {
  return { ...p, tradeId: p.tradeId ?? 'bathroom' };
}

export function loadPortfolioProjects(): PortfolioProject[] {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PortfolioProject[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const migrated = parsed.map(migrateProject);
        if (migrated.some((p, i) => p.tradeId !== parsed[i]?.tradeId)) {
          savePortfolioProjects(migrated);
        }
        return migrated;
      }
    }
  } catch {
    // fall through to seed
  }
  savePortfolioProjects(PORTFOLIO_SEED);
  return PORTFOLIO_SEED;
}

export function savePortfolioProjects(projects: PortfolioProject[]): void {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(projects));
}
