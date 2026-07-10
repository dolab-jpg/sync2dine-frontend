import type { AppContextType } from '../../App';
import type { Customer, Product, PricingRule, Quote, RecruitmentAccess, AccountsAccess } from '../../App';
import {
  loadProjects,
  saveProjects,
  updateProject,
  getProject,
} from '../project/projectStore';
import { loadBuilders, saveBuilders, upsertBuilder, removeBuilder } from '../builder/builderStore';
import type { BuilderRecord } from '../builder/builderStore';
import type { UnifiedProject } from '../project/types';
import {
  loadBankAccounts,
  loadBankTransactions,
  loadClientReceipts,
} from '../banking/bankingStore';
import {
  loadContracts,
  saveContract as saveContractRecord,
  updateContract as updateContractRecord,
  deleteContract as deleteContractRecord,
} from '../contracts/contractStore';
import {
  loadContractTemplates,
  saveContractTemplate,
  deleteContractTemplate,
} from '../contracts/contractTemplateStore';
import type { Contract, ContractTemplate } from '../contracts/types';
import {
  canWriteCollection,
  isRecordInScope,
  type DataCollection,
  type DataPolicyContext,
  type WriteOperation,
} from './dataPolicy';

export interface WriteDataInput {
  collection: DataCollection;
  operation: WriteOperation;
  id?: string;
  data?: Record<string, unknown>;
}

