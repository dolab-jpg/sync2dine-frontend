import type { AgentRole } from './agentContext';

export const DATA_COLLECTIONS = [
  'customers',
  'quotes',
  'products',
  'pricingRules',
  'projects',
  'builders',
  'contracts',
  'contractTemplates',
  'recruitmentAccess',
  'accountsAccess',
  'bankAccounts',
  'bankTransactions',
  'clientReceipts',
] as const;

export type DataCollection = (typeof DATA_COLLECTIONS)[number];

export type WriteOperation = 'create' | 'update' | 'delete';

export interface DataPolicyContext {
  role: AgentRole;
  userId?: string | null;
  customerId?: string | null;
  builderId?: string | null;
  projectId?: string | null;
}

export const SENSITIVE_FIELD_KEYS = new Set([
  'builderCost',
  'margin',
  'marginPercent',
  'internalNotes',
  'contractorComms',
  'costPrice',
  'supplierPrice',
  'staffNotes',
  'profit',
  'revenue',
  'earnings',
  'totalProfit',
  'companyTotals',
  'grossProfit',
  'materialCosts',
  'labourCosts',
  'otherCosts',
  'totalCosts',
  'marginPct',
  'categoryBreakdown',
  'costEntries',
  'timesheets',
  'builderPayments',
  'invoices',
  'bankAccounts',
  'bankTransactions',
  'clientReceipts',
  'accountsAccess',
]);

const STAFF_ROLES = new Set<AgentRole>(['platform_owner', 'super_admin', 'manager', 'staff']);

const READ_MATRIX: Record<AgentRole, Set<DataCollection> | '*'> = {
  platform_owner: '*',
  super_admin: '*',
  manager: '*',
  staff: '*',
  recruitment: new Set(['customers', 'quotes', 'projects', 'recruitmentAccess']),
  builder: new Set(['projects']),
  customer: new Set(['customers', 'quotes', 'projects', 'contracts']),
  agent: new Set(['customers', 'quotes', 'projects']),
  unknown: new Set(),
};

const ACCOUNTS_COLLECTIONS = new Set<DataCollection>([
  'bankAccounts',
  'bankTransactions',
  'clientReceipts',
  'accountsAccess',
]);

const WRITE_MATRIX: Record<AgentRole, Partial<Record<DataCollection, Set<WriteOperation>>>> = {
  platform_owner: {
    customers: new Set(['create', 'update', 'delete']),
    quotes: new Set(['create', 'update', 'delete']),
    products: new Set(['create', 'update', 'delete']),
    pricingRules: new Set(['create', 'update', 'delete']),
    projects: new Set(['create', 'update', 'delete']),
    builders: new Set(['create', 'update', 'delete']),
    contracts: new Set(['create', 'update', 'delete']),
    contractTemplates: new Set(['create', 'update', 'delete']),
    recruitmentAccess: new Set(['update']),
    accountsAccess: new Set(['update']),
  },
  super_admin: {
    customers: new Set(['create', 'update', 'delete']),
    quotes: new Set(['create', 'update', 'delete']),
    products: new Set(['create', 'update', 'delete']),
    pricingRules: new Set(['create', 'update', 'delete']),
    projects: new Set(['create', 'update', 'delete']),
    builders: new Set(['create', 'update', 'delete']),
    contracts: new Set(['create', 'update', 'delete']),
    contractTemplates: new Set(['create', 'update', 'delete']),
    recruitmentAccess: new Set(['update']),
    accountsAccess: new Set(['update']),
  },
  manager: {
    customers: new Set(['create', 'update', 'delete']),
    quotes: new Set(['create', 'update', 'delete']),
    products: new Set(['create', 'update']),
    pricingRules: new Set(['create', 'update']),
    projects: new Set(['create', 'update', 'delete']),
    builders: new Set(['create', 'update']),
    contracts: new Set(['create', 'update', 'delete']),
    contractTemplates: new Set(['create', 'update', 'delete']),
    recruitmentAccess: new Set(['update']),
    accountsAccess: new Set(['update']),
  },
  staff: {
    customers: new Set(['create', 'update']),
    quotes: new Set(['create', 'update']),
    products: new Set(['create', 'update']),
    projects: new Set(['create', 'update']),
    contracts: new Set(['create', 'update']),
    contractTemplates: new Set(['create', 'update']),
  },
  recruitment: {
    customers: new Set(['create', 'update']),
    quotes: new Set(['create', 'update']),
    projects: new Set(['update']),
  },
  builder: {
    projects: new Set(['update']),
  },
  customer: {
    projects: new Set(['update']),
  },
  agent: {
    customers: new Set(['create', 'update']),
  },
  unknown: {},
};

