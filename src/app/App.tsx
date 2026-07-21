import React, { useState, useEffect, useMemo, useRef, ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router';
import LoginPage from './auth/pages/LoginPage';
import SignupPage from './auth/pages/SignupPage';
import ForgotPasswordPage from './auth/pages/ForgotPasswordPage';
import ResetPasswordPage from './auth/pages/ResetPasswordPage';
import InviteAcceptPage from './auth/pages/InviteAcceptPage';
import ProfilePage from './auth/pages/ProfilePage';
import ChangePasswordPage from './auth/pages/ChangePasswordPage';
import SalesDashboard from './components/SalesDashboard';
import CustomerManagement from './components/CustomerManagement';
import ProductCatalog from './components/ProductCatalog';
import { AIAssistantProvider } from './context/AIAssistantContext';
import { allTradeProducts, tradePricingRules } from './data/tradeProducts';
import type { TradeId } from './config/types';
import Settings from './components/Settings';
import CommunicationsHub from './components/CommunicationsHub';
import CyrusConversations from './components/CyrusConversations';
import CynthiaHome from './components/Cynthia/CynthiaHome';
import IntegrationsHub from './components/integrations/IntegrationsHub';
import CursorPastePage from './pages/CursorPastePage';
import ComprehensiveCRM from './components/ComprehensiveCRM';
import TeamManagement from './components/TeamManagement';
import SalesManagement from './components/SalesManagement';
import RecruitmentCRM from './components/RecruitmentCRM';
import { seedContactsFromCustomers } from './engine/contacts/contactStore';
import { syncToServer, loadProjects, saveProjects, loadProjectsAsync, initProjectsRealtime } from './engine/project/projectStore';
import { initBankingStore } from './engine/banking/bankingStore';
import { initCompanyProfile } from './engine/integrations/companyProfileSync';
import { loadContacts, saveContacts } from './engine/contacts/contactStore';
import { loadBuilders, saveBuilders } from './engine/builder/builderStore';
import { loadSurveys, saveSurveys } from './engine/surveyScorer';
import { loadPlanningApplications } from './engine/planning/planningStore';
import {
  loadBankAccounts,
  loadBankTransactions,
  loadClientReceipts,
  saveBankAccounts,
  saveBankTransactions,
  saveClientReceipts,
} from './engine/banking/bankingStore';
import {
  type TradeProExportBundle,
  type MergeStrategy,
  type ImportResult,
  mergeById,
  migrateCustomers,
  migrateProducts,
  migrateQuotes,
  migratePricingRules,
} from './engine/data/dataImportExportService';
import AccountsHub from './components/accounts/AccountsHub';
import ConversationAudit from './components/aiStudio/ConversationAudit';
import CallCenter from './components/CallCenter/CallCenter';
import CallRegister from './components/CallCenter/CallRegister';
import AppShell from './components/AppShell';
import PlatformClientsCRM from './components/platform/PlatformClientsCRM';
import SallyOfferSettings from './components/platform/SallyOfferSettings';
import SallyKnowledgePanel from './components/platform/SallyKnowledgePanel';
import SalesBrainPanel from './components/platform/SalesBrainPanel';
import PricingPage from './components/PricingPage';
import StartCheckoutFlow from './components/StartCheckoutFlow';
import JudieLandingPage from './components/JudieLandingPage';
import AtmosphereLandingPage from './components/AtmosphereLandingPage';
import TermsPage from './components/legal/TermsPage';
import FairUseAndFaresPage from './components/legal/FairUseAndFaresPage';
import PrivacyPage from './components/legal/PrivacyPage';
import AcceptableUsePage from './components/legal/AcceptableUsePage';
import CookiesPage from './components/legal/CookiesPage';
import CancellationRefundsPage from './components/legal/CancellationRefundsPage';
import QuotesList from './components/QuotesList';
import SaasQuoteBuilder from './components/SaasQuoteBuilder';
import MenuPreview from './components/platform/MenuPreview';
import FrontKiosk from './components/FrontKiosk';
import RestaurantOrders from './components/RestaurantOrders';
import RestaurantShell from './components/restaurant/RestaurantShell';
import RestaurantAccounts from './components/restaurant/RestaurantAccounts';
import RestaurantLive from './components/restaurant/RestaurantLive';
import MenuManager from './components/restaurant/MenuManager';
import RestaurantTill from './components/restaurant/RestaurantTill';
import RestaurantSettings from './components/restaurant/RestaurantSettings';
import BookingsBoard from './components/restaurant/BookingsBoard';
import IntegrationsPublicPage from './components/restaurant/IntegrationsPublicPage';
import type { AllergenCode, DietaryCode } from './engine/restaurant/allergens';
import { getExperience } from './engine/platform/experience';
import {
  ensureActiveOrgId,
  getActiveOrgId,
  installApiFetchInterceptor,
  subscribeActiveOrg,
  syncActiveOrgFromProfile,
} from './engine/platform/orgContext';
import { integrationService } from './engine/integrations/integrationService';
import { Toaster } from './components/ui/sonner';
import { OnlineStatusBanner } from './components/OnlineStatusBanner';
import { requestNativeNotifications, registerDeviceTokenIfNative } from './bridge/nativeBridge';
import {
  saveSessionUser,
  loadSessionUser,
  clearSessionUser,
  parseDemoRoleFromUrl,
} from './engine/auth/sessionStore';
import { testCustomers } from './data/testData';
import { crmLeadSeed } from './data/crmLeads';
import { migrateQuoteToLines } from './engine/quotes/quoteLineUtils';
import { syncCustomerStatusFromQuote } from './engine/leads/leadService';
import { startPmScheduler } from './engine/ai/pmScheduler';
import { isSupabaseConfigured } from '../lib/supabase/client';
import { useCloudPersistence } from './engine/data/cloudPersist';

const CLOUD_MODE = isSupabaseConfigured();

/** Prefer primary rows; append secondary ids not already present. */
function unionById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of primary) map.set(item.id, item);
  for (const item of secondary) {
    if (!map.has(item.id)) map.set(item.id, item);
  }
  return [...map.values()];
}

