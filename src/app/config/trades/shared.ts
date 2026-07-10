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

export function baseSurveySections(): SurveySection[] {
  return [
    {
      id: 'measurements',
      title: 'Measurements',
      fields: [
        { key: 'length', label: 'Length (m)', type: 'number' },
        { key: 'width', label: 'Width (m)', type: 'number' },
        { key: 'height', label: 'Height (m)', type: 'number' },
      ],
    },
    {
      id: 'access',
      title: 'Access',
      fields: [
        { key: 'floorLocation', label: 'Floor Location', type: 'select', options: SITE_ACCESS_OPTIONS },
        { key: 'parking', label: 'Parking', type: 'select', options: PARKING_OPTIONS },
      ],
    },
    {
      id: 'notes',
      title: 'Notes',
      fields: [{ key: 'additionalNotes', label: 'Additional Notes', type: 'textarea' }],
    },
  ];
}

export const DEFAULT_SITE_UPLIFTS = {
  floorLocation: { ground: 0, upstairs: 200, loft: 400 },
  access: { easy: 0, limited: 150, difficult: 300 },
  removal: { standard: 450, heavy: 750, none: 0, light: 250 },
};
