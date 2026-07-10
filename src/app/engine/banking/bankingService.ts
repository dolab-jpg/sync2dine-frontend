import type { BankAccount, BankTransaction, CategorizeTransactionResult } from './types';
import {
  loadBankAccounts,
  loadBankTransactions,
  saveBankAccounts,
  saveBankTransactions,
} from './bankingStore';
import { getIntegrationValues } from '../integrations/integrationsStore';

export interface BankingConnectResult {
  success: boolean;
  authUrl?: string;
  message: string;
  provider: string;
}

export async function fetchBankAccounts(): Promise<BankAccount[]> {
  try {
    const provider = getIntegrationValues('open_banking').provider || 'mock';
    const res = await fetch(`/api/banking/accounts?provider=${encodeURIComponent(provider)}`);
    if (res.ok) {
      const data = (await res.json()) as { accounts: BankAccount[] };
      if (Array.isArray(data.accounts) && data.accounts.length > 0) {
        saveBankAccounts(data.accounts);
        return data.accounts;
      }
    }
  } catch {
    // offline — use local store
  }
  return loadBankAccounts();
}

export async function fetchBankTransactions(accountId?: string): Promise<BankTransaction[]> {
  try {
    const provider = getIntegrationValues('open_banking').provider || 'mock';
    const qs = accountId ? `?accountId=${encodeURIComponent(accountId)}&provider=${provider}` : `?provider=${provider}`;
    const res = await fetch(`/api/banking/transactions${qs}`);
    if (res.ok) {
      const data = (await res.json()) as { transactions: BankTransaction[] };
      if (Array.isArray(data.transactions)) {
        const existing = loadBankTransactions();
        const merged = mergeTransactions(existing, data.transactions);
        saveBankTransactions(merged);
        return merged;
      }
    }
  } catch {
    // offline
  }
  const local = loadBankTransactions();
  return accountId ? local.filter((t) => t.accountId === accountId) : local;
}

function mergeTransactions(local: BankTransaction[], remote: BankTransaction[]): BankTransaction[] {
  const byId = new Map(local.map((t) => [t.id, t]));
  for (const t of remote) {
    const prev = byId.get(t.id);
    byId.set(t.id, prev ? { ...t, ...prev, category: prev.category !== 'uncategorised' ? prev.category : t.category } : t);
  }
  return Array.from(byId.values()).sort((a, b) => b.date.localeCompare(a.date));
}

export async function initiateBankConnect(): Promise<BankingConnectResult> {
  const config = getIntegrationValues('open_banking');
  const provider = config.provider || 'mock';
  try {
    const res = await fetch('/api/banking/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, ...config }),
    });
    if (res.ok) return (await res.json()) as BankingConnectResult;
  } catch {
    // fall through
  }
  return {
    success: true,
    message: 'Mock bank connected — configure Open Banking in Integrations for live feed.',
    provider: 'mock',
  };
}

export async function aiCategorizeTransaction(
  transaction: BankTransaction,
  context: {
    projects?: Array<{ id: string; projectName: string; customerName: string; customerId: string }>;
    customers?: Array<{ id: string; name: string }>;
  }
): Promise<CategorizeTransactionResult> {
  try {
    const openai = getIntegrationValues('openai');
    const res = await fetch('/api/ai/categorize-transaction', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        transaction,
        context,
        apiKey: openai.apiKey,
      }),
    });
    if (res.ok) return (await res.json()) as CategorizeTransactionResult;
  } catch {
    // fall through
  }
  return mockCategorize(transaction, context);
}

function mockCategorize(
  transaction: BankTransaction,
  context: { projects?: Array<{ id: string; projectName: string; customerName: string; customerId: string }> }
): CategorizeTransactionResult {
  const desc = transaction.description.toUpperCase();
  const matchProject = context.projects?.find(
    (p) => desc.includes(p.customerName.toUpperCase()) || desc.includes(p.projectName.toUpperCase())
  );
  if (transaction.direction === 'in') {
    return {
      category: matchProject ? 'stage-payment' : 'other-income',
      reason: matchProject
        ? `Incoming payment likely from ${matchProject.customerName} for ${matchProject.projectName}.`
        : 'Incoming payment — review and match to a project.',
      suggestedMatch: matchProject
        ? { projectId: matchProject.id, customerId: matchProject.customerId }
        : undefined,
    };
  }
  if (desc.includes('TILE') || desc.includes('SCREWFIX') || desc.includes('TRAVIS')) {
    return { category: 'materials', reason: 'Supplier name suggests materials purchase.' };
  }
  if (desc.includes('BUILDER') || desc.includes('SUB')) {
    return { category: 'subcontractor', reason: 'Payment to subcontractor or builder.' };
  }
  if (desc.includes('FUEL') || desc.includes('SHELL') || desc.includes('BP ')) {
    return { category: 'fuel', reason: 'Fuel or travel expense.' };
  }
  return { category: 'other', reason: 'Could not auto-categorise — please assign manually.' };
}