export type UserRole = 'platform_owner' | 'super_admin' | 'manager' | 'staff' | 'builder' | 'recruitment' | 'customer' | 'kiosk';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

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

export interface RecruitmentAccess {
  staff: boolean;
  manager: boolean;
}

export interface AccountsAccess {
  staff: boolean;
  manager: boolean;
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

export const AppContext = React.createContext<AppContextType | null>(null);

// Whether a user can access the Recruitment module, considering both role and
// super-admin-granted permissions for sales/office staff and managers.
/** Controlling Super Admin (platform_owner) has the same product access as company super_admin. */
export function hasSuperAdminAccess(role: UserRole): boolean {
  return role === 'super_admin' || role === 'platform_owner';
}

export function canAccessRecruitment(role: UserRole, access: RecruitmentAccess): boolean {
  if (hasSuperAdminAccess(role) || role === 'recruitment') return true;
  if (role === 'staff') return access.staff;
  if (role === 'manager') return access.manager;
  return false;
}

export function canAccessAccounts(role: UserRole, access: AccountsAccess): boolean {
  if (hasSuperAdminAccess(role)) return true;
  if (role === 'staff') return access.staff;
  if (role === 'manager') return access.manager;
  return false;
}

// A contract may only be generated once a manager/super-admin has approved the price.
export function canCreateContract(quote: Pick<Quote, 'status'>): boolean {
  return quote.status === 'approved';
}

// Price approval is a human gate restricted to managers and super admins.
export function canApproveQuotes(role: UserRole): boolean {
  return hasSuperAdminAccess(role) || role === 'manager';
}

function roleAllowed(userRole: UserRole, allowedRoles: UserRole[]): boolean {
  if (allowedRoles.includes(userRole)) return true;
  if (userRole === 'platform_owner' && allowedRoles.includes('super_admin')) return true;
  return false;
}

// Protected Route Component for role-based access control
interface ProtectedRouteProps {
  element: ReactElement;
  allowedRoles: UserRole[];
  user: User;
}

function ProtectedRoute({ element, allowedRoles, user }: ProtectedRouteProps): ReactElement {
  if (!roleAllowed(user.role, allowedRoles)) {
    return <Navigate to="/" replace />;
  }
  return element;
}

export default function App() {
  const savedUser = typeof window !== 'undefined' ? loadSessionUser() : null;

  // Authentication state — only real Supabase accounts; placeholder is inert until login
  const [isLoggedIn, setIsLoggedIn] = useState(!!savedUser);
  const [user, setUser] = useState<User>(
    savedUser ?? {
      id: '',
      name: 'Signed out',
      email: '',
      role: 'staff',
    },
  );
  /** Bumps when active org changes so experience gate re-evaluates after profile sync. */
  const [orgTick, setOrgTick] = useState(0);
  /**
   * Avoid flashing the sales shell for restaurant staff while org_id is still
   * being restored from the profile (localStorage empty on first paint).
   */
  const [experienceReady, setExperienceReady] = useState(() => {
    if (!savedUser) return true;
    if (savedUser.role === 'platform_owner') return true;
    return Boolean(typeof window !== 'undefined' && getActiveOrgId());
  });

  useEffect(() => subscribeActiveOrg(() => setOrgTick((n) => n + 1)), []);

  useEffect(() => {
    const restore = async () => {
      const rejectNonStaff = async (role: string) => {
        if (role === 'customer' || role === 'kiosk') {
          clearSessionUser();
          setIsLoggedIn(false);
          if (isSupabaseConfigured()) {
            try {
              const { getSupabase } = await import('../lib/supabase/client');
              await getSupabase().auth.signOut();
            } catch {
              // ignore
            }
          }
          setExperienceReady(true);
          return true;
        }
        return false;
      };

      const stored = loadSessionUser();
      if (stored) {
        if (await rejectNonStaff(stored.role)) return;
        setUser(stored);
        setIsLoggedIn(true);
        await syncActiveOrgFromProfile();
        await integrationService.initOrgOpenAIKey(stored.role);
        setOrgTick((n) => n + 1);
        setExperienceReady(true);
        return;
      }

      if (isSupabaseConfigured()) {
        try {
          const { getSupabase } = await import('../lib/supabase/client');
          const supabase = getSupabase();
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('id, name, email, role')
              .eq('id', data.session.user.id)
              .single();
            if (profile) {
              const role = (profile.role ?? 'staff') as UserRole;
              if (await rejectNonStaff(role)) return;
              const restored: User = {
                id: profile.id,
                name: profile.name ?? profile.email?.split('@')[0] ?? 'User',
                email: profile.email ?? data.session.user.email ?? '',
                role,
              };
              saveSessionUser(restored);
              setUser(restored);
              setIsLoggedIn(true);
              await syncActiveOrgFromProfile();
              await integrationService.initOrgOpenAIKey(restored.role);
              setOrgTick((n) => n + 1);
              setExperienceReady(true);
              return;
            }
          }
        } catch {
          // session restore optional
        }
      }
      setExperienceReady(true);
    };
    void restore();
  }, []);