export interface WriteDataResult {
  success: boolean;
  message: string;
  id?: string;
  collection: DataCollection;
  operation: WriteOperation;
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Read raw (unscoped) collection data from app stores. */
export function readRawCollection(
  collection: DataCollection,
  app: AppContextType | null
): unknown[] | Record<string, unknown> | null {
  if (!app) return null;
  switch (collection) {
    case 'customers':
      return app.customers as unknown as Record<string, unknown>[];
    case 'quotes':
      return app.quotes as unknown as Record<string, unknown>[];
    case 'products':
      return app.products as unknown as Record<string, unknown>[];
    case 'pricingRules':
      return app.pricingRules as unknown as Record<string, unknown>[];
    case 'projects':
      return loadProjects() as unknown as Record<string, unknown>[];
    case 'builders':
      return loadBuilders() as unknown as Record<string, unknown>[];
    case 'contracts':
      return loadContracts() as unknown as Record<string, unknown>[];
    case 'contractTemplates':
      return loadContractTemplates() as unknown as Record<string, unknown>[];
    case 'recruitmentAccess':
      return app.recruitmentAccess as unknown as Record<string, unknown>;
    case 'accountsAccess':
      return app.accountsAccess as unknown as Record<string, unknown>;
    case 'bankAccounts':
      return loadBankAccounts() as unknown as Record<string, unknown>[];
    case 'bankTransactions':
      return loadBankTransactions() as unknown as Record<string, unknown>[];
    case 'clientReceipts':
      return loadClientReceipts() as unknown as Record<string, unknown>[];
    default:
      return null;
  }
}

/** Build full raw snapshot for orchestrator (before server-side policy). */
export function buildRawDataSnapshot(app: AppContextType | null): Record<string, unknown[] | Record<string, unknown>> {
  const snapshot: Record<string, unknown[] | Record<string, unknown>> = {};
  if (!app) return snapshot;
  snapshot.customers = app.customers as unknown as Record<string, unknown>[];
  snapshot.quotes = app.quotes as unknown as Record<string, unknown>[];
  snapshot.products = app.products as unknown as Record<string, unknown>[];
  snapshot.pricingRules = app.pricingRules as unknown as Record<string, unknown>[];
  snapshot.projects = loadProjects() as unknown as Record<string, unknown>[];
  snapshot.builders = loadBuilders() as unknown as Record<string, unknown>[];
  snapshot.contracts = loadContracts() as unknown as Record<string, unknown>[];
  snapshot.contractTemplates = loadContractTemplates() as unknown as Record<string, unknown>[];
  snapshot.recruitmentAccess = app.recruitmentAccess as unknown as Record<string, unknown>;
  snapshot.accountsAccess = app.accountsAccess as unknown as Record<string, unknown>;
  snapshot.bankAccounts = loadBankAccounts() as unknown as Record<string, unknown>[];
  snapshot.bankTransactions = loadBankTransactions() as unknown as Record<string, unknown>[];
  snapshot.clientReceipts = loadClientReceipts() as unknown as Record<string, unknown>[];
  return snapshot;
}

export function executeWriteData(
  input: WriteDataInput,
  app: AppContextType | null,
  ctx: DataPolicyContext
): WriteDataResult {
  const { collection, operation, id, data = {} } = input;

  if (!app) {
    return { success: false, message: 'App not ready.', collection, operation };
  }

  if (!canWriteCollection(ctx.role, collection, operation)) {
    return {
      success: false,
      message: `Your role cannot ${operation} ${collection}.`,
      collection,
      operation,
    };
  }

  if (operation !== 'create' && id) {
    const existing = findRecordById(collection, id, app);
    if (existing && !isRecordInScope(collection, existing, ctx)) {
      return {
        success: false,
        message: 'You do not have access to that record.',
        collection,
        operation,
      };
    }
  }

  try {
    switch (collection) {
      case 'customers':
        return writeCustomer(operation, id, data, app);
      case 'quotes':
        return writeQuote(operation, id, data, app);
      case 'products':
        return writeProduct(operation, id, data, app);
      case 'pricingRules':
        return writePricingRule(operation, id, data, app);
      case 'projects':
        return writeProject(operation, id, data, ctx);
      case 'builders':
        return writeBuilder(operation, id, data);
      case 'contracts':
        return writeContract(operation, id, data);
      case 'contractTemplates':
        return writeContractTemplate(operation, id, data);
      case 'recruitmentAccess':
        return writeRecruitmentAccess(operation, data, app);
      case 'accountsAccess':
        return writeAccountsAccess(operation, data, app);
      default:
        return { success: false, message: `Unknown collection: ${collection}`, collection, operation };
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Write failed.',
      collection,
      operation,
    };
  }
}

function findRecordById(
  collection: DataCollection,
  id: string,
  app: AppContextType
): Record<string, unknown> | null {
  const raw = readRawCollection(collection, app);
  if (!raw) return null;
  if (Array.isArray(raw)) {
    return (raw.find((r) => String(r.id ?? '') === id) as Record<string, unknown>) ?? null;
  }
  return raw as Record<string, unknown>;
}

function writeCustomer(
  operation: WriteOperation,
  id: string | undefined,
  data: Record<string, unknown>,
  app: AppContextType
): WriteDataResult {
  if (operation === 'delete') {
    if (!id) return { success: false, message: 'id required for delete', collection: 'customers', operation };
    app.deleteCustomer(id);
    return { success: true, message: `Deleted customer ${id}.`, id, collection: 'customers', operation };
  }
  if (operation === 'update') {
    if (!id) return { success: false, message: 'id required for update', collection: 'customers', operation };
    app.updateCustomer(id, data as Partial<Customer>);
    return { success: true, message: `Updated customer ${id}.`, id, collection: 'customers', operation };
  }
  const created = app.addCustomer({
    name: String(data.name ?? 'New customer'),
    email: String(data.email ?? ''),
    phone: String(data.phone ?? ''),
    address: String(data.address ?? ''),
    status: (data.status as Customer['status']) ?? 'lead',
    notes: String(data.notes ?? 'Created via TradePro AI'),
    photos: [],
    interestedTrades: (data.interestedTrades as Customer['interestedTrades']) ?? [],
    whatsappOptIn: Boolean(data.whatsappOptIn ?? false),
    preferredChannel: (data.preferredChannel as Customer['preferredChannel']) ?? 'email',
  });
  return {
    success: true,
    message: `Created customer ${created.name}.`,
    id: created.id,
    collection: 'customers',
    operation,
  };
}

function writeQuote(
  operation: WriteOperation,
  id: string | undefined,
  data: Record<string, unknown>,
  app: AppContextType
): WriteDataResult {
  if (operation === 'delete') {
    if (!id) return { success: false, message: 'id required for delete', collection: 'quotes', operation };
    app.deleteQuote(id);
    return { success: true, message: `Deleted quote ${id}.`, id, collection: 'quotes', operation };
  }
  if (operation === 'update') {
    if (!id) return { success: false, message: 'id required for update', collection: 'quotes', operation };
    app.updateQuote(id, data as Partial<Quote>);
    return { success: true, message: `Updated quote ${id}.`, id, collection: 'quotes', operation };
  }
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 14);
  const before = app.quotes.length;
  app.addQuote({
    customerId: String(data.customerId ?? ''),
    customerName: String(data.customerName ?? 'Customer'),
    tradeId: data.tradeId as Quote['tradeId'],
    tradeName: readOptionalString(data.tradeName),
    expiresAt: expiresAt.toISOString(),
    items: (data.items as Quote['items']) ?? [],
    labour: (data.labour as Quote['labour']) ?? [],
    extras: (data.extras as Quote['extras']) ?? [],
    discount: Number(data.discount ?? 0),
    total: Number(data.total ?? 0),
    status: (data.status as Quote['status']) ?? 'draft',
  });
  const quoteId = app.quotes[before]?.id ?? String(before + 1);
  return {
    success: true,
    message: `Created quote ${quoteId}.`,
    id: quoteId,
    collection: 'quotes',
    operation,
  };
}

