import type { TradeConfig } from '../types';
import { additionsStage, baseSurveySections, customerStage, DEFAULT_SITE_UPLIFTS, finishPickerStage, measurementStage, siteConditionsStage, summaryStage } from './shared';

const finishOptions = [
  { value: 'concrete-tile', label: 'Concrete Tiles', price: 55 },
  { value: 'slate', label: 'Natural Slate', price: 95 },
  { value: 'flat-epdm', label: 'Flat Roof EPDM', price: 75 },
  { value: 'flat-felt', label: 'Flat Roof Felt', price: 45 },
];

const additions = [
  { id: 'scaffolding', name: 'Scaffolding (full)', price: 1200 },
  { id: 'guttering', name: 'New Guttering (full house)', price: 850 },
  { id: 'fascia-soffit', name: 'Fascia & Soffit Replacement', price: 1400 },
  { id: 'chimney', name: 'Chimney Repoint / Repair', price: 650 },
];

export const roofingConfig: TradeConfig = {
  id: 'roofing',
  name: 'Roofing',
  icon: 'Home',
  description: 'Roof repairs, re-tiling, flat roofs, guttering, and scaffolding',
  measurementModes: ['area'],
  materialsRatePerSqm: 18,
  defaultLabourRate: 280,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    measurementStage('Measure roof area (or footprint × pitch factor)'),
    finishPickerStage('Covering', 'Select roof covering', finishOptions),
    {
      id: 'scope',
      title: 'Scope',
      fields: [
        { key: 'roofType', label: 'Roof Type', type: 'select', options: [
          { value: 'pitched', label: 'Pitched', price: 0 },
          { value: 'flat', label: 'Flat', price: 0 },
          { value: 'mixed', label: 'Mixed', price: 200 },
        ]},
        { key: 'layers', label: 'Stripping Layers', type: 'select', options: [
          { value: 'single', label: 'Single Layer', price: 0 },
          { value: 'double', label: 'Double Layer', price: 350 },
        ]},
      ],
    },
    additionsStage(additions),
    siteConditionsStage([
      { value: 'standard', label: 'Standard Access', price: 450 },
      { value: 'heavy', label: 'Difficult / Steep Pitch', price: 750 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [{ id: 'roofing', label: 'Roofing', categories: ['tile', 'slate', 'membrane', 'gutter', 'fascia'] }],
  pricingCategories: ['labour', 'finish', 'prep', 'feature'],
  surveySections: baseSurveySections(),
  labourRules: [
    { key: 'labourDays', description: 'Roofing labour', rateType: 'per_day', baseRate: 280, formula: 'ceil(area/15)+2', dependsOn: ['area'] },
    { key: 'materials', description: 'Roofing materials', rateType: 'per_sqm', baseRate: 18, dependsOn: ['area'] },
  ],
  additionsCatalog: additions,
  portfolioCategories: [
    { value: 'flat', label: 'Flat Roof' },
    { value: 'pitched', label: 'Pitched' },
    { value: 'guttering', label: 'Guttering' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Scaffold erection', phase: 'Prep', estimatedDays: 1 },
    { id: '2', name: 'Strip existing covering', phase: 'Demolition', estimatedDays: 2 },
    { id: '3', name: 'Membrane & battens', phase: 'First Fix', estimatedDays: 2 },
    { id: '4', name: 'Tile / slate laying', phase: 'Installation', estimatedDays: 4 },
    { id: '5', name: 'Guttering & cleanup', phase: 'Completion', estimatedDays: 1 },
  ],
  aiExtraction: {
    photoGuidance: ['Full roof elevation', 'Close-up of tiles/slate', 'Guttering and fascia'],
    promptContext: 'UK roofing estimator. Identify covering type, pitch, visible damage, chimney, gutter condition.',
    extractableFields: ['area', 'finish', 'roofType', 'removal'],
    lowConfidenceThreshold: 0.55,
  },
};
