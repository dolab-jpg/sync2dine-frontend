import type { TradeConfig } from '../types';
import { additionsStage, baseSurveySections, countStage, customerStage, DEFAULT_SITE_UPLIFTS, productPickerStage, siteConditionsStage, summaryStage } from './shared';

const additions = [
  { id: 'powerflush', name: 'Power Flush', price: 450 },
  { id: 'magnetic-filter', name: 'Magnetic Filter', price: 180 },
  { id: 'smart-thermostat', name: 'Smart Thermostat', price: 220 },
  { id: 'scale-reducer', name: 'Scale Reducer', price: 95 },
];

export const plumbingConfig: TradeConfig = {
  id: 'plumbing',
  name: 'Plumbing & Heating',
  icon: 'Flame',
  description: 'Boilers, radiators, pipework, and heating systems',
  measurementModes: ['count', 'rooms'],
  defaultLabourRate: 300,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    countStage('rooms', 'Rooms', 'Number of rooms to heat', 1, 15),
    {
      id: 'heating',
      title: 'Heating System',
      description: 'Boiler and radiator requirements',
      fields: [
        { key: 'boilerType', label: 'Boiler Type', type: 'select', options: [
          { value: 'combi', label: 'Combi Boiler', price: 2200 },
          { value: 'system', label: 'System Boiler', price: 2800 },
          { value: 'regular', label: 'Regular / Heat Only', price: 2400 },
          { value: 'service', label: 'Service Only', price: 120 },
        ], required: true },
        { key: 'radiators', label: 'Radiators to Replace', type: 'number', min: 0, max: 20 },
        { key: 'cylinder', label: 'Hot Water Cylinder', type: 'select', options: [
          { value: 'none', label: 'Not Required', price: 0 },
          { value: 'unvented', label: 'Unvented Cylinder', price: 1200 },
          { value: 'vented', label: 'Vented Cylinder', price: 650 },
        ]},
      ],
    },
    productPickerStage('Components', 'Select boiler and key components', [
      { key: 'boiler', label: 'Boiler Model', type: 'product-picker', productCategory: 'boiler' },
      { key: 'controls', label: 'Heating Controls', type: 'product-picker', productCategory: 'controls' },
    ]),
    additionsStage(additions),
    siteConditionsStage([
      { value: 'standard', label: 'Standard Swap', price: 0 },
      { value: 'heavy', label: 'Full System Repipe', price: 1200 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [
    { id: 'heating', label: 'Heating', categories: ['boiler', 'radiator', 'cylinder', 'controls'] },
    { id: 'plumbing', label: 'Plumbing', categories: ['pipe', 'valve', 'tap'] },
  ],
  pricingCategories: ['labour', 'plumbing', 'prep', 'feature'],
  surveySections: baseSurveySections(),
  labourRules: [
    { key: 'labourDays', description: 'Plumbing labour', rateType: 'per_day', baseRate: 300, formula: 'ceil(radiators/3)+2', dependsOn: ['radiators'] },
  ],
  additionsCatalog: additions,
  portfolioCategories: [
    { value: 'boilers', label: 'Boilers' },
    { value: 'bathrooms', label: 'Bathrooms' },
    { value: 'repairs', label: 'Leaks / Repairs' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'System drain down', phase: 'Prep', estimatedDays: 0.5 },
    { id: '2', name: 'Boiler installation', phase: 'Installation', estimatedDays: 1 },
    { id: '3', name: 'Radiator upgrades', phase: 'Installation', estimatedDays: 2 },
    { id: '4', name: 'Commissioning & gas safe cert', phase: 'Completion', estimatedDays: 0.5 },
  ],
  aiExtraction: {
    photoGuidance: ['Boiler data plate', 'Radiator types', 'Pipework visible'],
    promptContext: 'UK Gas Safe heating estimator. Identify boiler type, radiator count, cylinder presence, system age.',
    extractableFields: ['rooms', 'boilerType', 'radiators', 'cylinder'],
    lowConfidenceThreshold: 0.6,
  },
};
