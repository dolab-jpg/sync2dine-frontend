import type { TradeId, RenderOptionGroup } from '../types';

export type { RenderOptionGroup };

const BATHROOM_RENDER: RenderOptionGroup[] = [
  {
    key: 'finish',
    label: 'Wall & Floor Finish',
    options: [
      { value: 'microcement-grey', label: 'Microcement Grey', color: '#808080' },
      { value: 'microcement-white', label: 'Microcement White', color: '#f5f5f5' },
      { value: 'microcement-charcoal', label: 'Microcement Charcoal', color: '#36454f' },
      { value: 'marble-white', label: 'White Marble Tiles', color: '#ffffff' },
    ],
  },
  {
    key: 'toilet',
    label: 'Toilet',
    options: [
      { value: 'wall-hung-white', label: 'Wall Hung White' },
      { value: 'back-to-wall', label: 'Back to Wall' },
      { value: 'close-coupled', label: 'Close Coupled' },
    ],
  },
  {
    key: 'basin',
    label: 'Basin',
    options: [
      { value: 'countertop-white', label: 'Countertop White' },
      { value: 'wall-hung', label: 'Wall Hung' },
      { value: 'vanity-unit', label: 'Vanity Unit' },
    ],
  },
  {
    key: 'shower',
    label: 'Shower',
    options: [
      { value: 'walk-in', label: 'Walk-in' },
      { value: 'enclosure', label: 'Enclosure' },
      { value: 'wet-room', label: 'Wet Room' },
    ],
  },
  {
    key: 'lighting',
    label: 'Lighting',
    options: [
      { value: 'recessed-led', label: 'Recessed LED' },
      { value: 'pendant', label: 'Pendant' },
      { value: 'backlit-mirror', label: 'Backlit Mirror' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    options: [
      { value: 'modern-luxury', label: 'Modern Luxury' },
      { value: 'minimalist', label: 'Minimalist' },
      { value: 'spa', label: 'Luxury Spa' },
    ],
  },
];

const KITCHEN_RENDER: RenderOptionGroup[] = [
  {
    key: 'finish',
    label: 'Worktop',
    options: [
      { value: 'quartz-white', label: 'Quartz White', color: '#f0f0f0' },
      { value: 'granite-black', label: 'Granite Black', color: '#2a2a2a' },
      { value: 'laminate-oak', label: 'Laminate Oak', color: '#c4a574' },
    ],
  },
  {
    key: 'units',
    label: 'Units',
    options: [
      { value: 'handleless-white', label: 'Handleless White' },
      { value: 'shaker-grey', label: 'Shaker Grey' },
      { value: 'oak-natural', label: 'Natural Oak' },
    ],
  },
  {
    key: 'splashback',
    label: 'Splashback',
    options: [
      { value: 'metro-tile', label: 'Metro Tile' },
      { value: 'glass', label: 'Glass' },
      { value: 'quartz', label: 'Quartz' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    options: [
      { value: 'modern', label: 'Modern' },
      { value: 'traditional', label: 'Traditional' },
      { value: 'industrial', label: 'Industrial' },
    ],
  },
];

const PAINTING_RENDER: RenderOptionGroup[] = [
  {
    key: 'finish',
    label: 'Paint Finish',
    options: [
      { value: 'emulsion-matte', label: 'Matte Emulsion', color: '#e8e4df' },
      { value: 'emulsion-satin', label: 'Satin Emulsion', color: '#d4cfc8' },
      { value: 'feature-wall', label: 'Feature Wall', color: '#2c5282' },
    ],
  },
  {
    key: 'colour',
    label: 'Colour Scheme',
    options: [
      { value: 'neutral', label: 'Neutral Tones' },
      { value: 'warm', label: 'Warm Palette' },
      { value: 'cool', label: 'Cool Palette' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    options: [
      { value: 'contemporary', label: 'Contemporary' },
      { value: 'heritage', label: 'Heritage' },
      { value: 'scandi', label: 'Scandinavian' },
    ],
  },
];

const DEFAULT_RENDER: RenderOptionGroup[] = [
  {
    key: 'finish',
    label: 'Finish',
    options: [
      { value: 'standard', label: 'Standard', color: '#a0a0a0' },
      { value: 'premium', label: 'Premium', color: '#606060' },
      { value: 'luxury', label: 'Luxury', color: '#303030' },
    ],
  },
  {
    key: 'style',
    label: 'Style',
    options: [
      { value: 'modern', label: 'Modern' },
      { value: 'traditional', label: 'Traditional' },
      { value: 'contemporary', label: 'Contemporary' },
    ],
  },
];

const TRADE_RENDER_OPTIONS: Partial<Record<TradeId, RenderOptionGroup[]>> = {
  bathroom: BATHROOM_RENDER,
  kitchen: KITCHEN_RENDER,
  painting: PAINTING_RENDER,
  flooring: [
    {
      key: 'finish',
      label: 'Flooring',
      options: [
        { value: 'laminate', label: 'Laminate', color: '#c9a66b' },
        { value: 'lvt', label: 'Luxury Vinyl', color: '#8b7355' },
        { value: 'carpet', label: 'Carpet', color: '#d4c4b0' },
      ],
    },
    { key: 'style', label: 'Style', options: [{ value: 'modern', label: 'Modern' }, { value: 'rustic', label: 'Rustic' }] },
  ],
  landscaping: [
    {
      key: 'surfaceType',
      label: 'Surface',
      options: [
        { value: 'patio', label: 'Patio Slabs', color: '#9ca3af' },
        { value: 'decking', label: 'Decking', color: '#a67c52' },
        { value: 'gravel', label: 'Gravel', color: '#d1d5db' },
      ],
    },
    { key: 'style', label: 'Style', options: [{ value: 'contemporary', label: 'Contemporary' }, { value: 'cottage', label: 'Cottage Garden' }] },
  ],
};

export function getRenderOptionsForTrade(tradeId: TradeId): RenderOptionGroup[] {
  return TRADE_RENDER_OPTIONS[tradeId] ?? DEFAULT_RENDER;
}

export function getDefaultRenderSettings(tradeId: TradeId): Record<string, string> {
  const groups = getRenderOptionsForTrade(tradeId);
  const settings: Record<string, string> = {};
  for (const g of groups) {
    settings[g.key] = g.options[0]?.value ?? '';
  }
  return settings;
}
