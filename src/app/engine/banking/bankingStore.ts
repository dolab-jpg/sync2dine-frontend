import type { BankAccount, BankTransaction, ClientReceipt, TransactionCategory } from './types';
import { readLocalJson, writeLocalJson, useCloudPersistence } from '../data/cloudPersist';

const ACCOUNTS_KEY = 'bankAccounts';
const TRANSACTIONS_KEY = 'bankTransactions';
const RECEIPTS_KEY = 'clientReceipts';

let accountsCache: BankAccount[] | null = null;
let transactionsCache: BankTransaction[] | null = null;
let receiptsCache: ClientReceipt[] | null = null;

function seedAccounts(): BankAccount[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'BA001',
      name: 'Builder Diddies Business Current',
      sortCode: '20-00-00',
      accountNumberMasked: '****4521',
      ibanMasked: 'GB** **** **** **** 4521',
      balance: 42850.75,
      currency: 'GBP',
      provider: 'mock',
      connectedAt: now,
      lastSyncedAt: now,
    },
    {
      id: 'BA002',
      name: 'Builder Diddies Materials Float',
      sortCode: '20-00-00',
      accountNumberMasked: '****8834',
      balance: 12400.0,
      currency: 'GBP',
      provider: 'mock',
      connectedAt: now,
      lastSyncedAt: now,
    },
  ];
}

function seedTransactions(): BankTransaction[] {
  const base = new Date();
  const daysAgo = (n: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
  };
  return [
    {
      id: 'TX001',
      accountId: 'BA001',
      date: daysAgo(2),
      amount: 840,
      direction: 'in',
      description: 'FASTER PAYMENT - AMANDA PETERSON',
      category: 'deposit',
      matchedProjectId: 'P001',
      matchedCustomerId: 'C001',
      reconciled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TX002',
      accountId: 'BA001',
      date: daysAgo(5),
      amount: 5600,
      direction: 'in',
      description: 'BACS - JAMES WILSON REF INV001',
      category: 'stage-payment',
      matchedProjectId: 'P001',
      matchedCustomerId: 'C001',
      reconciled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TX003',
      accountId: 'BA002',
      date: daysAgo(3),
      amount: 312.58,
      direction: 'out',
      description: 'TOPPS TILES LTD',
      category: 'materials',
      matchedProjectId: 'P001',
      reconciled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TX004',
      accountId: 'BA001',
      date: daysAgo(1),
      amount: 1850,
      direction: 'out',
      description: 'MIKE WILSON BUILDERS LTD',
      category: 'subcontractor',
      matchedProjectId: 'P002',
      reconciled: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TX005',
      accountId: 'BA001',
      date: daysAgo(0),
      amount: 450,
      direction: 'out',
      description: 'SHELL FUEL CARD',
      category: 'fuel',
      reconciled: false,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TX006',
      accountId: 'BA001',
      date: daysAgo(7),
      amount: 320,
      direction: 'out',
      description: 'O2 BUSINESS MOBILE',
      category: 'running-costs',
      reconciled: true,
      createdAt: new Date().toISOString(),
    },
    {
      id: 'TX007',
      accountId: 'BA001',
      date: daysAgo(4),
      amount: 2200,
      direction: 'in',
      description: 'FASTER PAYMENT - SARAH CHEN',
      category: 'uncategorised',
      reconciled: false,
      createdAt: new Date().toISOString(),
    },
  ];
}

function persistAccountsToCloud(accounts: BankAccount[]): void {
  void import('../data/supabaseStore').then(({ saveBankAccountsToSupabase }) => {
    void saveBankAccountsToSupabase(accounts as unknown as Record<string, unknown>[]);
  });
}

function persistTransactionsToCloud(transactions: BankTransaction[]): void {
  void import('../data/supabaseStore').then(({ saveBankTransactionsToSupabase }) => {
    void saveBankTransactionsToSupabase(transactions as unknown as Record<string, unknown>[]);
  });
}

function persistReceiptsToCloud(receipts: ClientReceipt[]): void {
  void import('../data/supabaseStore').then(({ saveClientReceiptsToSupabase }) => {
    void saveClientReceiptsToSupabase(receipts as unknown as Record<string, unknown>[]);
  });
}

