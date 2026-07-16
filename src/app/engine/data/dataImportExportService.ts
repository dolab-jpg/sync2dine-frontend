import type { Customer, Product, PricingRule, Quote } from '../../App';
import type { TradeId } from '../../config/types';
import type { SurveyRecord } from '../surveyScorer';
import type { UnifiedProject } from '../project/types';
import type { CustomerContact } from '../project/types';
import type { BuilderRecord } from '../builder/builderStore';
import type { PlanningApplication } from '../planning/types';
import type { BankAccount, BankTransaction, ClientReceipt } from '../banking/types';
import { loadProjects } from '../project/projectStore';
import { loadContacts } from '../contacts/contactStore';
import { loadBuilders } from '../builder/builderStore';
import { loadSurveys } from '../surveyScorer';
import { loadPlanningApplications } from '../planning/planningStore';
import {
  loadBankAccounts,
  loadBankTransactions,
  loadClientReceipts,
} from '../banking/bankingStore';
import { migrateQuoteToLines } from '../quotes/quoteLineUtils';

export type ExportScope = 'full' | 'estimation' | 'customers';
export type MergeStrategy = 'skip' | 'replace' | 'upsert';

export interface TradeProExportBundle {
  version: 1;
  exportedAt: string;
  scope: ExportScope;
  data: Partial<{
    customers: Customer[];
    quotes: Quote[];
    products: Product[];
    pricingRules: PricingRule[];
    surveys: SurveyRecord[];
    projects: UnifiedProject[];
    contacts: CustomerContact[];
    builders: BuilderRecord[];
    planningApplications: PlanningApplication[];
    bankAccounts: BankAccount[];
    bankTransactions: BankTransaction[];
    clientReceipts: ClientReceipt[];
  }>;
}

export interface ImportSummary {
  customers?: number;
  quotes?: number;
  products?: number;
  pricingRules?: number;
  surveys?: number;
  projects?: number;
  contacts?: number;
  builders?: number;
  planningApplications?: number;
  bankAccounts?: number;
  bankTransactions?: number;
  clientReceipts?: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  summary: ImportSummary;
  scope: ExportScope;
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface ParsedImport {
  kind: 'json' | 'csv';
  bundle: TradeProExportBundle;
  csvErrors?: string[];
}

const CUSTOMER_CSV_HEADERS = [
  'id',
  'name',
  'email',
  'phone',
  'address',
  'status',
  'notes',
  'interestedTrades',
  'whatsappOptIn',
  'preferredChannel',
  'preferredLanguage',
  'createdAt',
] as const;

export function migrateCustomers(items: Customer[]): Customer[] {
  return items.map((c) => ({
    ...c,
    whatsappOptIn: c.whatsappOptIn ?? true,
    preferredChannel: c.preferredChannel ?? 'both',
    preferredLanguage: c.preferredLanguage ?? 'en',
    tags: c.tags ?? [],
    photos: c.photos ?? [],
    notes: c.notes ?? '',
    phone: c.phone ?? '',
    address: c.address ?? '',
  }));
}

export function migrateProducts(items: Product[]): Product[] {
  return items.map((p) => ({ ...p, tradeId: p.tradeId ?? 'bathroom' }));
}

export function migrateQuotes(items: Quote[]): Quote[] {
  return items.map((q) => {
    const base = {
      ...q,
      tradeId: q.tradeName === 'Small Jobs' ? q.tradeId : (q.tradeId ?? 'bathroom'),
      tradeName: q.tradeName ?? 'Bathroom',
      items: q.items ?? [],
      labour: q.labour ?? [],
      extras: q.extras ?? [],
    };
    const lines = migrateQuoteToLines(base);
    return { ...base, lines };
  });
}

export function migratePricingRules(items: PricingRule[]): PricingRule[] {
  return items.map((r) => ({
    ...r,
    tradeId: r.tradeId === undefined ? null : r.tradeId,
  }));
}

function dateStamp(): string {
  return new Date().toISOString().slice(0, 10);
}

export function downloadBlob(filename: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function loadContextData(context: {
  customers: Customer[];
  quotes: Quote[];
  products: Product[];
  pricingRules: PricingRule[];
}) {
  return {
    customers: context.customers,
    quotes: context.quotes,
    products: context.products,
    pricingRules: context.pricingRules,
    surveys: loadSurveys(),
  };
}

export function buildFullBackup(context: {
  customers: Customer[];
  quotes: Quote[];
  products: Product[];
  pricingRules: PricingRule[];
}): TradeProExportBundle {
  const base = loadContextData(context);
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    scope: 'full',
    data: {
      ...base,
      projects: loadProjects(),
      contacts: loadContacts(),
      builders: loadBuilders(),
      planningApplications: loadPlanningApplications(),
      bankAccounts: loadBankAccounts(),
      bankTransactions: loadBankTransactions(),
      clientReceipts: loadClientReceipts(),
    },
  };
}

export function buildEstimationPack(context: {
  customers: Customer[];
  quotes: Quote[];
  products: Product[];
  pricingRules: PricingRule[];
}): TradeProExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    scope: 'estimation',
    data: loadContextData(context),
  };
}

