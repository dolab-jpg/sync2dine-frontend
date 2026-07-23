import type { TradeId } from './config/types';
import type { AllergenCode, DietaryCode } from './engine/restaurant/allergens';
import type { TradeProExportBundle, MergeStrategy, ImportResult } from './engine/data/dataImportExportService';
import {
  type User,
  type UserRole,
  type RecruitmentAccess,
  type AccountsAccess,
  hasSuperAdminAccess,
} from './accessGates';

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  status: 'lead' | 'quoted' | 'won' | 'lost';
  createdAt: string;
  photos: string[];
  notes: string;
  /** Named customer special they can ask for on the phone (e.g. "Family Friday") */
  specialName?: string;
  /** Deal instructions Judie must honour when that special applies */
  specialDealNote?: string;
  interestedTrades?: TradeId[];
  tradeId?: TradeId;
  whatsappOptIn: boolean;
  preferredChannel: 'email' | 'whatsapp' | 'both' | 'phone';
  /** Channel reply language pack: en | es | pl | ru | uk | zh | hi | tr | ar | ro | pt | it | sq | fa */
  preferredLanguage?:
    | 'en' | 'es' | 'pl' | 'ru' | 'uk' | 'zh' | 'hi' | 'tr' | 'ar' | 'ro' | 'pt' | 'it' | 'sq' | 'fa';
  whatsappId?: string;
  lastWhatsAppAt?: string;
  /** CRM lead fields */
  source?: 'facebook' | 'instagram' | 'google' | 'referral' | 'website' | 'phone' | 'walk-in' | 'email' | 'purchased';
  /** Call Centre call id this lead was captured from (Cynthia auto-capture or staff "Create lead" action) */
  sourceCallId?: string;
  campaign?: string;
  adSet?: string;
  leadScore?: number;
  lastContact?: string;
  nextFollowUp?: string;
  budget?: string;
  timeline?: string;
  tags?: string[];
  /** Scraped / purchased lead batch id */
  leadBatchId?: string;
  /** Call queue tracking for scraped / dialled leads */
  callQueueStatus?: 'not_called' | 'queued' | 'dialling' | 'called' | 'needs_retry' | 'do_not_call';
  lastCallAt?: string;
  lastCallId?: string;
  lastCallDisposition?: string;
  lastCallSummary?: string;
  /** Latest call recording URL (stamped on end-of-call) for lead/customer replay */
  lastRecordingUrl?: string;
  callAttemptCount?: number;
  /** Conversation / call timeline (notes with aim + detail for Cynthia) */
  activities?: Array<{
    id: string;
    type: string;
    aim?: string;
    detail?: string;
    summary?: string;
    outcome?: string;
    disposition?: string;
    callSessionId?: string;
    callId?: string;
    createdAt: string;
    createdBy?: string;
  }>;
}

export interface Product {
  id: string;
  name: string;
  image: string;
  basePrice: number;
  margin: number;
  sellPrice: number;
  source: string;
  category: string;
  tradeId?: TradeId | null;
  /** Restaurant food menu fields (Sync2Dine) — same row Judie reads via getMenu */
  price?: number;
  description?: string;
  available?: boolean;
  /** Meal deal composition (specials) — expands on placeFoodOrder */
  deal?: {
    roles: Array<{ role: string; qtyPerDeal: number; choices: string[] }>;
  };
  /** Upgrade option groups Judie can offer (e.g. crust, side) */
  options?: Array<{
    role: string;
    required?: boolean;
    choices: Array<{ name: string; priceDelta?: number }>;
  }>;
  /** UK 14 allergen / dietary facts (stored on products.data) */
  allergensContains?: AllergenCode[];
  allergensMayContain?: AllergenCode[];
  dietary?: DietaryCode[];
  allergenNotes?: string;
  allergenDeclared?: boolean;
}

export interface PricingRule {
  id: string;
  name: string;
  type: 'per_sqm' | 'per_day' | 'fixed' | 'per_item';
  basePrice: number;
  category: string;
  tradeId?: TradeId | null;
  price?: number;
}

export type QuoteStatus =
  | 'indicative'
  | 'draft'
  | 'awaiting_approval'
  | 'approved'
  | 'rejected'
  | 'sent'
  | 'accepted'
  | 'expired'
  | 'archived';

export interface QuoteApproval {
  state: 'pending' | 'approved' | 'rejected';
  by?: string;
  at?: string;
  note?: string;
  originalTotal?: number;
}