export async function initBankingStore(): Promise<void> {
  if (!useCloudPersistence()) return;
  const {
    loadBankAccountsFromSupabase,
    loadBankTransactionsFromSupabase,
    loadClientReceiptsFromSupabase,
  } = await import('../data/supabaseStore');
  const [accounts, transactions, receipts] = await Promise.all([
    loadBankAccountsFromSupabase(),
    loadBankTransactionsFromSupabase(),
    loadClientReceiptsFromSupabase(),
  ]);
  accountsCache = accounts.length ? (accounts as unknown as BankAccount[]) : [];
  transactionsCache = transactions.length ? (transactions as unknown as BankTransaction[]) : [];
  receiptsCache = receipts.length ? (receipts as unknown as ClientReceipt[]) : [];
}

export function loadBankAccounts(): BankAccount[] {
  if (useCloudPersistence()) {
    if (accountsCache) return accountsCache;
    return [];
  }
  const cached = readLocalJson<BankAccount[] | null>(ACCOUNTS_KEY, null);
  if (cached?.length) return cached;
  const seeded = seedAccounts();
  saveBankAccounts(seeded);
  return seeded;
}

export function saveBankAccounts(accounts: BankAccount[]): void {
  if (useCloudPersistence()) {
    accountsCache = accounts;
    persistAccountsToCloud(accounts);
    return;
  }
  writeLocalJson(ACCOUNTS_KEY, accounts);
}

export function loadBankTransactions(): BankTransaction[] {
  if (useCloudPersistence()) {
    if (transactionsCache) return transactionsCache;
    return [];
  }
  const cached = readLocalJson<BankTransaction[] | null>(TRANSACTIONS_KEY, null);
  if (cached?.length) return cached;
  const seeded = seedTransactions();
  saveBankTransactions(seeded);
  return seeded;
}

export function saveBankTransactions(transactions: BankTransaction[]): void {
  if (useCloudPersistence()) {
    transactionsCache = transactions;
    persistTransactionsToCloud(transactions);
    return;
  }
  writeLocalJson(TRANSACTIONS_KEY, transactions);
}

export function loadClientReceipts(): ClientReceipt[] {
  if (useCloudPersistence()) {
    if (receiptsCache) return receiptsCache;
    return [];
  }
  return readLocalJson<ClientReceipt[]>(RECEIPTS_KEY, []);
}

export function saveClientReceipts(receipts: ClientReceipt[]): void {
  if (useCloudPersistence()) {
    receiptsCache = receipts;
    persistReceiptsToCloud(receipts);
    return;
  }
  writeLocalJson(RECEIPTS_KEY, receipts);
}

export function updateTransaction(
  id: string,
  patch: Partial<BankTransaction>
): BankTransaction | undefined {
  const list = loadBankTransactions();
  const idx = list.findIndex((t) => t.id === id);
  if (idx < 0) return undefined;
  list[idx] = { ...list[idx], ...patch };
  saveBankTransactions(list);
  return list[idx];
}

export function addClientReceipt(receipt: Omit<ClientReceipt, 'id' | 'createdAt'>): ClientReceipt {
  const record: ClientReceipt = {
    ...receipt,
    id: `RCP${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  const list = [record, ...loadClientReceipts()];
  saveClientReceipts(list);
  return record;
}

export function categorizeTransaction(
  id: string,
  category: TransactionCategory,
  reason?: string,
  match?: Partial<Pick<BankTransaction, 'matchedProjectId' | 'matchedCustomerId' | 'matchedInvoiceId' | 'matchedStageId'>>
): BankTransaction | undefined {
  return updateTransaction(id, {
    category,
    aiCategory: category,
    aiCategoryReason: reason,
    ...match,
    reconciled: Boolean(match?.matchedProjectId),
  });
}

export function getTotalCashBalance(): number {
  return loadBankAccounts().reduce((sum, a) => sum + a.balance, 0);
}

export function getIncomingTotal(transactions?: BankTransaction[]): number {
  const list = transactions ?? loadBankTransactions();
  return list.filter((t) => t.direction === 'in').reduce((s, t) => s + t.amount, 0);
}

export function getOutgoingTotal(transactions?: BankTransaction[]): number {
  const list = transactions ?? loadBankTransactions();
  return list.filter((t) => t.direction === 'out').reduce((s, t) => s + t.amount, 0);
}
