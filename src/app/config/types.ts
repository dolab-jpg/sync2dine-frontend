export type TradeId =
  | 'bathroom'
  | 'kitchen'
  | 'electrical'
  | 'plumbing'
  | 'roofing'
  | 'flooring'
  | 'painting'
  | 'plastering'
  | 'extensions'
  | 'windows'
  | 'loft'
  | 'landscaping';

export type FieldType =
  | 'number'
  | 'select'
  | 'multi-select'
  | 'product-picker'
  | 'finish-picker'
  | 'toggle'
  | 'text'
  | 'date'
  | 'customer-select';

export type MeasurementMode = 'area' | 'linear' | 'count' | 'rooms';

export type LabourRateType = 'per_sqm' | 'per_day' | 'per_item' | 'per_linear_m' | 'fixed' | 'formula';

export interface FieldOption {
  value: string;
  label: string;
  price?: number;
  priceAdjustment?: number;
  description?: string;
}

export interface WizardField {
  key: string;
  label: string;
  type: FieldType;
  options?: FieldOption[];
  productCategory?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  unit?: string;
  required?: boolean;
  computeFrom?: { fields: string[]; formula: 'area' | 'linear' | 'labour_days' };
  pricingKey?: string;
}

export interface WizardStage {
  id: string;
  title: string;
  description?: string;
  fields: WizardField[];
}

export interface CategoryGroup {
  id: string;
  label: string;
  categories: string[];
}

export interface SurveyField {
  key: string;
  label: string;
  type: 'select' | 'text' | 'number' | 'textarea';
  options?: FieldOption[];
  riskWeight?: number;
  costAdjustment?: Record<string, number>;
}

export interface SurveySection {
  id: string;
  title: string;
  fields: SurveyField[];
}

export interface LabourRule {
  key: string;
  description: string;
  rateType: LabourRateType;
  baseRate: number;
  formula?: string;
  dependsOn?: string[];
}

export interface CatalogItem {
  id: string;
  name: string;
  price: number;
}

export interface TaskTemplate {
  id: string;
  name: string;
  phase: string;
  estimatedDays?: number;
}

export interface AIExtractionConfig {
  photoGuidance: string[];
  promptContext: string;
  extractableFields: string[];
  lowConfidenceThreshold: number;
}

export interface RenderOption {
  value: string;
  label: string;
  color?: string;
}

export interface RenderOptionGroup {
  key: string;
  label: string;
  options: RenderOption[];
}

export interface PortfolioCategory {
  value: string;
  label: string;
}

export interface TradeConfig {
  id: TradeId;
  name: string;
  icon: string;
  description: string;
  measurementModes: MeasurementMode[];
  wizardStages: WizardStage[];
  productCategoryGroups: CategoryGroup[];
  pricingCategories: string[];
  surveySections: SurveySection[];
  labourRules: LabourRule[];
  additionsCatalog: CatalogItem[];
  projectTaskTemplates: TaskTemplate[];
  portfolioCategories: PortfolioCategory[];
  materialsRatePerSqm?: number;
  defaultLabourRate?: number;
  siteUplifts?: {
    floorLocation?: Record<string, number>;
    access?: Record<string, number>;
    removal?: Record<string, number>;
  };
  aiExtraction?: AIExtractionConfig;
  renderOptions?: RenderOptionGroup[];
}

export type WizardAnswers = Record<string, unknown>;

export interface QuoteCalculationResult {
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  labour: Array<{
    description: string;
    days?: number;
    area?: number;
    quantity?: number;
    rateType: 'per_day' | 'per_sqm' | 'fixed' | 'per_item';
    rate: number;
    total: number;
  }>;
  extras: Array<{ description: string; price: number }>;
  breakdown: Record<string, number>;
  subtotal: number;
  discountAmount: number;
  total: number;
}
