import type { TradeConfig } from '../types';
import {
  additionsStage,
  composeSurveySections,
  customerStage,
  DEFAULT_SITE_UPLIFTS,
  finishPickerStage,
  measurementStage,
  productPickerStage,
  siteConditionsStage,
  summaryStage,
  SURVEY_CONDITION,
  SURVEY_YES_NO,
  SURVEY_YES_NO_UNKNOWN,
} from './shared';

const finishOptions = [
  { value: 'microcement-grey', label: 'Microcement - Grey', price: 85 },
  { value: 'microcement-white', label: 'Microcement - White', price: 85 },
  { value: 'microcement-beige', label: 'Microcement - Beige', price: 90 },
  { value: 'microcement-charcoal', label: 'Microcement - Charcoal', price: 95 },
  { value: 'tiles-marble', label: 'Marble Effect Tiles', price: 65 },
  { value: 'tiles-porcelain', label: 'Large Format Porcelain', price: 70 },
];

const additions = [
  { id: 'niche', name: 'Shower Niche', price: 180 },
  { id: 'shelf', name: 'Glass Shelf', price: 120 },
  { id: 'heated-rail', name: 'Heated Towel Rail', price: 320 },
  { id: 'mirror-cabinet', name: 'LED Mirror Cabinet', price: 280 },
  { id: 'floor-heating', name: 'Underfloor Heating', price: 450 },
  { id: 'lighting-led', name: 'LED Strip Lighting', price: 180 },
];

export const bathroomConfig: TradeConfig = {
  id: 'bathroom',
  name: 'Bathroom',
  icon: 'Bath',
  description: 'Bathroom renovation, wetrooms, and suite installations',
  measurementModes: ['area'],
  materialsRatePerSqm: 25,
  defaultLabourRate: 250,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    measurementStage('Measure the bathroom dimensions'),
    finishPickerStage('Finish', 'Choose wall & floor finish', finishOptions),
    productPickerStage('Products', 'Second fix products — first fix included in labour', [
      { key: 'toilet', label: 'Toilet', type: 'product-picker', productCategory: 'toilet' },
      { key: 'basin', label: 'Basin', type: 'product-picker', productCategory: 'basin' },
      { key: 'shower', label: 'Shower', type: 'product-picker', productCategory: 'shower' },
      { key: 'taps', label: 'Taps & Mixer', type: 'product-picker', productCategory: 'tap' },
    ]),
    additionsStage(additions),
    siteConditionsStage([
      { value: 'standard', label: 'Standard Bathroom', price: 450, description: '£450 disposal included' },
      { value: 'heavy', label: 'Heavy Removal', price: 750, description: 'Cast iron bath, heavy tiles' },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [
    { id: 'fixtures', label: 'Fixtures', categories: ['toilet', 'basin', 'shower', 'tap', 'bath', 'accessory'] },
    { id: 'finishes', label: 'Finishes', categories: ['tile', 'finish'] },
  ],
  pricingCategories: ['labour', 'finish', 'prep', 'electrical', 'plumbing', 'feature'],
  surveySections: composeSurveySections(
    [
      {
        id: 'condition',
        title: 'Room condition',
        fields: [
          { key: 'floorLevel', label: 'Floor level', type: 'select', options: [{ value: 'level', label: 'Level' }, { value: 'slight', label: 'Slightly uneven' }, { value: 'very', label: 'Very uneven' }], costAdjustment: { slight: 150, very: 400 }, riskWeight: 12 },
          { key: 'floorType', label: 'Floor construction', type: 'select', options: [{ value: 'concrete', label: 'Concrete' }, { value: 'timber', label: 'Timber joists' }] },
          { key: 'wallType', label: 'Wall type', type: 'select', options: [{ value: 'solid', label: 'Solid' }, { value: 'stud', label: 'Stud partition' }, { value: 'mixed', label: 'Mixed' }] },
          { key: 'dampMould', label: 'Damp / mould present?', type: 'select', options: SURVEY_YES_NO, costAdjustment: { yes: 350 }, riskWeight: 15 },
        ],
      },
      {
        id: 'plumbing',
        title: 'Plumbing',
        fields: [
          { key: 'fixturesMoving', label: 'Moving fixtures / waste positions?', type: 'select', options: SURVEY_YES_NO, costAdjustment: { yes: 800 }, riskWeight: 18 },
          { key: 'waterPressure', label: 'Water pressure', type: 'select', options: [{ value: 'good', label: 'Good' }, { value: 'average', label: 'Average' }, { value: 'poor', label: 'Poor' }], costAdjustment: { poor: 200 }, riskWeight: 8 },
          { key: 'systemType', label: 'Heating / hot water system', type: 'select', options: [{ value: 'combi', label: 'Combi' }, { value: 'gravity', label: 'Gravity / tank' }, { value: 'unvented', label: 'Unvented' }, { value: 'unknown', label: 'Unknown' }] },
          { key: 'pipeCondition', label: 'Visible pipe condition', type: 'select', options: SURVEY_CONDITION, costAdjustment: { poor: 300 }, riskWeight: 10 },
          { key: 'waterproofing', label: 'Existing waterproofing / tanking', type: 'select', options: SURVEY_YES_NO_UNKNOWN, costAdjustment: { no: 450 }, riskWeight: 14 },
        ],
      },
      {
        id: 'electrical-bath',
        title: 'Electrical (bathroom)',
        fields: [
          { key: 'extractorFan', label: 'Extractor fan present?', type: 'select', options: SURVEY_YES_NO, costAdjustment: { no: 180 }, riskWeight: 5 },
          { key: 'lightingCondition', label: 'Lighting condition', type: 'select', options: SURVEY_CONDITION },
          { key: 'cuCapacity', label: 'Spare consumer-unit capacity?', type: 'select', options: SURVEY_YES_NO_UNKNOWN, costAdjustment: { no: 250 }, riskWeight: 8 },
        ],
      },
    ],
    { photoLabel: 'Current bathroom condition' },
  ),
  labourRules: [
    { key: 'labourDays', description: 'Installation labour', rateType: 'per_day', baseRate: 250, formula: 'ceil(area/5)+2', dependsOn: ['area'] },
    { key: 'materials', description: 'Materials & first fix', rateType: 'per_sqm', baseRate: 25, dependsOn: ['area'] },
  ],
  additionsCatalog: additions,
  portfolioCategories: [
    { value: 'microcement', label: 'Microcement' },
    { value: 'tiles', label: 'Tiles' },
    { value: 'shower', label: 'Showers' },
    { value: 'complete', label: 'Complete Renovations' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Strip out existing suite', phase: 'Demolition', estimatedDays: 1 },
    { id: '2', name: 'First fix plumbing', phase: 'First Fix', estimatedDays: 2 },
    { id: '3', name: 'Waterproofing', phase: 'Prep', estimatedDays: 1 },
    { id: '4', name: 'Wall & floor finishes', phase: 'Finishes', estimatedDays: 3 },
    { id: '5', name: 'Second fix & commissioning', phase: 'Second Fix', estimatedDays: 1 },
  ],
  aiExtraction: {
    photoGuidance: ['Photograph all four corners', 'Include existing fixtures', 'Show floor and wall condition'],
    promptContext: 'UK bathroom renovation estimator. Identify suite type, approximate room size, water damage, tile condition, access constraints.',
    extractableFields: ['length', 'width', 'floorLocation', 'access', 'removal', 'finish'],
    lowConfidenceThreshold: 0.6,
  },
};