  // Load data from localStorage
  const migrateCustomers = (items: Customer[]): Customer[] =>
    items.map(c => ({
      ...c,
      whatsappOptIn: c.whatsappOptIn ?? true,
      preferredChannel: c.preferredChannel ?? 'both',
      preferredLanguage: c.preferredLanguage ?? 'en',
      tags: c.tags ?? [],
    }));

  const mergeCrmLeads = (items: Customer[]): Customer[] => {
    const ids = new Set(items.map((c) => c.id));
    const merged = [...items];
    for (const lead of crmLeadSeed) {
      if (!ids.has(lead.id)) merged.push(lead);
    }
    return merged;
  };

  const [customers, setCustomers] = useState<Customer[]>(() => {
    if (CLOUD_MODE) return [];
    const saved = localStorage.getItem('customers');
    const base = saved
      ? migrateCustomers(JSON.parse(saved))
      : migrateCustomers(testCustomers as Customer[]);
    return mergeCrmLeads(base);
  });

  // Food menu rows (Sync2Dine) must never get the BD 'bathroom' tradeId stamp —
  // the phone agent's getMenu filters bathroom categories out of the menu.
  const FOOD_MENU_CATEGORIES = new Set(['starters', 'mains', 'sides', 'drinks', 'desserts', 'specials']);
  const migrateProducts = (items: Product[]): Product[] =>
    items.map(p => ({
      ...p,
      tradeId: FOOD_MENU_CATEGORIES.has(String(p.category ?? '').toLowerCase())
        ? null
        : (p.tradeId ?? 'bathroom'),
    }));

  const migrateQuotes = (items: Quote[]): Quote[] =>
    items.map(q => {
      const base = {
        ...q,
        customerName: q.customerName ?? 'Unknown customer',
        tradeId: q.tradeName === 'Small Jobs' ? q.tradeId : (q.tradeId ?? 'bathroom'),
        tradeName: q.tradeName ?? 'Bathroom',
        items: q.items ?? [],
        labour: q.labour ?? [],
        extras: q.extras ?? [],
        total: q.total ?? 0,
        status: q.status ?? 'draft',
      };
      const lines = migrateQuoteToLines(base);
      return { ...base, lines };
    });

  const migratePricingRules = (items: PricingRule[]): PricingRule[] =>
    items.map(r => ({ ...r, tradeId: r.tradeId === undefined ? null : r.tradeId }));

  const [products, setProducts] = useState<Product[]>(() => {
    if (CLOUD_MODE) return [];
    const saved = localStorage.getItem('products');
    if (saved) return migrateProducts(JSON.parse(saved));
    return allTradeProducts;
  });

  const [pricingRules, setPricingRules] = useState<PricingRule[]>(() => {
    if (CLOUD_MODE) return [];
    const saved = localStorage.getItem('pricingRules');
    return saved ? migratePricingRules(JSON.parse(saved)) : tradePricingRules;
  });

  const [quotes, setQuotes] = useState<Quote[]>(() => {
    if (CLOUD_MODE) return [];
    const saved = localStorage.getItem('quotes');
    if (saved) return migrateQuotes(JSON.parse(saved));

    // Seed with realistic quotes
    return [
      {
        id: '1',
        customerId: '2',
        customerName: 'James Wilson',
        createdAt: new Date(2026, 3, 20).toISOString(),
        expiresAt: new Date(2026, 3, 27).toISOString(),
        items: [],
        labour: [],
        extras: [],
        discount: 0,
        total: 8500,
        status: 'sent',
        tradeId: 'bathroom',
        tradeName: 'Bathroom'
      },
      {
        id: '2',
        customerId: '5',
        customerName: 'Sophie Anderson',
        createdAt: new Date(2026, 3, 18).toISOString(),
        expiresAt: new Date(2026, 3, 25).toISOString(),
        items: [],
        labour: [],
        extras: [],
        discount: 0,
        total: 12400,
        status: 'sent',
        tradeId: 'kitchen',
        tradeName: 'Kitchen'
      },
      {
        id: '3',
        customerId: '3',
        customerName: 'Emma Clarke',
        createdAt: new Date(2026, 3, 10).toISOString(),
        expiresAt: new Date(2026, 3, 17).toISOString(),
        items: [],
        labour: [],
        extras: [],
        discount: 15,
        total: 7225,
        status: 'accepted',
        tradeId: 'bathroom',
        tradeName: 'Bathroom'
      },
      {
        id: '4',
        customerId: '9',
        customerName: 'Olivia Martin',
        createdAt: new Date(2026, 3, 22).toISOString(),
        expiresAt: new Date(2026, 3, 29).toISOString(),
        items: [],
        labour: [],
        extras: [],
        discount: 0,
        total: 5200,
        status: 'sent',
        tradeId: 'electrical',
        tradeName: 'Electrical'
      },
      {
        id: '5',
        customerId: '10',
        customerName: 'Daniel White',
        createdAt: new Date(2026, 3, 8).toISOString(),
        expiresAt: new Date(2026, 3, 15).toISOString(),
        items: [],
        labour: [],
        extras: [],
        discount: 10,
        total: 15800,
        status: 'accepted',
        tradeId: 'loft',
        tradeName: 'Loft Conversion'
      }
    ];
  });