export function buildCustomersBundle(customers: Customer[]): TradeProExportBundle {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    scope: 'customers',
    data: { customers },
  };
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function buildCustomersCsv(customers: Customer[]): string {
  const rows = [CUSTOMER_CSV_HEADERS.join(',')];
  for (const c of customers) {
    rows.push(
      [
        c.id,
        c.name,
        c.email,
        c.phone,
        c.address,
        c.status,
        c.notes ?? '',
        (c.interestedTrades ?? []).join(';'),
        String(c.whatsappOptIn ?? false),
        c.preferredChannel ?? 'both',
        c.preferredLanguage ?? 'en',
        c.createdAt,
      ]
        .map((v) => escapeCsv(String(v ?? '')))
        .join(',')
    );
  }
  return rows.join('\n');
}

export function exportFullBackupJson(context: {
  customers: Customer[];
  quotes: Quote[];
  products: Product[];
  pricingRules: PricingRule[];
}): void {
  const bundle = buildFullBackup(context);
  downloadBlob(
    `builder-diddies-backup-${dateStamp()}.json`,
    JSON.stringify(bundle, null, 2),
    'application/json'
  );
}

export function exportEstimationPackJson(context: {
  customers: Customer[];
  quotes: Quote[];
  products: Product[];
  pricingRules: PricingRule[];
}): void {
  const bundle = buildEstimationPack(context);
  downloadBlob(
    `builder-diddies-estimation-${dateStamp()}.json`,
    JSON.stringify(bundle, null, 2),
    'application/json'
  );
}

export function exportCustomersCsv(customers: Customer[]): void {
  downloadBlob(
    `builder-diddies-customers-${dateStamp()}.csv`,
    buildCustomersCsv(customers),
    'text/csv'
  );
}

