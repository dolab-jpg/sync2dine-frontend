import type { TradeConfig } from '../types';
import {
  additionsStage,
  baseSurveySections,
  customerStage,
  DEFAULT_SITE_UPLIFTS,
  finishPickerStage,
  measurementStage,
  productPickerStage,
  siteConditionsStage,
  summaryStage,
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
  surveySections: [
    ...baseSurveySections(),
    {
      id: 'plumbing',
      title: 'Plumbing',
      fields: [
        { key: 'fixturesMoving', label: 'Moving Fixtures?', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }], costAdjustment: { yes: 800 } },
        { key: 'waterPressure', label: 'Water Pressure', type: 'select', options: [{ value: 'good', label: 'Good' }, { value: 'average', label: 'Average' }, { value: 'poor', label: 'Poor' }] },
        { key: 'waterproofing', label: 'Existing Waterproofing', type: 'select', options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'unknown', label: 'Unknown' }], costAdjustment: { no: 450 } },
      ],
    },
  ],
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
