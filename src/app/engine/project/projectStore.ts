import { testProjects } from '../../data/testData';
import { readLocalJson, writeLocalJson, useCloudPersistence } from '../data/cloudPersist';
import { loadContacts } from '../contacts/contactStore';
import { loadBuilders } from '../builder/builderStore';
import type { UnifiedProject, PortalToken, WhatsAppSession, PaymentStage, AssignedContractor } from './types';
import { getPlaybook } from '../../config/trades/playbooks';
import { seedSnagsFromChecklist } from './completionService';

const PROJECTS_KEY = 'unifiedProjects';
const PORTAL_TOKENS_KEY = 'portalTokens';
const WA_SESSIONS_KEY = 'whatsappSessions';

let supabaseProjectsCache: UnifiedProject[] | null = null;

type ProjectsListener = (projects: UnifiedProject[]) => void;
const projectsListeners = new Set<ProjectsListener>();

function notifyProjectsListeners(): void {
  const snapshot = loadProjects();
  projectsListeners.forEach((fn) => {
    try {
      fn(snapshot);
    } catch {
      // ignore listener errors
    }
  });
}

/** Subscribe to project list changes (async Supabase load, saves, realtime). */
export function subscribeProjectsCache(listener: ProjectsListener): () => void {
  projectsListeners.add(listener);
  return () => projectsListeners.delete(listener);
}

function normalizeAssignedContractors(value: unknown): AssignedContractor[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => {
      if (!entry || typeof entry !== 'object') return null;
      const item = entry as Record<string, unknown>;
      const name = typeof item.name === 'string' ? item.name.trim() : '';
      if (!name) return null;
      const fallbackId = `AC${String(index + 1).padStart(3, '0')}`;
      const role = item.role === 'lead' || item.role === 'sub' ? item.role : 'sub';
      return {
        id: typeof item.id === 'string' && item.id.trim() ? item.id : fallbackId,
        contractorId: typeof item.contractorId === 'string' && item.contractorId.trim()
          ? item.contractorId
          : undefined,
        name,
        tradeId: typeof item.tradeId === 'string' && item.tradeId.trim() ? item.tradeId : undefined,
        trade: typeof item.trade === 'string' && item.trade.trim() ? item.trade : undefined,
        role,
        phone: typeof item.phone === 'string' && item.phone.trim() ? item.phone : undefined,
        email: typeof item.email === 'string' && item.email.trim() ? item.email : undefined,
      } as AssignedContractor;
    })
    .filter((item): item is AssignedContractor => Boolean(item));
}

function seedDemoAssignedContractors(
  projectId: string,
  tradeId: string | undefined,
  existing: AssignedContractor[]
): AssignedContractor[] {
  if (existing.length > 0 || projectId !== 'P010') return existing;
  return [
    {
      id: 'AC-DEMO-PLUMB',
      contractorId: 'SC-PLUMB-01',
      name: 'Liam Patel',
      tradeId: 'plumbing',
      trade: 'Plumbing',
      role: 'sub',
      phone: '07700 910101',
      email: 'liam.patel@subtrade.co.uk',
    },
    {
      id: 'AC-DEMO-ELEC',
      contractorId: 'SC-ELEC-01',
      name: 'Noah Carter',
      tradeId: 'electrical',
      trade: 'Electrical',
      role: 'sub',
      phone: '07700 910202',
      email: 'noah.carter@subtrade.co.uk',
    },
    ...(tradeId && tradeId !== 'bathroom'
      ? [{
          id: `AC-DEMO-${tradeId.toUpperCase()}`,
          contractorId: `SC-${tradeId.toUpperCase()}-01`,
          name: `${tradeId[0].toUpperCase()}${tradeId.slice(1)} Specialist`,
          tradeId,
          trade: tradeId[0].toUpperCase() + tradeId.slice(1),
          role: 'sub' as const,
        }]
      : []),
  ];
}

function migrateProject(p: Record<string, unknown>): UnifiedProject {
  const base = p as unknown as UnifiedProject & {
    customerPaymentStages?: PaymentStage[];
    customerAutoUpdates?: boolean | Array<{ enabled?: boolean }>;
  };
  const paymentStages = base.paymentStages ?? base.customerPaymentStages ?? [];
  const normalizedContractors = seedDemoAssignedContractors(
    String(base.id ?? ''),
    typeof base.tradeId === 'string' ? base.tradeId : undefined,
    normalizeAssignedContractors(base.assignedContractors)
  );
  const customerAutoUpdates = Array.isArray(base.customerAutoUpdates)
    ? base.customerAutoUpdates.some((entry) => entry?.enabled !== false)
    : Boolean(base.customerAutoUpdates);
  return {
    ...base,
    projectName: base.projectName ?? `${base.customerName} - ${base.tradeName ?? 'Project'}`,
    quoteId: base.quoteId,
    workingDaysOff: base.workingDaysOff ?? [],
    milestones: base.milestones ?? [],
    tasks: base.tasks ?? [],
    files: base.files ?? [],
    contractorComms: base.contractorComms ?? [],
    aiActions: base.aiActions ?? [],
    contracts: base.contracts ?? [],
    whatsappMode: base.whatsappMode ?? 'individual',
    portalToken: base.portalToken ?? generateToken(),
    escalated: base.escalated ?? false,
    photos: base.photos ?? [],
    paymentStages,
    customerAutoUpdates,
    plans: (base.plans ?? []).map((plan) => ({
      ...plan,
      cadence: plan.cadence ?? 'ad_hoc',
    })),
    changeOrders: base.changeOrders ?? [],
    costEntries: base.costEntries ?? [],
    timesheets: base.timesheets ?? [],
    assignedContractors: normalizedContractors,
    messages: (base.messages ?? []).map(m => {
      const raw = m as { body?: string; message?: string; channel?: string };
      const text = raw.body ?? raw.message ?? '';
      return {
        ...m,
        body: text,
        message: raw.message ?? text,
        channel: (raw.channel ?? 'app') as UnifiedProject['messages'][0]['channel'],
      };
    }),
  };
}