export function summarizeBundle(bundle: TradeProExportBundle): ImportSummary {
  const summary: ImportSummary = {};
  for (const [key, value] of Object.entries(bundle.data)) {
    if (Array.isArray(value)) {
      (summary as Record<string, number>)[key] = value.length;
    }
  }
  return summary;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isArrayOfRecords(value: unknown): value is Record<string, unknown>[] {
  return Array.isArray(value) && value.every(isRecord);
}

export function validateBundle(bundle: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(bundle)) {
    return { valid: false, errors: ['File is not a valid JSON object.'], summary: {}, scope: 'customers' };
  }

  if (bundle.version !== 1) {
    errors.push('Unsupported export version. Expected version 1.');
  }

  const scope = bundle.scope as ExportScope;
  if (!['full', 'estimation', 'customers'].includes(scope)) {
    errors.push('Missing or invalid scope.');
  }

  if (!isRecord(bundle.data)) {
    errors.push('Missing data object.');
    return { valid: false, errors, summary: {}, scope: scope ?? 'customers' };
  }

  const data = bundle.data;
  const entityKeys = [
    'customers',
    'quotes',
    'products',
    'pricingRules',
    'surveys',
    'projects',
    'contacts',
    'builders',
    'planningApplications',
    'bankAccounts',
    'bankTransactions',
    'clientReceipts',
  ] as const;

  for (const key of entityKeys) {
    const value = data[key];
    if (value === undefined) continue;
    if (!isArrayOfRecords(value)) {
      errors.push(`${key} must be an array.`);
    }
  }

  if (scope === 'customers' && !Array.isArray(data.customers)) {
    errors.push('Customer import requires a customers array.');
  }

  if (scope === 'estimation') {
    const hasEstimationData = ['customers', 'quotes', 'products', 'pricingRules', 'surveys'].some(
      (k) => Array.isArray(data[k as keyof typeof data])
    );
    if (!hasEstimationData) {
      errors.push('Estimation pack must include at least one estimation entity.');
    }
  }

  const typedBundle = bundle as TradeProExportBundle;
  return {
    valid: errors.length === 0,
    errors,
    summary: summarizeBundle(typedBundle),
    scope: scope ?? 'customers',
  };
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line.charAt(i);
    if (inQuotes) {
      if (ch === '"') {
        if (line.charAt(i + 1) === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase().replace(/\s+/g, '');
}

export function parseCustomersCsv(text: string): { customers: Customer[]; errors: string[] } {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) {
    return { customers: [], errors: ['CSV file is empty.'] };
  }

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const customers: Customer[] = [];
  const errors: string[] = [];

  const idx = (name: string) => headers.indexOf(normalizeHeader(name));

  for (let row = 1; row < lines.length; row++) {
    const values = parseCsvLine(lines[row]);
    if (values.every((v) => !v.trim())) continue;

    const get = (name: string) => {
      const i = idx(name);
      return i >= 0 ? values[i]?.trim() ?? '' : '';
    };

    const name = get('name');
    const email = get('email');
    if (!name || !email) {
      errors.push(`Row ${row + 1}: name and email are required.`);
      continue;
    }

    const statusRaw = get('status') as Customer['status'];
    const status: Customer['status'] =
      statusRaw === 'quoted' || statusRaw === 'won' || statusRaw === 'lost' ? statusRaw : 'lead';

    const channelRaw = get('preferredchannel') as Customer['preferredChannel'];
    const preferredChannel: Customer['preferredChannel'] =
      channelRaw === 'email' || channelRaw === 'whatsapp' || channelRaw === 'phone'
        ? channelRaw
        : channelRaw === 'both'
          ? 'both'
          : 'both';

    const tradesRaw = get('interestedtrades');
    const interestedTrades = tradesRaw
      ? (tradesRaw.split(';').map((t) => t.trim()).filter(Boolean) as TradeId[])
      : undefined;

    const langRaw = get('preferredlanguage');
    const preferredLanguage: Customer['preferredLanguage'] =
      langRaw === 'sq' || langRaw === 'uk' || langRaw === 'zh' || langRaw === 'es' || langRaw === 'pl' || langRaw === 'fa' || langRaw === 'en'
        ? langRaw
        : 'en';

    customers.push({
      id: get('id') || `${Date.now()}-${row}`,
      name,
      email,
      phone: get('phone'),
      address: get('address'),
      status,
      notes: get('notes'),
      interestedTrades,
      whatsappOptIn: get('whatsappoptin').toLowerCase() === 'true',
      preferredChannel,
      preferredLanguage,
      createdAt: get('createdat') || new Date().toISOString(),
      photos: [],
    });
  }

  return { customers, errors };
}

export async function parseImportFile(file: File): Promise<ParsedImport> {
  const text = await file.text();
  const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type.includes('csv');

  if (isCsv) {
    const { customers, errors } = parseCustomersCsv(text);
    return {
      kind: 'csv',
      csvErrors: errors,
      bundle: buildCustomersBundle(customers),
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Invalid JSON file.');
  }

  if (!isRecord(parsed)) {
    throw new Error('Import file must be a JSON object.');
  }

  return {
    kind: 'json',
    bundle: parsed as TradeProExportBundle,
  };
}

export function mergeById<T extends { id: string }>(
  existing: T[],
  incoming: T[],
  strategy: MergeStrategy
): { result: T[]; added: number; updated: number; skipped: number } {
  if (strategy === 'replace') {
    return { result: [...incoming], added: incoming.length, updated: 0, skipped: 0 };
  }

  const map = new Map(existing.map((item) => [item.id, item]));
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of incoming) {
    if (!map.has(item.id)) {
      map.set(item.id, item);
      added++;
    } else if (strategy === 'upsert') {
      map.set(item.id, item);
      updated++;
    } else {
      skipped++;
    }
  }

  return { result: Array.from(map.values()), added, updated, skipped };
}

export function getExportCounts(context: {
  customers: Customer[];
  quotes: Quote[];
  products: Product[];
  pricingRules: PricingRule[];
}) {
  const estimation = loadContextData(context);
  const full = buildFullBackup(context);
  return {
    full: summarizeBundle(full),
    estimation: summarizeBundle(buildEstimationPack(context)),
    customers: estimation.customers ?? 0,
  };
}
