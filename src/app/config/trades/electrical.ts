import type { TradeConfig } from '../types';
import { additionsStage, baseSurveySections, countStage, customerStage, DEFAULT_SITE_UPLIFTS, siteConditionsStage, summaryStage } from './shared';

const additions = [
  { id: 'rcd-upgrade', name: 'RCD Protection Upgrade', price: 350 },
  { id: 'smart-home', name: 'Smart Home Hub Setup', price: 480 },
  { id: 'ev-charger', name: 'EV Charger Installation', price: 950 },
  { id: 'outdoor-sockets', name: 'Outdoor Sockets (pair)', price: 180 },
];

export const electricalConfig: TradeConfig = {
  id: 'electrical',
  name: 'Electrical',
  icon: 'Zap',
  description: 'Rewires, consumer units, sockets, lighting, and certification',
  measurementModes: ['count', 'rooms'],
  defaultLabourRate: 320,
  siteUplifts: { ...DEFAULT_SITE_UPLIFTS, removal: { partial: 0, full_rewire: 200, consumer_unit: 150 } },
  wizardStages: [
    customerStage(),
    countStage('rooms', 'Rooms', 'Number of rooms in scope', 1, 20),
    {
      id: 'scope',
      title: 'Scope',
      description: 'Define electrical work required',
      fields: [
        { key: 'jobType', label: 'Job Type', type: 'select', options: [
          { value: 'partial', label: 'Partial Upgrade', price: 0 },
          { value: 'full_rewire', label: 'Full Rewire', price: 3500 },
          { value: 'consumer_unit', label: 'Consumer Unit Only', price: 650 },
          { value: 'eicr_remedial', label: 'EICR Remedial', price: 450 },
        ], required: true },
        { key: 'sockets', label: 'Additional Sockets', type: 'number', min: 0, max: 50 },
        { key: 'lights', label: 'Light Points', type: 'number', min: 0, max: 50 },
        { key: 'consumerUnit', label: 'Consumer Unit', type: 'select', options: [
          { value: 'none', label: 'No Change', price: 0 },
          { value: 'standard', label: 'Standard 10-way', price: 450 },
          { value: 'high-amp', label: 'High Amp / EV Ready', price: 750 },
        ]},
      ],
    },
    additionsStage(additions),
    siteConditionsStage([
      { value: 'partial', label: 'Partial Access', price: 0 },
      { value: 'full_rewire', label: 'Full Property Access', price: 200 },
      { value: 'consumer_unit', label: 'CU Replacement Only', price: 150 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [
    { id: 'electrical', label: 'Electrical', categories: ['consumer-unit', 'socket', 'switch', 'lighting', 'cable'] },
  ],
  pricingCategories: ['labour', 'electrical', 'prep', 'certification'],
  surveySections: [
    ...baseSurveySections(),
    {
      id: 'electrical',
      title: 'Electrical Condition',
      fields: [
        { key: 'consumerUnit', label: 'Consumer Unit Age', type: 'select', options: [
          { value: 'modern', label: 'Modern (< 10 years)' },
          { value: 'old', label: 'Old fuse board' },
          { value: 'unknown', label: 'Unknown' },
        ], costAdjustment: { old: 650 } },
        { key: 'rcdProtection', label: 'RCD Protection', type: 'select', options: [
          { value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }, { value: 'partial', label: 'Partial' },
        ], costAdjustment: { no: 350, partial: 200 } },
      ],
    },
  ],
  labourRules: [
    { key: 'labourDays', description: 'Electrical labour', rateType: 'per_day', baseRate: 320, formula: 'rooms*1.5+1', dependsOn: ['rooms'] },
  ],
  additionsCatalog: additions,
  portfolioCategories: [
    { value: 'rewire', label: 'Rewires' },
    { value: 'consumer-unit', label: 'Consumer Units' },
    { value: 'lighting', label: 'Lighting' },
    { value: 'ev-smart', label: 'EV / Smart' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'EICR / initial assessment', phase: 'Survey', estimatedDays: 0.5 },
    { id: '2', name: 'First fix cabling', phase: 'First Fix', estimatedDays: 3 },
    { id: '3', name: 'Consumer unit installation', phase: 'Installation', estimatedDays: 1 },
    { id: '4', name: 'Second fix & testing', phase: 'Second Fix', estimatedDays: 2 },
    { id: '5', name: 'Certification & handover', phase: 'Completion', estimatedDays: 0.5 },
  ],
  aiExtraction: {
    photoGuidance: ['Consumer unit label and fuses', 'Socket and switch condition', 'Visible wiring'],
    promptContext: 'UK qualified electrician estimator. Assess consumer unit type, approximate socket count, visible wiring age, RCD presence.',
    extractableFields: ['rooms', 'jobType', 'consumerUnit', 'sockets', 'lights'],
    lowConfidenceThreshold: 0.55,
  },
};
