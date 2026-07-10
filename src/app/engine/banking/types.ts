/** Income categories for incoming bank transactions */
export type IncomeCategory =
  | 'deposit'
  | 'stage-payment'
  | 'final-payment'
  | 'refund-received'
  | 'other-income';

/** Outgoing expense categories */
export type ExpenseCategory =
  | 'materials'
  | 'subcontractor'
  | 'wages'
  | 'tools'
  | 'fuel'
  | 'overheads'
  | 'running-costs'
  | 'tax'
  | 'other';

export type TransactionCategory = IncomeCategory | ExpenseCategory | 'uncategorised';

export type TransactionDirection = 'in' | 'out';

export type BankingProvider = 'mock' | 'truelayer' | 'gocardless' | 'plaid';

export interface BankAccount {
  id: string;
  name: string;
  sortCode: string;
  accountNumberMasked: string;
  ibanMasked?: string;
  balance: number;
  currency: string;
  provider: BankingProvider;
  connectedAt: string;
  lastSyncedAt?: string;
}

export interface BankTransaction {
  id: string;
  accountId: string;
  date: string;
  amount: number;
  direction: TransactionDirection;
  description: string;
  category: TransactionCategory;
  aiCategory?: TransactionCategory;
  aiCategoryReason?: string;
  matchedProjectId?: string;
  matchedInvoiceId?: string;
  matchedCustomerId?: string;
  matchedStageId?: string;
  reconciled: boolean;
  createdAt: string;
}

export interface ClientReceipt {
  id: string;
  customerId: string;
  customerName: string;
  projectId: string;
  projectName: string;
  invoiceId?: string;
  stageId?: string;
  transactionId?: string;
  amount: number;
  date: string;
  pdfPath?: string;
  sentVia?: 'email' | 'whatsapp' | 'both';
  sentAt?: string;
  createdAt: string;
}

export const INCOME_CATEGORIES: IncomeCategory[] = [
  'deposit',
  'stage-payment',
  'final-payment',
  'refund-received',
  'other-income',
];

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'materials',
  'subcontractor',
  'wages',
  'tools',
  'fuel',
  'overheads',
  'running-costs',
  'tax',
  'other',
];

export const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  deposit: 'Booking deposit',
  'stage-payment': 'Stage payment',
  'final-payment': 'Final payment',
  'refund-received': 'Refund received',
  'other-income': 'Other income',
  materials: 'Materials',
  subcontractor: 'Subcontractor',
  wages: 'Wages / labour',
  tools: 'Tools & equipment',
  fuel: 'Fuel & travel',
  overheads: 'Overheads',
  'running-costs': 'Company running costs',
  tax: 'Tax & HMRC',
  other: 'Other',
  uncategorised: 'Uncategorised',
};

export interface CategorizeTransactionResult {
  category: TransactionCategory;
  reason: string;
  suggestedMatch?: {
    projectId?: string;
    customerId?: string;
    invoiceId?: string;
    stageId?: string;
  };
}