  const [recruitmentAccess, setRecruitmentAccessState] = useState<RecruitmentAccess>(() => {
    const saved = localStorage.getItem('recruitmentAccess');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { staff: !!parsed.staff, manager: !!parsed.manager };
      } catch {
        // fall through to default
      }
    }
    return { staff: false, manager: false };
  });

  const setRecruitmentAccess = (next: RecruitmentAccess) => {
    setRecruitmentAccessState(next);
    localStorage.setItem('recruitmentAccess', JSON.stringify(next));
  };

  const [accountsAccess, setAccountsAccessState] = useState<AccountsAccess>(() => {
    const saved = localStorage.getItem('accountsAccess');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { staff: !!parsed.staff, manager: !!parsed.manager };
      } catch {
        // fall through to default
      }
    }
    return { staff: false, manager: false };
  });

  const setAccountsAccess = (next: AccountsAccess) => {
    setAccountsAccessState(next);
    localStorage.setItem('accountsAccess', JSON.stringify(next));
  };

  const cloudHydratedRef = useRef(!CLOUD_MODE);

  useEffect(() => {
    const stopScheduler = startPmScheduler();
    return () => stopScheduler();
  }, []);

  useEffect(() => {
    return installApiFetchInterceptor();
  }, []);

  useEffect(() => {
    void loadProjectsAsync();
    void initBankingStore();
    const unsub = initProjectsRealtime();
    void (async () => {
      await syncActiveOrgFromProfile();
      await ensureActiveOrgId();
      await initCompanyProfile();
      await integrationService.initOrgOpenAIKey();

      try {
        const {
          isSupabaseConfigured,
          loadCustomersFromSupabase,
          loadQuotesFromSupabase,
          loadProductsFromSupabase,
          loadPricingRulesFromSupabase,
        } = await import('./engine/data/supabaseStore');
        if (!isSupabaseConfigured()) {
          cloudHydratedRef.current = true;
          return;
        }
        const [remoteCustomers, remoteQuotes, remoteProducts, remoteRules] = await Promise.all([
          loadCustomersFromSupabase(),
          loadQuotesFromSupabase(),
          loadProductsFromSupabase(),
          loadPricingRulesFromSupabase(),
        ]);
        if (remoteCustomers.length) {
          const remote = migrateCustomers(remoteCustomers as Customer[]);
          setCustomers((prev) => (prev.length ? unionById(remote, prev) : remote));
        } else if (!CLOUD_MODE) {
          setCustomers((prev) => (prev.length ? prev : mergeCrmLeads(migrateCustomers(testCustomers as Customer[]))));
        }
        if (remoteQuotes.length) {
          const remote = migrateQuotes(remoteQuotes as Quote[]);
          setQuotes((prev) => (prev.length ? unionById(remote, prev) : remote));
        }
        if (remoteProducts.length) setProducts(migrateProducts(remoteProducts as Product[]));
        else if (!CLOUD_MODE && remoteProducts.length === 0) setProducts((prev) => (prev.length ? prev : allTradeProducts));
        if (remoteRules.length) setPricingRules(migratePricingRules(remoteRules as PricingRule[]));
        else if (!CLOUD_MODE) setPricingRules((prev) => (prev.length ? prev : tradePricingRules));
      } catch {
        // ignore hydrate failures — keep in-memory state
      } finally {
        cloudHydratedRef.current = true;
      }
    })();
    return unsub;
  }, []);

  // Refresh from localStorage when contract sign closes a deal in another view
  useEffect(() => {
    const onQuotes = () => {
      try {
        const saved = localStorage.getItem('quotes');
        // In cloud mode, localStorage is not the source of truth — ignore to avoid clobber.
        if (CLOUD_MODE) return;
        if (saved) setQuotes(migrateQuotes(JSON.parse(saved)));
      } catch { /* ignore */ }
    };
    const onCustomers = () => {
      try {
        const saved = localStorage.getItem('customers');
        if (CLOUD_MODE) return;
        if (saved) setCustomers(mergeCrmLeads(migrateCustomers(JSON.parse(saved))));
      } catch { /* ignore */ }
    };
    window.addEventListener('tradepro:quotes-updated', onQuotes);
    window.addEventListener('tradepro:customers-updated', onCustomers);
    return () => {
      window.removeEventListener('tradepro:quotes-updated', onQuotes);
      window.removeEventListener('tradepro:customers-updated', onCustomers);
    };
  }, []);

  // Persist — Supabase when configured; localStorage only in offline dev
  useEffect(() => {
    if (useCloudPersistence()) {
      // Skip the empty initial state before hydrate so we never race ahead of load
      if (!cloudHydratedRef.current && customers.length === 0) return;
      void import('./engine/data/supabaseStore').then(({ saveCustomersToSupabase }) => {
        void saveCustomersToSupabase(customers as unknown as Record<string, unknown>[]).then((err) => {
          if (err) {
            window.dispatchEvent(
              new CustomEvent('tradepro:persist-error', {
                detail: { table: 'customers', error: err },
              }),
            );
          }
        });
      });
    } else {
      localStorage.setItem('customers', JSON.stringify(customers));
    }
    seedContactsFromCustomers(customers);
    if (!useCloudPersistence()) void syncToServer();
  }, [customers]);

  useEffect(() => {
    if (useCloudPersistence()) {
      if (!cloudHydratedRef.current && products.length === 0) return;
      void import('./engine/data/supabaseStore').then(({ saveProductsToSupabase }) => {
        void saveProductsToSupabase(products as unknown as Record<string, unknown>[]);
      });
    } else {
      localStorage.setItem('products', JSON.stringify(products));
    }
  }, [products]);

  useEffect(() => {
    if (useCloudPersistence()) {
      if (!cloudHydratedRef.current && pricingRules.length === 0) return;
      void import('./engine/data/supabaseStore').then(({ savePricingRulesToSupabase }) => {
        void savePricingRulesToSupabase(pricingRules as unknown as Record<string, unknown>[]);
      });
    } else {
      localStorage.setItem('pricingRules', JSON.stringify(pricingRules));
    }
  }, [pricingRules]);

  useEffect(() => {
    const cloud = useCloudPersistence();
    if (cloud) {
      if (!cloudHydratedRef.current && quotes.length === 0) return;
      void import('./engine/data/supabaseStore').then(({ saveQuotesToSupabase }) => {
        void saveQuotesToSupabase(quotes as unknown as Record<string, unknown>[]).then((err) => {
          if (err) {
            window.dispatchEvent(
              new CustomEvent('tradepro:persist-error', {
                detail: { table: 'quotes', error: err },
              }),
            );
          }
        });
      });
    } else {
      localStorage.setItem('quotes', JSON.stringify(quotes));
      void syncToServer();
    }
  }, [quotes]);

  // CRUD operations
  const mirrorCustomerToPhoneBackend = (customer: Customer) => {
    void fetch('/api/customers/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customer }),
    }).catch(() => {});
  };

  const addCustomer = (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const newCustomer = {
      ...customer,
      whatsappOptIn: customer.whatsappOptIn ?? false,
      preferredChannel: customer.preferredChannel ?? 'email',
      preferredLanguage: customer.preferredLanguage ?? 'en',
      id: Date.now().toString(),
      createdAt: new Date().toISOString()
    };
    setCustomers((prev) => {
      const next = [...prev, newCustomer];
      // Persist immediately with the next list so refresh doesn't lose the row
      // before the effect runs (and so we use the correct array, not a stale closure).
      if (useCloudPersistence()) {
        void import('./engine/data/supabaseStore').then(({ saveCustomersToSupabase }) => {
          void saveCustomersToSupabase(next as unknown as Record<string, unknown>[]).then((err) => {
            if (err) {
              window.dispatchEvent(
                new CustomEvent('tradepro:persist-error', {
                  detail: { table: 'customers', error: err },
                }),
              );
            }
          });
        });
      }
      return next;
    });
    mirrorCustomerToPhoneBackend(newCustomer);
    return newCustomer;
  };

  const upsertCustomer = (customer: Customer) => {
    setCustomers(prev => {
      const idx = prev.findIndex(c => c.id === customer.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...customer };
        mirrorCustomerToPhoneBackend(next[idx]);
        return next;
      }
      mirrorCustomerToPhoneBackend(customer);
      return [...prev, customer];
    });
  };

  const updateCustomer = (id: string, updates: Partial<Customer>) => {
    setCustomers((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...updates } : c));
      const updated = next.find((c) => c.id === id);
      if (updated) mirrorCustomerToPhoneBackend(updated);
      return next;
    });
  };

  const deleteCustomer = (id: string) => {
    setCustomers(customers.filter(c => c.id !== id));
  };

  const addProduct = (product: Omit<Product, 'id' | 'sellPrice'>) => {
    const sellPrice = product.basePrice * (1 + product.margin / 100);
    const newProduct = {
      ...product,
      id: Date.now().toString(),
      sellPrice
    };
    setProducts([...products, newProduct]);
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(products.map(p => {
      if (p.id === id) {
        const updated = { ...p, ...updates };
        if (updates.basePrice !== undefined || updates.margin !== undefined) {
          updated.sellPrice = updated.basePrice * (1 + updated.margin / 100);
        }
        return updated;
      }
      return p;
    }));
  };

  const deleteProduct = (id: string) => {
    setProducts(products.filter(p => p.id !== id));
  };

  const addQuote = (quote: Omit<Quote, 'id' | 'createdAt'>): Quote => {
    const lines = quote.lines?.length ? quote.lines : migrateQuoteToLines(quote as Quote);
    const newQuote: Quote = {
      ...quote,
      lines,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    setQuotes((prev) => {
      const next = [...prev, newQuote];
      // Eager cloud persist (parity with addCustomer) so refresh does not lose the row
      if (useCloudPersistence()) {
        void import('./engine/data/supabaseStore').then(({ saveQuotesToSupabase }) => {
          void saveQuotesToSupabase(next as unknown as Record<string, unknown>[]).then((err) => {
            if (err) {
              window.dispatchEvent(
                new CustomEvent('tradepro:persist-error', {
                  detail: { table: 'quotes', error: err },
                }),
              );
            }
          });
        });
      }
      return next;
    });
    if (quote.customerId && quote.status) {
      setCustomers((prev) => {
        const patch = syncCustomerStatusFromQuote(quote.customerId!, quote.status!, prev);
        if (!patch) return prev;
        return prev.map((c) => (c.id === quote.customerId ? { ...c, ...patch } : c));
      });
    }
    return newQuote;
  };

  const updateQuote = (id: string, updates: Partial<Quote>) => {
    setQuotes((prev) => {
      const next = prev.map((q) => {
        if (q.id !== id) return q;
        const merged = { ...q, ...updates };
        if (updates.lines) merged.lines = updates.lines;
        return merged;
      });
      const updated = next.find((q) => q.id === id);
      if (updated?.customerId && updates.status) {
        setCustomers((custPrev) => {
          const patch = syncCustomerStatusFromQuote(updated.customerId!, updates.status!, custPrev);
          if (!patch) return custPrev;
          return custPrev.map((c) => (c.id === updated.customerId ? { ...c, ...patch } : c));
        });
      }
      return next;
    });
  };

  const deleteQuote = (id: string) => {
    setQuotes(quotes.filter(q => q.id !== id));
  };

  const addPricingRule = (rule: Omit<PricingRule, 'id'>) => {
    const newRule = {
      ...rule,
      id: Date.now().toString()
    };
    setPricingRules([...pricingRules, newRule]);
  };

  const updatePricingRule = (id: string, updates: Partial<PricingRule>) => {
    setPricingRules(pricingRules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const deletePricingRule = (id: string) => {
    setPricingRules(pricingRules.filter(r => r.id !== id));
  };

  const importDataBundle = (
    bundle: TradeProExportBundle,
    options: { strategy: MergeStrategy }
  ): ImportResult => {
    const { strategy } = options;
    const result: ImportResult = { added: 0, updated: 0, skipped: 0, errors: [] };
    const { data } = bundle;

    try {
      if (data.customers) {
        const incoming = migrateCustomers(data.customers);
        const merged = mergeById(customers, incoming, strategy);
        setCustomers(merged.result);
        result.added += merged.added;
        result.updated += merged.updated;
        result.skipped += merged.skipped;
      }

      if (data.quotes) {
        const incoming = migrateQuotes(data.quotes);
        const merged = mergeById(quotes, incoming, strategy);
        setQuotes(merged.result);
        result.added += merged.added;
        result.updated += merged.updated;
        result.skipped += merged.skipped;
      }

      if (data.products) {
        const incoming = migrateProducts(data.products);
        const merged = mergeById(products, incoming, strategy);
        setProducts(merged.result);
        result.added += merged.added;
        result.updated += merged.updated;
        result.skipped += merged.skipped;
      }

      if (data.pricingRules) {
        const incoming = migratePricingRules(data.pricingRules);
        const merged = mergeById(pricingRules, incoming, strategy);
        setPricingRules(merged.result);
        result.added += merged.added;
        result.updated += merged.updated;
        result.skipped += merged.skipped;
      }

      if (data.surveys) {
        const merged = mergeById(loadSurveys(), data.surveys, strategy);
        saveSurveys(merged.result);
        result.added += merged.added;
        result.updated += merged.updated;
        result.skipped += merged.skipped;
      }

      if (bundle.scope === 'full') {
        if (data.projects) {
          const merged = mergeById(loadProjects(), data.projects, strategy);
          saveProjects(merged.result);
          result.added += merged.added;
          result.updated += merged.updated;
          result.skipped += merged.skipped;
        }

        if (data.contacts) {
          const merged = mergeById(loadContacts(), data.contacts, strategy);
          saveContacts(merged.result);
          result.added += merged.added;
          result.updated += merged.updated;
          result.skipped += merged.skipped;
        }

        if (data.builders) {
          const merged = mergeById(loadBuilders(), data.builders, strategy);
          saveBuilders(merged.result);
          result.added += merged.added;
          result.updated += merged.updated;
          result.skipped += merged.skipped;
        }

        if (data.planningApplications) {
          const merged = mergeById(loadPlanningApplications(), data.planningApplications, strategy);
          localStorage.setItem('tradepro_planning_applications', JSON.stringify(merged.result));
          result.added += merged.added;
          result.updated += merged.updated;
          result.skipped += merged.skipped;
        }

        if (data.bankAccounts) {
          const merged = mergeById(loadBankAccounts(), data.bankAccounts, strategy);
          saveBankAccounts(merged.result);
          result.added += merged.added;
          result.updated += merged.updated;
          result.skipped += merged.skipped;
        }

        if (data.bankTransactions) {
          const merged = mergeById(loadBankTransactions(), data.bankTransactions, strategy);
          saveBankTransactions(merged.result);
          result.added += merged.added;
          result.updated += merged.updated;
          result.skipped += merged.skipped;
        }

        if (data.clientReceipts) {
          const merged = mergeById(loadClientReceipts(), data.clientReceipts, strategy);
          saveClientReceipts(merged.result);
          result.added += merged.added;
          result.updated += merged.updated;
          result.skipped += merged.skipped;
        }
      }

      void syncToServer();
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : 'Import failed.');
    }

    return result;
  };

  const handleLogin = (userData: User) => {
    setUser(userData);
    setIsLoggedIn(true);
    saveSessionUser(userData);
    let orgId: string | undefined;
    try {
      orgId = localStorage.getItem('tradepro_active_org_id') || localStorage.getItem('activeOrgId') || undefined;
    } catch { /* ignore */ }
    void registerDeviceTokenIfNative(userData.id, orgId);
    void requestNativeNotifications();
  };

  const handleLogout = () => {
    clearSessionUser();
    const finish = () => {
      setIsLoggedIn(false);
      setUser({
        id: '',
        name: 'Signed out',
        email: '',
        role: 'staff',
      });
    };
    if (isSupabaseConfigured()) {
      // Sign out of Supabase BEFORE showing the login page, otherwise the
      // login page's session check signs the same user straight back in.
      void import('../lib/supabase/client')
        .then(({ getSupabase }) => getSupabase().auth.signOut())
        .catch(() => undefined)
        .then(finish);
    } else {
      finish();
    }
  };

  const contextValue: AppContextType = {
    user,
    customers,
    products,
    pricingRules,
    quotes,
    recruitmentAccess,
    setRecruitmentAccess,
    accountsAccess,
    setAccountsAccess,
    addCustomer,
    upsertCustomer,
    updateCustomer,
    deleteCustomer,
    addProduct,
    updateProduct,
    deleteProduct,
    addQuote,
    updateQuote,
    deleteQuote,
    addPricingRule,
    updatePricingRule,
    deletePricingRule,
    importDataBundle,
    logout: handleLogout
  };

  const experience = useMemo(() => getExperience(user.role), [user.role, orgTick]);

  if (typeof window !== 'undefined' && window.location.pathname === '/cursor-paste') {
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/cursor-paste" element={<CursorPastePage />} />
        </Routes>
      </BrowserRouter>
    );
  }

  if (!isLoggedIn) {
    const RedirectToMarketing = ({ path = '/' }: { path?: string }) => {
      if (typeof window !== 'undefined') {
        window.location.replace(`https://sync2dine.io${path}`);
      }
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#f6efe0] px-6 text-center">
          <p className="text-lg font-semibold text-[#0f3d3e]">
            Taking you to Sync2Dine…
          </p>
        </div>
      );
    };
    return (
      <BrowserRouter>
        <OnlineStatusBanner />
        <Routes>
          <Route path="/cursor-paste" element={<CursorPastePage />} />
          <Route path="/front" element={<FrontKiosk />} />
          <Route path="/integrations" element={<IntegrationsPublicPage />} />
          {/* Public marketing lives on sync2dine.io; app host is login-gated during live testing */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/pricing" element={<RedirectToMarketing path="/pricing/" />} />
          <Route path="/start" element={<RedirectToMarketing path="/inquiry/" />} />
          <Route path="/judie" element={<RedirectToMarketing path="/ai-phone-ordering/" />} />
          <Route path="/atmosphere" element={<RedirectToMarketing path="/" />} />
          <Route path="/legal/terms" element={<TermsPage />} />
          <Route path="/legal/fair-use-and-fares" element={<FairUseAndFaresPage />} />
          <Route path="/legal/privacy" element={<PrivacyPage />} />
          <Route path="/legal/acceptable-use" element={<AcceptableUsePage />} />
          <Route path="/legal/cookies" element={<CookiesPage />} />
          <Route path="/legal/cancellation-refunds" element={<CancellationRefundsPage />} />
          <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/invite/:token" element={<InviteAcceptPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
        <Toaster />
      </BrowserRouter>
    );
  }

  if (isLoggedIn && !experienceReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6efe0]">
        <p className="text-lg font-semibold text-[#0f3d3e]">Loading…</p>
      </div>
    );
  }

  if (experience === 'restaurant') {
    return (
      <AppContext.Provider value={contextValue}>
        <BrowserRouter>
          <Routes>
            {/* Public diner kiosk (also reachable logged-in for staff preview) */}
            <Route path="/front" element={<FrontKiosk />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/start" element={<StartCheckoutFlow />} />
            <Route path="/judie" element={<JudieLandingPage />} />
            <Route path="/atmosphere" element={<AtmosphereLandingPage />} />
            <Route path="/legal/terms" element={<TermsPage />} />
            <Route path="/legal/fair-use-and-fares" element={<FairUseAndFaresPage />} />
            <Route path="/legal/privacy" element={<PrivacyPage />} />
            <Route path="/legal/acceptable-use" element={<AcceptableUsePage />} />
            <Route path="/legal/cookies" element={<CookiesPage />} />
            <Route path="/legal/cancellation-refunds" element={<CancellationRefundsPage />} />
            <Route
              element={(
                <RestaurantShell>
                  <Outlet />
                </RestaurantShell>
              )}
            >
              <Route path="/" element={<RestaurantLive />} />
              <Route path="/orders" element={<Navigate to="/orders/kitchen" replace />} />
              <Route path="/orders/kitchen" element={<RestaurantOrders tab="kitchen" showTabs={false} />} />
              <Route
                path="/orders/till"
                element={<ProtectedRoute element={<RestaurantTill />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route path="/orders/delivery" element={<RestaurantOrders tab="delivery" showTabs={false} />} />
              <Route
                path="/bookings"
                element={<ProtectedRoute element={<BookingsBoard />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/menu"
                element={<ProtectedRoute element={<MenuManager />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route path="/products" element={<Navigate to="/menu" replace />} />
              <Route
                path="/customers"
                element={<ProtectedRoute element={<CustomerManagement />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/calls"
                element={<ProtectedRoute element={<CallCenter />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/call-register"
                element={<ProtectedRoute element={<CallRegister />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/accounts"
                element={<ProtectedRoute element={<RestaurantAccounts />} allowedRoles={['super_admin', 'manager']} user={user} />}
              />
              <Route path="/team" element={<Navigate to="/settings" replace />} />
              <Route path="/settings" element={<RestaurantSettings />} />
              <Route path="/integrations" element={<IntegrationsPublicPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/password" element={<ChangePasswordPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AppContext.Provider>
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <AIAssistantProvider>
      <BrowserRouter>
            <Routes>
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/start" element={<StartCheckoutFlow />} />
              <Route path="/judie" element={<JudieLandingPage />} />
              <Route path="/atmosphere" element={<AtmosphereLandingPage />} />
              <Route path="/legal/terms" element={<TermsPage />} />
              <Route path="/legal/fair-use-and-fares" element={<FairUseAndFaresPage />} />
              <Route path="/legal/privacy" element={<PrivacyPage />} />
              <Route path="/legal/acceptable-use" element={<AcceptableUsePage />} />
              <Route path="/legal/cookies" element={<CookiesPage />} />
              <Route path="/legal/cancellation-refunds" element={<CancellationRefundsPage />} />
              <Route path="/front" element={<FrontKiosk />} />
              <Route
                element={(
                  <AppShell>
                    <Outlet />
                  </AppShell>
                )}
              >
              <Route path="/" element={<SalesDashboard />} />
              <Route
                path="/crm"
                element={<ProtectedRoute element={<ComprehensiveCRM />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/quotes"
                element={<ProtectedRoute element={<QuotesList />} allowedRoles={['super_admin', 'manager', 'staff', 'platform_owner']} user={user} />}
              />
              <Route
                path="/quote/saas"
                element={<ProtectedRoute element={<SaasQuoteBuilder />} allowedRoles={['super_admin', 'manager', 'staff', 'platform_owner']} user={user} />}
              />
              <Route
                path="/quote/saas/:customerId"
                element={<ProtectedRoute element={<SaasQuoteBuilder />} allowedRoles={['super_admin', 'manager', 'staff', 'platform_owner']} user={user} />}
              />
              <Route
                path="/customers"
                element={<ProtectedRoute element={<CustomerManagement />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/orders"
                element={<ProtectedRoute element={<RestaurantOrders />} allowedRoles={['platform_owner', 'super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/products"
                element={<Navigate to="/platform/clients" replace />}
              />
              <Route
                path="/email"
                element={<ProtectedRoute element={<CommunicationsHub />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/communications"
                element={<ProtectedRoute element={<CommunicationsHub />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/cynthia"
                element={<ProtectedRoute element={<CynthiaHome />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/cynthia/ingest"
                element={<ProtectedRoute element={<CynthiaHome />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route path="/cyrus" element={<Navigate to="/cynthia" replace />} />
              <Route
                path="/cyrus/legacy"
                element={<ProtectedRoute element={<CyrusConversations />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/whatsapp"
                element={<ProtectedRoute element={<CyrusConversations />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/calls"
                element={<ProtectedRoute element={<CallCenter />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/call-register"
                element={<ProtectedRoute element={<CallRegister />} allowedRoles={['super_admin', 'manager', 'staff']} user={user} />}
              />
              <Route
                path="/agent"
                element={<Navigate to="/calls" replace />}
              />
              <Route
                path="/integrations"
                element={<ProtectedRoute element={<IntegrationsHub />} allowedRoles={['super_admin']} user={user} />}
              />
              <Route
                path="/settings"
                element={<ProtectedRoute element={<Settings />} allowedRoles={['super_admin']} user={user} />}
              />
              <Route
                path="/team"
                element={<ProtectedRoute element={<TeamManagement />} allowedRoles={['super_admin']} user={user} />}
              />
              <Route
                path="/sales"
                element={<ProtectedRoute element={<SalesManagement />} allowedRoles={['super_admin']} user={user} />}
              />
              <Route
                path="/recruitment"
                element={
                  canAccessRecruitment(user.role, recruitmentAccess)
                    ? <RecruitmentCRM />
                    : <Navigate to="/" replace />
                }
              />
              <Route
                path="/accounts"
                element={
                  canAccessAccounts(user.role, accountsAccess)
                    ? <AccountsHub />
                    : <Navigate to="/" replace />
                }
              />
              <Route
                path="/platform/clients"
                element={
                  <ProtectedRoute
                    element={<PlatformClientsCRM />}
                    allowedRoles={['platform_owner']}
                    user={user}
                  />
                }
              />
              <Route
                path="/platform/sally-offer"
                element={
                  <ProtectedRoute
                    element={<SallyOfferSettings />}
                    allowedRoles={['platform_owner']}
                    user={user}
                  />
                }
              />
              <Route
                path="/platform/sally-knowledge"
                element={
                  <ProtectedRoute
                    element={<SallyKnowledgePanel />}
                    allowedRoles={['platform_owner']}
                    user={user}
                  />
                }
              />
              <Route
                path="/platform/sales-brain"
                element={
                  <ProtectedRoute
                    element={<SalesBrainPanel />}
                    allowedRoles={['platform_owner']}
                    user={user}
                  />
                }
              />
              <Route
                path="/platform/clients/:orgId/menu"
                element={
                  <ProtectedRoute
                    element={<MenuPreview />}
                    allowedRoles={['platform_owner']}
                    user={user}
                  />
                }
              />
              <Route
                path="/ai-audit"
                element={<ProtectedRoute element={<ConversationAudit />} allowedRoles={['super_admin', 'manager']} user={user} />}
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/profile/password" element={<ChangePasswordPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
              </Route>
            </Routes>
          <Toaster />
      </BrowserRouter>
      </AIAssistantProvider>
    </AppContext.Provider>
  );
}
