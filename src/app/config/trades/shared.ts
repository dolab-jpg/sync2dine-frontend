import type { FieldOption, SurveySection, WizardField, WizardStage } from '../types';

export const SITE_ACCESS_OPTIONS: FieldOption[] = [
  { value: 'ground', label: 'Ground Floor', priceAdjustment: 0, description: 'No additional cost' },
  { value: 'upstairs', label: 'Upstairs', priceAdjustment: 200 },
  { value: 'loft', label: 'Loft/Attic', priceAdjustment: 400 },
];

export const PARKING_OPTIONS: FieldOption[] = [
  { value: 'easy', label: 'Easy Access', priceAdjustment: 0 },
  { value: 'limited', label: 'Limited Access', priceAdjustment: 150 },
  { value: 'difficult', label: 'Difficult Access', priceAdjustment: 300 },
];

export function measurementStage(description: string): WizardStage {
  return {
    id: 'measurements',
    title: 'Measurements',
    description,
    fields: [
      { key: 'length', label: 'Length (m)', type: 'number', min: 0.5, max: 30, unit: 'm', required: true },
      { key: 'width', label: 'Width (m)', type: 'number', min: 0.5, max: 30, unit: 'm', required: true },
      { key: 'height', label: 'Height (m)', type: 'number', min: 2, max: 5, unit: 'm' },
      { key: 'area', label: 'Area', type: 'number', computeFrom: { fields: ['length', 'width'], formula: 'area' }, unit: 'm²' },
      { key: 'labourDays', label: 'Labour Days', type: 'number', computeFrom: { fields: ['area'], formula: 'labour_days' } },
    ],
  };
}

export function siteConditionsStage(removalOptions: FieldOption[]): WizardStage {
  return {
    id: 'site',
    title: 'Site Details',
    description: 'Site conditions affect labour and access costs',
    fields: [
      { key: 'floorLocation', label: 'Floor Location', type: 'select', options: SITE_ACCESS_OPTIONS, required: true },
      { key: 'access', label: 'Parking & Access', type: 'select', options: PARKING_OPTIONS, required: true },
      { key: 'removal', label: 'Removal / Strip-out', type: 'select', options: removalOptions, required: true },
    ],
  };
}

export function summaryStage(): WizardStage {
  return {
    id: 'summary',
    title: 'Summary',
    description: 'Review totals and apply discount',
    fields: [
      { key: 'discount', label: 'Discount (%)', type: 'number', min: 0, max: 100 },
      { key: 'bookingDeposit', label: 'Booking Deposit (£)', type: 'number', min: 0 },
      { key: 'bookingDate', label: 'Preferred Start Date', type: 'date' },
    ],
  };
}

export function customerStage(): WizardStage {
  return {
    id: 'customer',
    title: 'Customer',
    description: 'Select the customer for this quote',
    fields: [{ key: 'customerId', label: 'Customer', type: 'customer-select', required: true }],
  };
}

export function finishPickerStage(title: string, description: string, options: FieldOption[]): WizardStage {
  return {
    id: 'finish',
    title,
    description,
    fields: [{ key: 'finish', label: 'Finish', type: 'finish-picker', options, required: true }],
  };
}

export function productPickerStage(title: string, description: string, fields: WizardField[]): WizardStage {
  return { id: 'products', title, description, fields };
}

export function additionsStage(items: { id: string; name: string; price: number }[]): WizardStage {
  return {
    id: 'additions',
    title: 'Additions',
    description: 'Select optional extras',
    fields: [{ key: 'additions', label: 'Additions', type: 'multi-select', options: items.map(i => ({ value: i.id, label: i.name, price: i.price })) }],
  };
}

export function countStage(key: string, label: string, description: string, min = 1, max = 50): WizardStage {
  return {
    id: key,
    title: label,
    description,
    fields: [{ key, label: `Number of ${label}`, type: 'number', min, max, required: true }],
  };
}

const YES_NO: FieldOption[] = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

const YES_NO_UNKNOWN: FieldOption[] = [
  ...YES_NO,
  { value: 'unknown', label: 'Unknown' },
];

const CONDITION_OPTIONS: FieldOption[] = [
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

/** Shared measurements + access used across trades. Trade-specific sections append after these. */
export function baseSurveySections(opts?: { includeHeight?: boolean }): SurveySection[] {
  const includeHeight = opts?.includeHeight !== false;
  return [
    {
      id: 'measurements',
      title: 'Measurements',
      description: 'Record approximate sizes for quoting',
      fields: [
        { key: 'length', label: 'Length (m)', type: 'number', min: 0.5, max: 100, unit: 'm', required: true },
        { key: 'width', label: 'Width (m)', type: 'number', min: 0.5, max: 100, unit: 'm', required: true },
        ...(includeHeight
          ? [{ key: 'height', label: 'Height (m)', type: 'number' as const, min: 1.5, max: 8, unit: 'm' }]
          : []),
      ],
    },
    {
      id: 'access',
      title: 'Access & Site',
      description: 'Access constraints affect labour and logistics',
      fields: [
        { key: 'floorLocation', label: 'Floor / level', type: 'select', options: SITE_ACCESS_OPTIONS, required: true },
        { key: 'parking', label: 'Parking & vehicle access', type: 'select', options: PARKING_OPTIONS, required: true, costAdjustment: { limited: 150, difficult: 300 }, riskWeight: 8 },
        {
          key: 'wasteAccess',
          label: 'Waste / skip access',
          type: 'select',
          options: [
            { value: 'easy', label: 'Easy — driveway/front' },
            { value: 'restricted', label: 'Restricted' },
            { value: 'none', label: 'No skip space' },
          ],
          costAdjustment: { restricted: 120, none: 250 },
          riskWeight: 6,
        },
        {
          key: 'occupantPresent',
          label: 'Property occupied during works?',
          type: 'select',
          options: YES_NO,
        },
      ],
    },
  ];
}

export function surveyNotesSection(): SurveySection {
  return {
    id: 'notes',
    title: 'Notes',
    description: 'Anything else that affects price or programme',
    fields: [{ key: 'additionalNotes', label: 'Additional notes', type: 'textarea' }],
  };
}

export function surveyPhotosHintSection(label = 'Current site condition'): SurveySection {
  return {
    id: 'photos',
    title: 'Photos',
    description: `Capture ${label.toLowerCase()} for the quote and approval pack`,
    fields: [
      {
        key: 'photoNotes',
        label: 'Photo / condition notes',
        type: 'textarea',
        description: 'List what was photographed or key defects visible',
      },
    ],
  };
}

export const SURVEY_YES_NO = YES_NO;
export const SURVEY_YES_NO_UNKNOWN = YES_NO_UNKNOWN;
export const SURVEY_CONDITION = CONDITION_OPTIONS;

/** Compose trade survey: base + trade sections + photos + notes */
export function composeSurveySections(tradeSections: SurveySection[], opts?: { includeHeight?: boolean; photoLabel?: string }): SurveySection[] {
  return [
    ...baseSurveySections({ includeHeight: opts?.includeHeight }),
    ...tradeSections,
    surveyPhotosHintSection(opts?.photoLabel),
    surveyNotesSection(),
  ];
}

export const DEFAULT_SITE_UPLIFTS = {
  floorLocation: { ground: 0, upstairs: 200, loft: 400 },
  access: { easy: 0, limited: 150, difficult: 300 },
  removal: { standard: 450, heavy: 750, none: 0, light: 250 },
};
