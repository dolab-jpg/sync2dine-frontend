import type { TradeConfig } from '../types';
import {
  additionsStage,
  composeSurveySections,
  countStage,
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

export const flooringConfig: TradeConfig = {
  id: 'flooring',
  name: 'Flooring',
  icon: 'Layers',
  description: 'Carpet, laminate, vinyl, tile, and subfloor preparation',
  measurementModes: ['area'],
  materialsRatePerSqm: 12,
  defaultLabourRate: 200,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    measurementStage('Measure total floor area'),
    finishPickerStage('Flooring Type', 'Select flooring material', [
      { value: 'carpet', label: 'Carpet', price: 35 },
      { value: 'laminate', label: 'Laminate', price: 28 },
      { value: 'lvt', label: 'Luxury Vinyl (LVT)', price: 42 },
      { value: 'tile', label: 'Floor Tiles', price: 55 },
      { value: 'engineered-wood', label: 'Engineered Wood', price: 65 },
    ]),
    {
      id: 'prep',
      title: 'Subfloor Prep',
      fields: [
        { key: 'subfloor', label: 'Subfloor Condition', type: 'select', options: [
          { value: 'good', label: 'Good — direct lay', price: 0 },
          { value: 'level', label: 'Needs levelling', price: 15 },
          { value: 'replace', label: 'Board replacement', price: 28 },
        ]},
        { key: 'rooms', label: 'Number of Rooms', type: 'number', min: 1, max: 15 },
      ],
    },
    additionsStage([
      { id: 'door-trim', name: 'Door Trims (all doors)', price: 180 },
      { id: 'underlay-premium', name: 'Premium Underlay', price: 8 },
      { id: 'stair-run', name: 'Stair Run', price: 450 },
    ]),
    siteConditionsStage([
      { value: 'standard', label: 'Standard', price: 150 },
      { value: 'heavy', label: 'Furniture move / clear', price: 350 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [{ id: 'flooring', label: 'Flooring', categories: ['carpet', 'laminate', 'lvt', 'tile', 'underlay', 'trim'] }],
  pricingCategories: ['labour', 'finish', 'prep'],
  surveySections: composeSurveySections(
    [
      {
        id: 'subfloor',
        title: 'Subfloor & rooms',
        fields: [
          {
            key: 'subfloor',
            label: 'Subfloor condition',
            type: 'select',
            options: [
              { value: 'good', label: 'Good — direct lay' },
              { value: 'level', label: 'Needs levelling' },
              { value: 'replace', label: 'Board replacement' },
            ],
            costAdjustment: { level: 200, replace: 450 },
            riskWeight: 12,
          },
          { key: 'rooms', label: 'Number of rooms', type: 'number', min: 1, max: 20, required: true },
          {
            key: 'existingFloor',
            label: 'Existing floor type',
            type: 'select',
            options: [
              { value: 'carpet', label: 'Carpet' },
              { value: 'laminate', label: 'Laminate / wood' },
              { value: 'tile', label: 'Tile' },
              { value: 'vinyl', label: 'Vinyl' },
              { value: 'concrete', label: 'Bare concrete' },
            ],
          },
          {
            key: 'stairsIncluded',
            label: 'Stairs included?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 450 },
            riskWeight: 8,
          },
          {
            key: 'furnitureMove',
            label: 'Furniture move required?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 200 },
            riskWeight: 5,
          },
        ],
      },
    ],
    { includeHeight: false, photoLabel: 'Floors and thresholds' },
  ),
  labourRules: [
    { key: 'labourDays', description: 'Flooring labour', rateType: 'per_day', baseRate: 200, formula: 'ceil(area/20)+1', dependsOn: ['area'] },
    { key: 'materials', description: 'Adhesives & underlay', rateType: 'per_sqm', baseRate: 12, dependsOn: ['area'] },
  ],
  additionsCatalog: [],
  portfolioCategories: [
    { value: 'carpet', label: 'Carpet' },
    { value: 'lvt', label: 'LVT' },
    { value: 'tiles', label: 'Tiles' },
    { value: 'full-refit', label: 'Full Refit' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Furniture move & protect', phase: 'Prep' },
    { id: '2', name: 'Subfloor preparation', phase: 'Prep' },
    { id: '3', name: 'Floor laying', phase: 'Installation' },
    { id: '4', name: 'Trims & finishing', phase: 'Completion' },
  ],
  aiExtraction: {
    photoGuidance: ['Full room floor', 'Subfloor close-up', 'Door thresholds'],
    promptContext: 'UK flooring estimator. Identify existing floor type, subfloor condition, room size.',
    extractableFields: ['length', 'width', 'finish', 'subfloor', 'rooms'],
    lowConfidenceThreshold: 0.6,
  },
};

export const paintingConfig: TradeConfig = {
  id: 'painting',
  name: 'Painting & Decorating',
  icon: 'Paintbrush',
  description: 'Interior and exterior painting, wallpaper, and preparation',
  measurementModes: ['area', 'rooms'],
  materialsRatePerSqm: 8,
  defaultLabourRate: 180,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    countStage('rooms', 'Rooms', 'Number of rooms to decorate', 1, 20),
    measurementStage('Measure wall/ceiling area (or use room count estimate)'),
    finishPickerStage('Finish', 'Paint specification', [
      { value: 'standard-emulsion', label: 'Standard Emulsion', price: 12 },
      { value: 'premium-emulsion', label: 'Premium Emulsion', price: 18 },
      { value: 'eggshell', label: 'Eggshell / Kitchen/Bath', price: 22 },
      { value: 'wallpaper', label: 'Wallpaper Hanging', price: 35 },
    ]),
    {
      id: 'prep',
      title: 'Preparation',
      fields: [
        { key: 'prepLevel', label: 'Prep Required', type: 'select', options: [
          { value: 'light', label: 'Light — wash & fill', price: 5 },
          { value: 'medium', label: 'Medium — sand & fill', price: 12 },
          { value: 'heavy', label: 'Heavy — strip & repair', price: 22 },
        ]},
        { key: 'coats', label: 'Coats', type: 'number', min: 1, max: 4 },
      ],
    },
    additionsStage([
      { id: 'ceiling', name: 'Ceiling Included', price: 0 },
      { id: 'woodwork', name: 'All Woodwork (skirting, doors)', price: 350 },
      { id: 'exterior', name: 'Exterior Masonry', price: 850 },
    ]),
    siteConditionsStage([
      { value: 'standard', label: 'Clear Rooms', price: 0 },
      { value: 'heavy', label: 'Occupied / Furniture', price: 200 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [{ id: 'paint', label: 'Paint & Paper', categories: ['paint', 'wallpaper', 'primer'] }],
  pricingCategories: ['labour', 'finish', 'prep'],
  surveySections: composeSurveySections(
    [
      {
        id: 'decorate',
        title: 'Decoration scope',
        fields: [
          { key: 'rooms', label: 'Rooms in scope', type: 'number', min: 1, max: 30, required: true },
          {
            key: 'interiorExterior',
            label: 'Interior / exterior',
            type: 'select',
            options: [
              { value: 'interior', label: 'Interior only' },
              { value: 'exterior', label: 'Exterior only' },
              { value: 'both', label: 'Both' },
            ],
            costAdjustment: { exterior: 300, both: 400 },
            riskWeight: 8,
          },
          {
            key: 'prepLevel',
            label: 'Surface prep needed',
            type: 'select',
            options: [
              { value: 'light', label: 'Light' },
              { value: 'medium', label: 'Medium (fill / sand)' },
              { value: 'heavy', label: 'Heavy (strip / repair)' },
            ],
            costAdjustment: { medium: 180, heavy: 450 },
            riskWeight: 12,
          },
          {
            key: 'wallpaper',
            label: 'Wallpaper hanging / stripping?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 250 },
            riskWeight: 6,
          },
          {
            key: 'ceilingHeight',
            label: 'High ceilings / stairwell?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 200 },
            riskWeight: 8,
          },
        ],
      },
    ],
    { photoLabel: 'Rooms to decorate' },
  ),
  labourRules: [
    { key: 'labourDays', description: 'Decorating labour', rateType: 'per_day', baseRate: 180, formula: 'ceil(area/25)+rooms*0.5', dependsOn: ['area', 'rooms'] },
  ],
  additionsCatalog: [],
  portfolioCategories: [
    { value: 'interior', label: 'Interior' },
    { value: 'exterior', label: 'Exterior' },
    { value: 'wallpaper', label: 'Wallpaper' },
    { value: 'full-decor', label: 'Full Decor' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Protection & prep', phase: 'Prep' },
    { id: '2', name: 'Priming', phase: 'Prep' },
    { id: '3', name: 'Painting — walls', phase: 'Decoration' },
    { id: '4', name: 'Woodwork & finishing', phase: 'Completion' },
  ],
  aiExtraction: {
    photoGuidance: ['All walls in room', 'Ceiling condition', 'Woodwork detail'],
    promptContext: 'UK painter decorator estimator. Assess wall condition, cracks, wallpaper, room size.',
    extractableFields: ['rooms', 'length', 'width', 'prepLevel', 'finish'],
    lowConfidenceThreshold: 0.6,
  },
};

export const plasteringConfig: TradeConfig = {
  id: 'plastering',
  name: 'Plastering',
  icon: 'Square',
  description: 'Skimming, boarding, rendering, and patch repairs',
  measurementModes: ['area'],
  materialsRatePerSqm: 6,
  defaultLabourRate: 220,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    measurementStage('Measure wall or ceiling area (m²)'),
    finishPickerStage('Plaster Type', 'Select plaster specification', [
      { value: 'skim', label: 'Skim Coat (over existing)', price: 18 },
      { value: 'board', label: 'Plasterboard & Skim', price: 32 },
      { value: 'render', label: 'External Render', price: 45 },
      { value: 'patch', label: 'Patch Repair', price: 25 },
    ]),
    additionsStage([
      { id: 'coving', name: 'Coving (per room)', price: 120 },
      { id: 'artex-remove', name: 'Artex Removal', price: 15 },
    ]),
    siteConditionsStage([
      { value: 'standard', label: 'Standard', price: 0 },
      { value: 'heavy', label: 'Extensive hack-off', price: 400 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [{ id: 'plaster', label: 'Plastering', categories: ['plaster', 'board', 'bead', 'mesh'] }],
  pricingCategories: ['labour', 'finish', 'prep'],
  surveySections: composeSurveySections(
    [
      {
        id: 'plaster',
        title: 'Plastering scope',
        fields: [
          {
            key: 'workType',
            label: 'Work type',
            type: 'select',
            options: [
              { value: 'skim', label: 'Skim existing' },
              { value: 'board', label: 'Board & skim' },
              { value: 'repair', label: 'Patch / repair' },
              { value: 'dotdash', label: 'Dot & dab' },
            ],
          },
          {
            key: 'substrate',
            label: 'Substrate condition',
            type: 'select',
            options: SURVEY_CONDITION,
            costAdjustment: { poor: 280 },
            riskWeight: 12,
          },
          {
            key: 'dampIssues',
            label: 'Damp / salt issues?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 400 },
            riskWeight: 16,
          },
          {
            key: 'ceilingsIncluded',
            label: 'Ceilings included?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 220 },
            riskWeight: 6,
          },
        ],
      },
    ],
    { photoLabel: 'Walls and substrate' },
  ),
  labourRules: [
    { key: 'labourDays', description: 'Plastering labour', rateType: 'per_day', baseRate: 220, formula: 'ceil(area/30)+1', dependsOn: ['area'] },
  ],
  additionsCatalog: [],
  portfolioCategories: [
    { value: 'skim', label: 'Skimming' },
    { value: 'boarding', label: 'Boarding' },
    { value: 'render', label: 'Rendering' },
    { value: 'repairs', label: 'Patch Repairs' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Preparation & bonding', phase: 'Prep' },
    { id: '2', name: 'Boarding (if required)', phase: 'First Fix' },
    { id: '3', name: 'Skim / render application', phase: 'Installation' },
    { id: '4', name: 'Drying & finishing', phase: 'Completion' },
  ],
  aiExtraction: {
    photoGuidance: ['Wall surface close-up', 'Cracks and damage', 'Room overview'],
    promptContext: 'UK plasterer estimator. Identify surface type, cracks, artex, approximate area.',
    extractableFields: ['length', 'width', 'finish', 'removal'],
    lowConfidenceThreshold: 0.6,
  },
};

export const extensionsConfig: TradeConfig = {
  id: 'extensions',
  name: 'Extensions / Building',
  icon: 'Building2',
  description: 'Single and double storey extensions, structural work, and finishes',
  measurementModes: ['area'],
  materialsRatePerSqm: 85,
  defaultLabourRate: 350,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    measurementStage('Measure extension footprint'),
    {
      id: 'spec',
      title: 'Specification',
      fields: [
        { key: 'storeys', label: 'Storeys', type: 'select', options: [
          { value: 'single', label: 'Single Storey', price: 1800 },
          { value: 'double', label: 'Double Storey', price: 2800 },
        ]},
        { key: 'specLevel', label: 'Specification', type: 'select', options: [
          { value: 'standard', label: 'Standard', price: 0 },
          { value: 'premium', label: 'Premium Finishes', price: 500 },
          { value: 'luxury', label: 'Luxury', price: 1200 },
        ]},
        { key: 'foundations', label: 'Foundation Type', type: 'select', options: [
          { value: 'strip', label: 'Strip Foundations', price: 0 },
          { value: 'raft', label: 'Raft Slab', price: 800 },
          { value: 'piled', label: 'Piled', price: 3500 },
        ]},
      ],
    },
    additionsStage([
      { id: 'bi-fold', name: 'Bi-fold Doors', price: 4500 },
      { id: 'roof-lantern', name: 'Roof Lantern', price: 2800 },
      { id: 'underfloor-heating', name: 'Underfloor Heating', price: 1200 },
    ]),
    siteConditionsStage([
      { value: 'standard', label: 'Good Access', price: 0 },
      { value: 'heavy', label: 'Restricted Site', price: 1500 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [{ id: 'building', label: 'Building', categories: ['structure', 'window', 'door', 'insulation', 'roof'] }],
  pricingCategories: ['labour', 'prep', 'feature', 'structural'],
  surveySections: composeSurveySections(
    [
      {
        id: 'extension',
        title: 'Extension survey',
        fields: [
          {
            key: 'storeys',
            label: 'Proposed storeys',
            type: 'select',
            options: [
              { value: 'single', label: 'Single storey' },
              { value: 'double', label: 'Two storey' },
              { value: 'wrap', label: 'Wrap-around / complex' },
            ],
            costAdjustment: { double: 2000, wrap: 3500 },
            riskWeight: 14,
          },
          {
            key: 'planningStatus',
            label: 'Planning / permitted development status',
            type: 'select',
            options: [
              { value: 'approved', label: 'Approved' },
              { value: 'pd', label: 'Permitted development' },
              { value: 'needed', label: 'Application needed' },
              { value: 'unknown', label: 'Unknown' },
            ],
            costAdjustment: { needed: 800 },
            riskWeight: 12,
          },
          {
            key: 'groundCondition',
            label: 'Ground / foundation concerns?',
            type: 'select',
            options: SURVEY_YES_NO_UNKNOWN,
            costAdjustment: { yes: 1500 },
            riskWeight: 18,
          },
          {
            key: 'partyWall',
            label: 'Party wall likely?',
            type: 'select',
            options: SURVEY_YES_NO_UNKNOWN,
            costAdjustment: { yes: 900 },
            riskWeight: 10,
          },
          {
            key: 'drainage',
            label: 'Drainage / sewers crossing plot?',
            type: 'select',
            options: SURVEY_YES_NO_UNKNOWN,
            costAdjustment: { yes: 1200 },
            riskWeight: 14,
          },
        ],
      },
    ],
    { includeHeight: false, photoLabel: 'Proposed build area' },
  ),
  labourRules: [
    { key: 'labourDays', description: 'Building labour', rateType: 'per_day', baseRate: 350, formula: 'ceil(area/8)+10', dependsOn: ['area'] },
    { key: 'materials', description: 'Build materials', rateType: 'per_sqm', baseRate: 85, dependsOn: ['area'] },
  ],
  additionsCatalog: [],
  portfolioCategories: [
    { value: 'single-storey', label: 'Single Storey' },
    { value: 'double-storey', label: 'Double Storey' },
    { value: 'structural', label: 'Structural' },
    { value: 'full-build', label: 'Full Build' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Foundations', phase: 'Groundworks' },
    { id: '2', name: 'Superstructure', phase: 'Structure' },
    { id: '3', name: 'Roof & weatherproof', phase: 'Structure' },
    { id: '4', name: 'First & second fix', phase: 'Finishes' },
    { id: '5', name: 'Snagging & sign-off', phase: 'Completion' },
  ],
  aiExtraction: {
    photoGuidance: ['Rear elevation', 'Garden access', 'Existing structure junction'],
    promptContext: 'UK extension builder estimator. Estimate footprint, storeys, access, foundation needs.',
    extractableFields: ['length', 'width', 'storeys', 'specLevel', 'access'],
    lowConfidenceThreshold: 0.5,
  },
};

export const windowsConfig: TradeConfig = {
  id: 'windows',
  name: 'Windows & Doors',
  icon: 'DoorOpen',
  description: 'uPVC, aluminium, timber windows and external doors',
  measurementModes: ['count'],
  defaultLabourRate: 250,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    {
      id: 'counts',
      title: 'Counts',
      fields: [
        { key: 'windows', label: 'Windows', type: 'number', min: 1, max: 30, required: true },
        { key: 'doors', label: 'External Doors', type: 'number', min: 0, max: 10 },
      ],
    },
    finishPickerStage('Material', 'Frame material', [
      { value: 'upvc', label: 'uPVC', price: 450 },
      { value: 'aluminium', label: 'Aluminium', price: 750 },
      { value: 'timber', label: 'Timber', price: 950 },
    ]),
    productPickerStage('Products', 'Select window/door styles', [
      { key: 'windowStyle', label: 'Window Style', type: 'product-picker', productCategory: 'window' },
      { key: 'doorStyle', label: 'Door Style', type: 'product-picker', productCategory: 'door' },
    ]),
    additionsStage([
      { id: 'trickle-vents', name: 'Trickle Vents (all)', price: 180 },
      { id: 'sash-horns', name: 'Sash Horns / Astragal', price: 350 },
    ]),
    siteConditionsStage([
      { value: 'standard', label: 'Standard Fitting', price: 0 },
      { value: 'heavy', label: 'Structural Alterations', price: 500 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [{ id: 'glazing', label: 'Glazing', categories: ['window', 'door', 'conservatory'] }],
  pricingCategories: ['labour', 'finish', 'prep'],
  surveySections: composeSurveySections(
    [
      {
        id: 'glazing',
        title: 'Windows & doors',
        fields: [
          { key: 'unitCount', label: 'Number of openings', type: 'number', min: 1, max: 40, required: true },
          {
            key: 'frameCondition',
            label: 'Existing frame / reveal condition',
            type: 'select',
            options: SURVEY_CONDITION,
            costAdjustment: { poor: 320 },
            riskWeight: 10,
          },
          {
            key: 'upperFloors',
            label: 'Upper-floor units requiring access?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 280 },
            riskWeight: 10,
          },
          {
            key: 'bayOrSpecial',
            label: 'Bay / shaped / conservatory?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 450 },
            riskWeight: 12,
          },
          {
            key: 'lintelsOk',
            label: 'Lintels appear sound?',
            type: 'select',
            options: SURVEY_YES_NO_UNKNOWN,
            costAdjustment: { no: 600 },
            riskWeight: 14,
          },
        ],
      },
    ],
    { includeHeight: false, photoLabel: 'Windows and openings' },
  ),
  labourRules: [
    { key: 'labourDays', description: 'Fitting labour', rateType: 'per_item', baseRate: 180, dependsOn: ['windows'] },
  ],
  additionsCatalog: [],
  portfolioCategories: [
    { value: 'upvc', label: 'uPVC' },
    { value: 'aluminium', label: 'Aluminium' },
    { value: 'doors', label: 'Doors' },
    { value: 'full-replace', label: 'Full Replace' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Survey & measure', phase: 'Survey' },
    { id: '2', name: 'Manufacture & delivery', phase: 'Supply' },
    { id: '3', name: 'Removal of old units', phase: 'Demolition' },
    { id: '4', name: 'Installation & sealing', phase: 'Installation' },
  ],
  aiExtraction: {
    photoGuidance: ['Each window elevation', 'Frame material close-up', 'Door overview'],
    promptContext: 'UK window fitter estimator. Count windows, identify frame material, glazing type.',
    extractableFields: ['windows', 'doors', 'finish'],
    lowConfidenceThreshold: 0.65,
  },
};

export const loftConfig: TradeConfig = {
  id: 'loft',
  name: 'Loft Conversion',
  icon: 'ArrowUp',
  description: 'Loft conversions, dormers, stairs, insulation, and finishes',
  measurementModes: ['area', 'rooms'],
  materialsRatePerSqm: 65,
  defaultLabourRate: 320,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    measurementStage('Measure loft floor area'),
    {
      id: 'spec',
      title: 'Conversion Type',
      fields: [
        { key: 'conversionType', label: 'Type', type: 'select', options: [
          { value: 'velux', label: 'Velux / Rooflight Only', price: 25000 },
          { value: 'dormer', label: 'Dormer Conversion', price: 45000 },
          { value: 'mansard', label: 'Mansard', price: 65000 },
        ]},
        { key: 'rooms', label: 'Rooms Created', type: 'number', min: 1, max: 3 },
        { key: 'bathroom', label: 'En-suite Bathroom', type: 'select', options: [
          { value: 'no', label: 'No', price: 0 },
          { value: 'yes', label: 'Yes', price: 8500 },
        ]},
      ],
    },
    additionsStage([
      { id: 'stairs', name: 'New Staircase', price: 3500 },
      { id: 'insulation', name: 'Premium Insulation Package', price: 1200 },
    ]),
    siteConditionsStage([
      { value: 'standard', label: 'Standard Head Height', price: 0 },
      { value: 'heavy', label: 'Low Head Height / Structural', price: 2500 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [{ id: 'loft', label: 'Loft', categories: ['insulation', 'stair', 'window', 'plaster'] }],
  pricingCategories: ['labour', 'structural', 'prep', 'feature'],
  surveySections: composeSurveySections(
    [
      {
        id: 'loft',
        title: 'Loft conversion survey',
        fields: [
          {
            key: 'conversionType',
            label: 'Likely conversion type',
            type: 'select',
            options: [
              { value: 'velux', label: 'Velux / roof lights' },
              { value: 'dormer', label: 'Dormer' },
              { value: 'hip', label: 'Hip-to-gable' },
              { value: 'mansard', label: 'Mansard' },
              { value: 'unknown', label: 'Unknown / advise' },
            ],
          },
          {
            key: 'headHeight',
            label: 'Adequate head height?',
            type: 'select',
            options: SURVEY_YES_NO_UNKNOWN,
            costAdjustment: { no: 2000 },
            riskWeight: 16,
          },
          {
            key: 'joistStrength',
            label: 'Joists appear suitable / need strengthening?',
            type: 'select',
            options: [
              { value: 'ok', label: 'Look OK' },
              { value: 'strengthen', label: 'Likely strengthen' },
              { value: 'unknown', label: 'Unknown' },
            ],
            costAdjustment: { strengthen: 1800 },
            riskWeight: 14,
          },
          {
            key: 'stairSpace',
            label: 'Stair void available on floor below?',
            type: 'select',
            options: SURVEY_YES_NO_UNKNOWN,
            costAdjustment: { no: 2500 },
            riskWeight: 18,
          },
          {
            key: 'planningLoft',
            label: 'Planning / PD known?',
            type: 'select',
            options: [
              { value: 'approved', label: 'Approved' },
              { value: 'pd', label: 'PD likely' },
              { value: 'needed', label: 'Application needed' },
              { value: 'unknown', label: 'Unknown' },
            ],
          },
        ],
      },
    ],
    { includeHeight: true, photoLabel: 'Loft space and roof' },
  ),
  labourRules: [
    { key: 'labourDays', description: 'Loft conversion labour', rateType: 'per_day', baseRate: 320, formula: 'ceil(area/6)+15', dependsOn: ['area'] },
  ],
  additionsCatalog: [],
  portfolioCategories: [
    { value: 'velux', label: 'Velux' },
    { value: 'dormer', label: 'Dormer' },
    { value: 'mansard', label: 'Mansard' },
    { value: 'full-conversion', label: 'Full Conversion' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Structural survey', phase: 'Survey' },
    { id: '2', name: 'Steel & floor reinforcement', phase: 'Structure' },
    { id: '3', name: 'Staircase & dormer', phase: 'Structure' },
    { id: '4', name: 'Insulation & plastering', phase: 'Finishes' },
    { id: '5', name: 'Second fix & building control', phase: 'Completion' },
  ],
  aiExtraction: {
    photoGuidance: ['Loft interior', 'Rafters and head height', 'Existing access hatch'],
    promptContext: 'UK loft conversion estimator. Assess head height, roof structure, conversion type feasibility.',
    extractableFields: ['area', 'conversionType', 'rooms', 'bathroom'],
    lowConfidenceThreshold: 0.5,
  },
};

export const landscapingConfig: TradeConfig = {
  id: 'landscaping',
  name: 'Landscaping',
  icon: 'TreePine',
  description: 'Patios, driveways, fencing, decking, and planting',
  measurementModes: ['area', 'linear'],
  materialsRatePerSqm: 22,
  defaultLabourRate: 220,
  siteUplifts: DEFAULT_SITE_UPLIFTS,
  wizardStages: [
    customerStage(),
    measurementStage('Measure patio/drive area (m²)'),
    {
      id: 'scope',
      title: 'Scope',
      fields: [
        { key: 'linearMetres', label: 'Fencing / Edging (linear m)', type: 'number', min: 0, max: 200 },
        { key: 'surfaceType', label: 'Surface Type', type: 'select', options: [
          { value: 'patio', label: 'Patio Slabs', price: 85 },
          { value: 'block-paving', label: 'Block Paving', price: 95 },
          { value: 'decking', label: 'Composite Decking', price: 120 },
          { value: 'gravel', label: 'Gravel Drive', price: 45 },
        ]},
      ],
    },
    additionsStage([
      { id: 'drainage', name: 'Drainage / Soakaway', price: 850 },
      { id: 'lighting', name: 'Garden Lighting', price: 650 },
      { id: 'planting', name: 'Planting Scheme', price: 1200 },
    ]),
    siteConditionsStage([
      { value: 'standard', label: 'Good Access', price: 0 },
      { value: 'heavy', label: 'Restricted / Manual Carry', price: 400 },
    ]),
    summaryStage(),
  ],
  productCategoryGroups: [{ id: 'landscape', label: 'Landscaping', categories: ['paving', 'fencing', 'decking', 'plant', 'drainage'] }],
  pricingCategories: ['labour', 'finish', 'prep', 'feature'],
  surveySections: composeSurveySections(
    [
      {
        id: 'landscape',
        title: 'Landscaping survey',
        fields: [
          {
            key: 'groundType',
            label: 'Ground / surface type',
            type: 'select',
            options: [
              { value: 'soil', label: 'Soil / lawn' },
              { value: 'hardcore', label: 'Hardcore / rubble' },
              { value: 'existing-pave', label: 'Existing paving' },
              { value: 'sloped', label: 'Sloped / retained' },
            ],
            costAdjustment: { hardcore: 250, sloped: 800 },
            riskWeight: 12,
          },
          {
            key: 'drainageIssues',
            label: 'Standing water / drainage issues?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 450 },
            riskWeight: 14,
          },
          {
            key: 'accessMachinery',
            label: 'Machinery / wheelbarrow access?',
            type: 'select',
            options: [
              { value: 'easy', label: 'Easy' },
              { value: 'side', label: 'Side gate only' },
              { value: 'difficult', label: 'Difficult / over house' },
            ],
            costAdjustment: { side: 150, difficult: 500 },
            riskWeight: 10,
          },
          {
            key: 'fencingBoundary',
            label: 'Boundary / fencing works?',
            type: 'select',
            options: SURVEY_YES_NO,
            costAdjustment: { yes: 300 },
            riskWeight: 5,
          },
          {
            key: 'utilities',
            label: 'Known underground utilities?',
            type: 'select',
            options: SURVEY_YES_NO_UNKNOWN,
            riskWeight: 8,
          },
        ],
      },
    ],
    { includeHeight: false, photoLabel: 'Garden and access' },
  ),
  labourRules: [
    { key: 'labourDays', description: 'Landscaping labour', rateType: 'per_day', baseRate: 220, formula: 'ceil(area/12)+2', dependsOn: ['area'] },
    { key: 'materials', description: 'Hard landscaping materials', rateType: 'per_sqm', baseRate: 22, dependsOn: ['area'] },
  ],
  additionsCatalog: [],
  portfolioCategories: [
    { value: 'patio', label: 'Patios' },
    { value: 'driveway', label: 'Driveways' },
    { value: 'fencing', label: 'Fencing' },
    { value: 'full-garden', label: 'Full Garden' },
  ],
  projectTaskTemplates: [
    { id: '1', name: 'Excavation & ground prep', phase: 'Groundworks' },
    { id: '2', name: 'Sub-base & compaction', phase: 'Groundworks' },
    { id: '3', name: 'Laying surface', phase: 'Installation' },
    { id: '4', name: 'Edging & finishing', phase: 'Completion' },
  ],
  aiExtraction: {
    photoGuidance: ['Garden overview', 'Existing surface', 'Access route for materials'],
    promptContext: 'UK landscaper estimator. Identify garden size, existing surfaces, slope, access.',
    extractableFields: ['length', 'width', 'surfaceType', 'linearMetres', 'access'],
    lowConfidenceThreshold: 0.55,
  },
};