export interface PricingResearchSource {
  title: string;
  url: string;
}

export interface PricingResearchLine {
  task: string;
  low: number;
  typical: number;
  high: number;
  unit: string;
  sources: PricingResearchSource[];
}

export interface PricingResearch {
  provider: string;
  region?: string;
  summary?: string;
  lines: PricingResearchLine[];
  generatedAt: string;
}

export interface QuoteLine {
  id: string;
  description: string;
  quantity: number;
  unit: 'sqm' | 'linear_m' | 'cubic_m' | 'item' | 'day' | 'hour' | 'fixed';
  rate: number;
  total: number;
  category?: 'product' | 'labour' | 'extra' | 'material';
}

export interface Quote {
  id: string;
  customerId: string;
  customerName: string;
  tradeId?: TradeId;
  tradeName?: string;
  createdAt: string;
  expiresAt: string;
  items: QuoteItem[];
  labour: LabourItem[];
  extras: ExtraItem[];
  lines?: QuoteLine[];
  discount: number;
  total: number;
  status: QuoteStatus;
  projectId?: string;
  designImage?: string;
  wizardAnswers?: Record<string, unknown>;
  aiAcceptedFields?: Record<string, unknown>;
  jobGroupId?: string;
  approval?: QuoteApproval;
  pricingResearch?: PricingResearch;
  /** Filename or storage path of last generated quote PDF */
  pdfPath?: string;
  /** Stable signed Sync2Dine URL that creates a fresh Stripe Checkout session. */
  checkoutLandingUrl?: string;
  stripeSessionId?: string;
  stripePaymentStatus?: 'unpaid' | 'pending' | 'paid';
  paidAt?: string;
  organizationId?: string;
  lastSentAt?: string;
  lastEmailMessageId?: string;
}

export interface QuoteItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface LabourItem {
  description: string;
  days?: number;
  area?: number;
  quantity?: number;
  rateType: 'per_day' | 'per_sqm' | 'fixed' | 'per_item';
  rate: number;
  total: number;
}

export interface ExtraItem {
  description: string;
  price: number;
}

export interface CallTurn {
  role: 'caller' | 'agent' | 'system';
  content: string;
  timestamp: string;
}

export interface CallSession {
  id: string;
  providerCallId?: string;
  direction: 'inbound' | 'outbound';
  from: string;
  to: string;
  status: string;
  intent?: string;
  outcome?: string;
  customerId?: string | null;
  candidateId?: string | null;
  projectId?: string | null;
  transcript: CallTurn[];
  recordingUrl?: string;
  escalated?: boolean;
  campaignTemplate?: string;
  startedAt: string;
  endedAt?: string;
}

export interface RecruitmentCandidateRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  desiredRole: string;
  source: string;
  createdAt: string;
}

export interface AppContextType {
  user: User;
  customers: Customer[];
  products: Product[];
  pricingRules: PricingRule[];
  quotes: Quote[];
  recruitmentAccess: RecruitmentAccess;
  setRecruitmentAccess: (next: RecruitmentAccess) => void;
  accountsAccess: AccountsAccess;
  setAccountsAccess: (next: AccountsAccess) => void;
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt'>) => Customer;
  upsertCustomer: (customer: Customer) => void;
  updateCustomer: (id: string, customer: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  addProduct: (product: Omit<Product, 'id' | 'sellPrice'>) => void;
  updateProduct: (id: string, product: Partial<Product>) => void;
  deleteProduct: (id: string) => void;
  addQuote: (quote: Omit<Quote, 'id' | 'createdAt'>) => Quote;
  updateQuote: (id: string, quote: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
  addPricingRule: (rule: Omit<PricingRule, 'id'>) => void;
  updatePricingRule: (id: string, rule: Partial<PricingRule>) => void;
  deletePricingRule: (id: string) => void;
  importDataBundle: (
    bundle: TradeProExportBundle,
    options: { strategy: MergeStrategy }
  ) => ImportResult;
  logout: () => void;
}

/** A contract may only be generated once a manager/super-admin has approved the price. */
export function canCreateContract(quote: Pick<Quote, 'status'>): boolean {
  return quote.status === 'approved';
}

/** Price approval is a human gate restricted to managers and super admins. */
export function canApproveQuotes(role: UserRole): boolean {
  return hasSuperAdminAccess(role) || role === 'manager';
}
