import type { TradeConfig } from '../types';
import { additionsStage, baseSurveySections, customerStage, DEFAULT_SITE_UPLIFTS, finishPickerStage, measurementStage, productPickerStage, siteConditionsStage, summaryStage } from './shared';

const finishOptions = [
  { value: 'laminate', label: 'Laminate Worktop', price: 45 },
  { value: 'quartz', label: 'Quartz Worktop', price: 120 },
  { value: 'granite', label: 'Granite Worktop', price: 150 },
  { value: 'solid-wood', label: 'Solid Wood', price: 95 },
];

const additions = [
  { id: 'island', name: 'Kitchen Island', price: 2500 },
  { id: 'splashback', name: 'Glass Splashback', price: 680 },
  { id: 'soft-close', name: 'Soft-Close Upgrade (all doors)', price: 420 },
  { id: 'led-lights', name: 'Under-cabinet LED Lighting', price: 280 },
  { id: 'waste-disposal', name: 'Waste Disposal Unit', price: 350 },
];

export const kitchenConfig: TradeConfig = {
  id: 'kitchen',
  name: 'Kitchen',
  icon: 'ChefHat',
  description: 'Kitchen design, units, worktops, and appliance installation',
  measurementModes: ['area', 'linear'],
  materialsRatePerSqm: 35,
  defaultLabourRate: 280,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    measurementStage('Measure kitchen floor area and note layout'),
    finishPickerStage('Worktop', 'Select worktop material', finishOptions),
    productPickerStage('Units & Appliances', 'Select kitchen units and appliances', [
      { key: 'baseUnits', label: 'Base Units', type: 'product-picker', productCategory: 'base-unit' },
      { key: 'wallUnits', label: 'Wall Units', type: 'product-picker', productCategory: 'wall-unit' },
      { key: 'appliance', label: 'Appliance Package', type: 'product-picker', productCategory: 'appliance' },
      { key: 'sink', label: 'Sink & Tap', type: 'product-picker', productCategory: 'sink' },
    ]),
    additionsStage(additions),
    siteConditionsStage([
      { value: 'light', label: 'Light Strip-out', price: 250 },
      { value: 'standard', label: 'Standard Kitchen', price: 450 },
      { value: 'heavy', label: 'Heavy Removal', price: 750 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [
    { id: 'units', label: 'Units', categories: ['base-unit', 'wall-unit', 'tall-unit'] },
    { id: 'appliances', label: 'Appliances', categories: ['appliance', 'sink', 'tap', 'extractor'] },
    { id: 'worktops', label: 'Worktops', categories: ['worktop', 'splashback'] },
  ],
  pricingCategories: ['labour', 'finish', 'prep', 'electrical', 'plumbing', 'feature'],
  surveySections: baseSurveySections(),
  labourRules: [
    { key: 'labourDays', description: 'Kitchen installation', rateType: 'per_day', baseRate: 280, formula: 'ceil(area/4)+3', dependsOn: ['area'] },
    { key: 'materials', description: 'Fixings & materials', rateType: 'per_sqm', baseRate: 35, dependsOn: ['area'] },
  ],
  additionsCatalog: additions,
  portfolioCategories: [
    { value: 'units', label: 'Units' },
    { value: 'worktops', label: 'Worktops' },
    { value: 'appliances', label: 'Appliances' },
    { value: 'full-kitchen', label: 'Full Kitchen' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Strip out old kitchen', phase: 'Demolition', estimatedDays: 1 },
    { id: '2', name: 'First fix plumbing & electrics', phase: 'First Fix', estimatedDays: 2 },
    { id: '3', name: 'Fit base and wall units', phase: 'Installation', estimatedDays: 3 },
    { id: '4', name: 'Worktop templating & fitting', phase: 'Finishes', estimatedDays: 2 },
    { id: '5', name: 'Appliance commissioning', phase: 'Second Fix', estimatedDays: 1 },
  ],
  aiExtraction: {
    photoGuidance: ['Full kitchen overview', 'Worktop and units close-up', 'Appliance locations'],
    promptContext: 'UK kitchen fitter estimator. Identify layout (galley, L-shape, U-shape), unit count, worktop material, appliance positions.',
    extractableFields: ['length', 'width', 'floorLocation', 'access', 'removal', 'finish'],
    lowConfidenceThreshold: 0.6,
  },
};