function writeProduct(
  operation: WriteOperation,
  id: string | undefined,
  data: Record<string, unknown>,
  app: AppContextType
): WriteDataResult {
  if (operation === 'delete') {
    if (!id) return { success: false, message: 'id required for delete', collection: 'products', operation };
    app.deleteProduct(id);
    return { success: true, message: `Deleted product ${id}.`, id, collection: 'products', operation };
  }
  if (operation === 'update') {
    if (!id) return { success: false, message: 'id required for update', collection: 'products', operation };
    app.updateProduct(id, data as Partial<Product>);
    return { success: true, message: `Updated product ${id}.`, id, collection: 'products', operation };
  }
  app.addProduct({
    name: String(data.name ?? 'New product'),
    image: String(data.image ?? ''),
    basePrice: Number(data.basePrice ?? 0),
    margin: Number(data.margin ?? 0),
    source: String(data.source ?? 'AI'),
    category: String(data.category ?? 'general'),
    tradeId: data.tradeId as Product['tradeId'],
  });
  const newId = app.products[app.products.length - 1]?.id;
  return {
    success: true,
    message: 'Created product.',
    id: newId,
    collection: 'products',
    operation,
  };
}

function writePricingRule(
  operation: WriteOperation,
  id: string | undefined,
  data: Record<string, unknown>,
  app: AppContextType
): WriteDataResult {
  if (operation === 'delete') {
    if (!id) return { success: false, message: 'id required for delete', collection: 'pricingRules', operation };
    app.deletePricingRule(id);
    return { success: true, message: `Deleted pricing rule ${id}.`, id, collection: 'pricingRules', operation };
  }
  if (operation === 'update') {
    if (!id) return { success: false, message: 'id required for update', collection: 'pricingRules', operation };
    app.updatePricingRule(id, data as Partial<PricingRule>);
    return { success: true, message: `Updated pricing rule ${id}.`, id, collection: 'pricingRules', operation };
  }
  app.addPricingRule({
    name: String(data.name ?? 'New rule'),
    type: (data.type as PricingRule['type']) ?? 'fixed',
    basePrice: Number(data.basePrice ?? 0),
    category: String(data.category ?? 'general'),
    tradeId: data.tradeId as PricingRule['tradeId'],
  });
  const newId = app.pricingRules[app.pricingRules.length - 1]?.id;
  return {
    success: true,
    message: 'Created pricing rule.',
    id: newId,
    collection: 'pricingRules',
    operation,
  };
}

function writeProject(
  operation: WriteOperation,
  id: string | undefined,
  data: Record<string, unknown>,
  ctx: DataPolicyContext
): WriteDataResult {
  if (operation === 'delete') {
    if (!id) return { success: false, message: 'id required for delete', collection: 'projects', operation };
    const projects = loadProjects().filter((p) => p.id !== id);
    saveProjects(projects);
    return { success: true, message: `Deleted project ${id}.`, id, collection: 'projects', operation };
  }
  if (operation === 'update') {
    if (!id) return { success: false, message: 'id required for update', collection: 'projects', operation };
    const existing = getProject(id);
    if (!existing) {
      return { success: false, message: 'Project not found.', collection: 'projects', operation };
    }
    if (!isRecordInScope('projects', existing as unknown as Record<string, unknown>, ctx)) {
      return { success: false, message: 'You do not have access to that project.', collection: 'projects', operation };
    }
    const patch: Partial<UnifiedProject> = {};
    if (data.status) patch.status = data.status as UnifiedProject['status'];
    if (data.tasks) patch.tasks = data.tasks as UnifiedProject['tasks'];
    if (data.messages) patch.messages = data.messages as UnifiedProject['messages'];
    if (data.notes) patch.notes = String(data.notes);
    updateProject(id, { ...patch, ...data } as Partial<UnifiedProject>);
    return { success: true, message: `Updated project ${id}.`, id, collection: 'projects', operation };
  }
  return { success: false, message: 'Project create via generic write not supported — use convertQuoteToProject.', collection: 'projects', operation };
}

