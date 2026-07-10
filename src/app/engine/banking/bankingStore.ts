import type { BankAccount, BankTransaction, ClientReceipt, TransactionCategory } from './types';

const ACCOUNTS_KEY = 'bankAccounts';
const TRANSACTIONS_KEY = 'bankTransactions';
const RECEIPTS_KEY = 'clientReceipts';

function seedAccounts(): BankAccount[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'BA001',
      name: 'TradePro Business Current',
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
      name: 'TradePro Materials Float',
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

export function loadBankAccounts(): BankAccount[] {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) as BankAccount[];
  } catch {
    // fall through
  }
  const seeded = seedAccounts();
  saveBankAccounts(seeded);
  return seeded;
}

export function saveBankAccounts(accounts: BankAccount[]): void {
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
}

export function loadBankTransactions(): BankTransaction[] {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (raw) return JSON.parse(raw) as BankTransaction[];
  } catch {
    // fall through
  }
  const seeded = seedTransactions();
  saveBankTransactions(seeded);
  return seeded;
}

export function saveBankTransactions(transactions: BankTransaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export function loadClientReceipts(): ClientReceipt[] {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    if (raw) return JSON.parse(raw) as ClientReceipt[];
  } catch {
    // fall through
  }
  return [];
}

export function saveClientReceipts(receipts: ClientReceipt[]): void {
  localStorage.setItem(RECEIPTS_KEY, JSON.stringify(receipts));
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