function generateToken(): string {
  return `pt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function loadProjects(): UnifiedProject[] {
  if (supabaseProjectsCache) return supabaseProjectsCache;
  const fromLocal = readLocalJson<UnifiedProject[]>(PROJECTS_KEY, []);
  if (fromLocal.length) return fromLocal.map(migrateProject);
  if (useCloudPersistence()) return [];
  const seeded = (testProjects as unknown as UnifiedProject[]).map(migrateProject);
  saveProjects(seeded);
  return seeded;
}

/** Load projects from Supabase (call on app init when configured) */
export async function loadProjectsAsync(): Promise<UnifiedProject[]> {
  try {
    const { isSupabaseConfigured, loadProjectsFromSupabase } = await import('../data/supabaseStore');
    if (isSupabaseConfigured()) {
      const remote = await loadProjectsFromSupabase();
      if (remote.length > 0) {
        supabaseProjectsCache = remote.map(migrateProject);
        if (!useCloudPersistence()) {
          writeLocalJson(PROJECTS_KEY, supabaseProjectsCache);
        }
        notifyProjectsListeners();
        return supabaseProjectsCache;
      }
      if (useCloudPersistence()) {
        supabaseProjectsCache = [];
        notifyProjectsListeners();
        return [];
      }
    }
  } catch {
    // fall back to localStorage
  }
  const local = loadProjects();
  notifyProjectsListeners();
  return local;
}

export function initProjectsRealtime(): () => void {
  let unsubscribeRemote: (() => void) | undefined;
  void import('../data/supabaseStore').then(({ isSupabaseConfigured, subscribeProjects }) => {
    if (!isSupabaseConfigured()) return;
    unsubscribeRemote = subscribeProjects((projects) => {
      supabaseProjectsCache = projects.map(migrateProject);
      if (!useCloudPersistence()) {
        writeLocalJson(PROJECTS_KEY, supabaseProjectsCache);
      }
      notifyProjectsListeners();
    });
  }).catch(() => {});
  return () => {
    unsubscribeRemote?.();
    supabaseProjectsCache = null;
  };
}

export function saveProjects(projects: UnifiedProject[]): void {
  supabaseProjectsCache = projects;
  if (!useCloudPersistence()) {
    writeLocalJson(PROJECTS_KEY, projects);
  }
  notifyProjectsListeners();
  void import('../data/supabaseStore').then(({ isSupabaseConfigured, saveAllProjectsToSupabase }) => {
    if (isSupabaseConfigured()) return saveAllProjectsToSupabase(projects);
  }).catch(() => {});
}

export function getProject(id: string): UnifiedProject | undefined {
  return loadProjects().find(p => p.id === id);
}

export function updateProject(id: string, updates: Partial<UnifiedProject>): UnifiedProject | undefined {
  const projects = loadProjects();
  const idx = projects.findIndex(p => p.id === id);
  if (idx < 0) return undefined;
  projects[idx] = { ...projects[idx], ...updates };
  saveProjects(projects);
  return projects[idx];
}

export function createProjectFromQuote(
  quote: { id: string; customerId: string; customerName: string; total: number; tradeId?: string; tradeName?: string; lines?: Array<{ description: string; total: number }> },
  customer: { email: string; address: string; phone: string }
): UnifiedProject {
  const id = `P${Date.now()}`;
  const deposit = Math.round(quote.total * 0.25);
  const progress = Math.round(quote.total * 0.5);
  const completion = quote.total - deposit - progress;
  const start = new Date();
  const finish = new Date(Date.now() + 21 * 86400000);
  const project: UnifiedProject = {
    id,
    customerId: quote.customerId,
    customerName: quote.customerName,
    customerEmail: customer.email,
    quoteId: quote.id,
    projectName: `${quote.customerName} - ${quote.tradeName ?? 'Project'}`,
    tradeId: quote.tradeId,
    tradeName: quote.tradeName,
    address: customer.address,
    startDate: start.toISOString().split('T')[0],
    finishDate: finish.toISOString().split('T')[0],
    status: 'planning',
    description: `Project created from quote ${quote.id}`,
    assignedBuilder: 'Unassigned',
    totalCustomerCost: quote.total,
    workingDaysOff: [],
    milestones: [
      { id: 'M1', title: 'Start on site', targetDate: start.toISOString().split('T')[0], completed: false },
      { id: 'M2', title: 'First fix complete', targetDate: new Date(start.getTime() + 7 * 86400000).toISOString().split('T')[0], completed: false },
      { id: 'M3', title: 'Handover', targetDate: finish.toISOString().split('T')[0], completed: false },
    ],
    tasks: [],
    paymentStages: [
      { id: 'PS1', name: 'Deposit', percentage: 25, amount: deposit, status: 'due', dueDate: start.toISOString().split('T')[0] },
      { id: 'PS2', name: 'Progress', percentage: 50, amount: progress, status: 'pending' },
      { id: 'PS3', name: 'Completion', percentage: 25, amount: completion, status: 'pending', notes: 'On sign-off' },
    ],
    builderPayments: [],
    invoices: [],
    contracts: [],
    files: [],
    messages: [],
    contractorComms: [],
    aiActions: [],
    photos: [],
    designItems: [],
    changeOrders: [],
    costEntries: [],
    timesheets: [],
    whatsappMode: 'individual',
    portalToken: generateToken(),
    escalated: false,
    customerAutoUpdates: false,
    plans: [],
    assignedContractors: [],
    snags: [],
    handover: {},
  };
  const playbook = getPlaybook(quote.tradeId ?? 'bathroom');
  project.snags = playbook
    ? seedSnagsFromChecklist({ ...project, snags: [] }, playbook.snagChecklist)
    : [];
  const projects = loadProjects();
  projects.push(project);
  saveProjects(projects);
  savePortalToken(project.portalToken!, id, quote.customerId);
  return project;
}

export function getProjectByPortalToken(token: string): UnifiedProject | undefined {
  return loadProjects().find(p => p.portalToken === token);
}

export function getActiveProjectForCustomer(customerId: string): UnifiedProject | undefined {
  return loadProjects()
    .filter(p => p.customerId === customerId && p.status !== 'completed')
    .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}

function savePortalToken(token: string, projectId: string, customerId: string): void {
  const tokens = loadPortalTokens();
  tokens.push({
    token,
    projectId,
    customerId,
    expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
  });
  localStorage.setItem(PORTAL_TOKENS_KEY, JSON.stringify(tokens));
}

export function loadPortalTokens(): PortalToken[] {
  try {
    return JSON.parse(localStorage.getItem(PORTAL_TOKENS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function loadWhatsAppSessions(): WhatsAppSession[] {
  try {
    return JSON.parse(localStorage.getItem(WA_SESSIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveWhatsAppSession(phone: string, channel: 'individual' | 'group' = 'individual', groupId?: string): void {
  const normalized = phone.replace(/\D/g, '');
  const sessions = loadWhatsAppSessions().filter(s => s.phone !== normalized);
  sessions.push({
    phone: normalized,
    lastInboundAt: new Date().toISOString(),
    channel,
    groupId,
  });
  localStorage.setItem(WA_SESSIONS_KEY, JSON.stringify(sessions));
}

export function isWithin24hWindow(phone: string): boolean {
  const normalized = phone.replace(/\D/g, '');
  const session = loadWhatsAppSessions().find(s => s.phone === normalized);
  if (!session) return false;
  return Date.now() - new Date(session.lastInboundAt).getTime() < 24 * 60 * 60 * 1000;
}

export async function syncToServer(): Promise<void> {
  if (useCloudPersistence()) return;
  try {
    const { isSupabaseConfigured, saveAllProjectsToSupabase, saveCustomersToSupabase, saveQuotesToSupabase, saveContactsToSupabase, saveBuildersToSupabase } = await import('../data/supabaseStore');

    let customers: unknown[] = [];
    let quotes: unknown[] = [];
    try {
      customers = JSON.parse(localStorage.getItem('customers') ?? '[]');
      quotes = JSON.parse(localStorage.getItem('quotes') ?? '[]');
    } catch { /* ignore */ }

    if (isSupabaseConfigured()) {
      await saveAllProjectsToSupabase(loadProjects());
      if (customers.length) await saveCustomersToSupabase(customers as Record<string, unknown>[]);
      if (quotes.length) await saveQuotesToSupabase(quotes as Record<string, unknown>[]);
      await saveContactsToSupabase(loadContacts());
      await saveBuildersToSupabase(loadBuilders() as unknown as Record<string, unknown>[]);
      return;
    }

    // Legacy sync endpoint (deprecated)
    await fetch('/api/data/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projects: loadProjects(),
        contacts: loadContacts(),
        builders: loadBuilders(),
        customers,
        quotes,
        sessions: loadWhatsAppSessions(),
        bankAccounts: (await import('../banking/bankingStore')).loadBankAccounts(),
        bankTransactions: (await import('../banking/bankingStore')).loadBankTransactions(),
        clientReceipts: (await import('../banking/bankingStore')).loadClientReceipts(),
        planningApplications: (await import('../planning/planningStore')).loadPlanningApplications(),
      }),
    });
  } catch {
    // server may be offline in dev
  }
}