function canAccessCollection(
  matrix: Record<AgentRole, Set<DataCollection> | '*'>,
  role: AgentRole,
  collection: DataCollection
): boolean {
  const allowed = matrix[role];
  if (allowed === '*') return true;
  return allowed?.has(collection) ?? false;
}

export function canReadCollection(role: AgentRole, collection: DataCollection): boolean {
  if (ACCOUNTS_COLLECTIONS.has(collection)) {
    return role === 'platform_owner' || role === 'super_admin' || role === 'manager' || role === 'staff';
  }
  return canAccessCollection(READ_MATRIX, role, collection);
}

export function canWriteCollection(
  role: AgentRole,
  collection: DataCollection,
  operation: WriteOperation
): boolean {
  const ops = WRITE_MATRIX[role]?.[collection];
  return ops?.has(operation) ?? false;
}

function recordProjectId(record: Record<string, unknown>): string | undefined {
  const id = record.id ?? record.projectId;
  return typeof id === 'string' && id.trim() ? id.trim() : undefined;
}

function builderAssignedToProject(record: Record<string, unknown>, builderId: string): boolean {
  if (String(record.assignedBuilder ?? '') === builderId) return true;
  const contractors = record.assignedContractors;
  if (!Array.isArray(contractors)) return false;
  return contractors.some((c) => {
    if (!c || typeof c !== 'object') return false;
    const row = c as Record<string, unknown>;
    return String(row.contractorId ?? row.id ?? '') === builderId;
  });
}

export function isRecordInScope(
  collection: DataCollection,
  record: Record<string, unknown>,
  ctx: DataPolicyContext
): boolean {
  const { role, customerId, builderId, projectId } = ctx;

  if (STAFF_ROLES.has(role) || role === 'recruitment') {
    return true;
  }

  if (role === 'customer' && customerId) {
    if (collection === 'customers') {
      return String(record.id ?? '') === customerId;
    }
    if (collection === 'quotes' || collection === 'projects' || collection === 'contracts') {
      return String(record.customerId ?? '') === customerId;
    }
    return false;
  }

  if (role === 'builder' && builderId) {
    if (collection === 'projects') {
      if (projectId && recordProjectId(record) === projectId) return true;
      return builderAssignedToProject(record, builderId);
    }
    return false;
  }

  return false;
}

export function filterRecordsForRole<T extends Record<string, unknown>>(
  collection: DataCollection,
  records: T[],
  ctx: DataPolicyContext
): T[] {
  if (STAFF_ROLES.has(ctx.role)) return records;
  return records.filter((r) => isRecordInScope(collection, r, ctx));
}

function scrubValue(obj: unknown, role: AgentRole): unknown {
  if (STAFF_ROLES.has(role)) return obj;
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => scrubValue(item, role));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    if (SENSITIVE_FIELD_KEYS.has(k)) continue;
    out[k] = scrubValue(v, role);
  }
  return out;
}

export function redactRecord<T extends Record<string, unknown>>(role: AgentRole, record: T): T {
  return scrubValue(record, role) as T;
}

export function redactRecords<T extends Record<string, unknown>>(
  role: AgentRole,
  records: T[]
): T[] {
  return records.map((r) => redactRecord(role, r));
}

/** Build a role-scoped snapshot for the orchestrator from raw app data. */
export function buildScopedDataContext(
  raw: Record<string, unknown[] | Record<string, unknown>>,
  ctx: DataPolicyContext
): Record<string, unknown[] | Record<string, unknown>> {
  const out: Record<string, unknown[] | Record<string, unknown>> = {};
  for (const name of DATA_COLLECTIONS) {
    const data = raw[name];
    if (data === undefined) continue;
    if (!canReadCollection(ctx.role, name)) continue;
    if (Array.isArray(data)) {
      const scoped = filterRecordsForRole(
        name,
        data as Record<string, unknown>[],
        ctx
      );
      out[name] = redactRecords(ctx.role, scoped);
    } else if (data && typeof data === 'object') {
      out[name] = redactRecord(ctx.role, data as Record<string, unknown>);
    }
  }
  return out;
}