function writeBuilder(
  operation: WriteOperation,
  id: string | undefined,
  data: Record<string, unknown>
): WriteDataResult {
  if (operation === 'delete') {
    if (!id) return { success: false, message: 'id required for delete', collection: 'builders', operation };
    removeBuilder(id);
    return { success: true, message: `Removed builder ${id}.`, id, collection: 'builders', operation };
  }
  if (operation === 'update' || operation === 'create') {
    const builderId = id ?? readOptionalString(data.id) ?? `B${Date.now()}`;
    const record: BuilderRecord = {
      id: builderId,
      name: String(data.name ?? 'Builder'),
      email: String(data.email ?? ''),
      phone: String(data.phone ?? ''),
      whatsappOptIn: Boolean(data.whatsappOptIn ?? true),
      specialties: Array.isArray(data.specialties)
        ? (data.specialties as string[])
        : Array.isArray(data.trades)
          ? (data.trades as string[])
          : [],
      status: (data.status as BuilderRecord['status']) ?? 'active',
      joinedDate: readOptionalString(data.joinedDate) ?? new Date().toISOString().split('T')[0],
      defaultPaymentType: (data.defaultPaymentType as BuilderRecord['defaultPaymentType']) ?? 'price_work',
      dayRate: typeof data.dayRate === 'number' ? data.dayRate : undefined,
      hourlyRate: typeof data.hourlyRate === 'number' ? data.hourlyRate : undefined,
      color: readOptionalString(data.color),
    };
    upsertBuilder(record);
    return {
      success: true,
      message: `${operation === 'create' ? 'Created' : 'Updated'} builder ${record.name}.`,
      id: builderId,
      collection: 'builders',
      operation,
    };
  }
  return { success: false, message: 'Unsupported builder operation.', collection: 'builders', operation };
}

function writeContract(
  operation: WriteOperation,
  id: string | undefined,
  data: Record<string, unknown>
): WriteDataResult {
  if (operation === 'delete') {
    if (!id) return { success: false, message: 'id required for delete', collection: 'contracts', operation };
    deleteContractRecord(id);
    return { success: true, message: `Deleted contract ${id}.`, id, collection: 'contracts', operation };
  }
  if (operation === 'update') {
    if (!id) return { success: false, message: 'id required for update', collection: 'contracts', operation };
    const updated = updateContractRecord(id, data as Partial<Contract>);
    if (!updated) return { success: false, message: 'Contract not found.', collection: 'contracts', operation };
    return { success: true, message: `Updated contract ${id}.`, id, collection: 'contracts', operation };
  }
  const created = saveContractRecord({
    customerId: String(data.customerId ?? ''),
    customerName: String(data.customerName ?? 'Customer'),
    quoteId: readOptionalString(data.quoteId),
    templateId: readOptionalString(data.templateId),
    tradeName: readOptionalString(data.tradeName),
    total: Number(data.total ?? 0),
    depositAmount: Number(data.depositAmount ?? 0),
    stages: (data.stages as Contract['stages']) ?? [],
    bodyRendered: String(data.bodyRendered ?? ''),
    status: (data.status as Contract['status']) ?? 'draft',
  });
  return { success: true, message: `Created contract ${created.id}.`, id: created.id, collection: 'contracts', operation };
}

function writeContractTemplate(
  operation: WriteOperation,
  id: string | undefined,
  data: Record<string, unknown>
): WriteDataResult {
  if (operation === 'delete') {
    if (!id) return { success: false, message: 'id required for delete', collection: 'contractTemplates', operation };
    deleteContractTemplate(id);
    return { success: true, message: `Deleted template ${id}.`, id, collection: 'contractTemplates', operation };
  }
  const saved = saveContractTemplate({
    id: operation === 'update' ? id : undefined,
    name: String(data.name ?? 'Template'),
    bodyMarkdown: String(data.bodyMarkdown ?? ''),
    defaultDepositPct: Number(data.defaultDepositPct ?? 25),
    defaultStages: (data.defaultStages as ContractTemplate['defaultStages']) ?? [],
  });
  return {
    success: true,
    message: `${operation === 'update' ? 'Updated' : 'Created'} template ${saved.name}.`,
    id: saved.id,
    collection: 'contractTemplates',
    operation,
  };
}

function writeRecruitmentAccess(
  operation: WriteOperation,
  data: Record<string, unknown>,
  app: AppContextType
): WriteDataResult {
  if (operation !== 'update') {
    return { success: false, message: 'recruitmentAccess only supports update.', collection: 'recruitmentAccess', operation };
  }
  const next: RecruitmentAccess = {
    staff: data.staff !== undefined ? Boolean(data.staff) : app.recruitmentAccess.staff,
    manager: data.manager !== undefined ? Boolean(data.manager) : app.recruitmentAccess.manager,
  };
  app.setRecruitmentAccess(next);
  return {
    success: true,
    message: 'Updated recruitment access settings.',
    collection: 'recruitmentAccess',
    operation,
  };
}

function writeAccountsAccess(
  operation: WriteOperation,
  data: Record<string, unknown>,
  app: AppContextType
): WriteDataResult {
  if (operation !== 'update') {
    return { success: false, message: 'accountsAccess only supports update.', collection: 'accountsAccess', operation };
  }
  const next: AccountsAccess = {
    staff: data.staff !== undefined ? Boolean(data.staff) : app.accountsAccess.staff,
    manager: data.manager !== undefined ? Boolean(data.manager) : app.accountsAccess.manager,
  };
  app.setAccountsAccess(next);
  return {
    success: true,
    message: 'Updated accounts access settings.',
    collection: 'accountsAccess',
    operation,
  };
}
