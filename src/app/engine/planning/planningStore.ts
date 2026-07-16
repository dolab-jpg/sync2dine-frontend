import {
  emptyPostApproval,
  type PlanningAiAction,
  type PlanningApplication,
  type PlanningApplicationType,
  type PlanningChangeRequest,
  type PlanningComment,
  type PlanningStage,
} from './types';

const STORAGE_KEY = 'tradepro_planning_applications';

type Subscriber = (applications: PlanningApplication[]) => void;
const subscribers = new Set<Subscriber>();

function readAll(): PlanningApplication[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(migrate) : [];
  } catch {
    return [];
  }
}

function migrate(p: Record<string, unknown>): PlanningApplication {
  const base = p as Partial<PlanningApplication>;
  return {
    id: String(base.id ?? `plan-${Date.now()}`),
    customerId: base.customerId,
    customerName: base.customerName ?? 'Unknown customer',
    customerEmail: base.customerEmail,
    customerPhone: base.customerPhone,
    address: base.address ?? '',
    title: base.title ?? 'Planning application',
    applicationType: (base.applicationType as PlanningApplicationType) ?? 'householder',
    stage: (base.stage as PlanningStage) ?? 'pricing',
    description: base.description,
    pricing: base.pricing ?? {},
    drawings: Array.isArray(base.drawings) ? base.drawings : [],
    customerApproval: base.customerApproval ?? { token: generateToken(), status: 'pending' },
    council: base.council ?? {},
    changeRequests: Array.isArray(base.changeRequests) ? base.changeRequests : [],
    comments: Array.isArray(base.comments) ? base.comments : [],
    courtesyEmailSentAt: base.courtesyEmailSentAt,
    decision: base.decision,
    decidedAt: base.decidedAt,
    decisionNote: base.decisionNote,
    postApproval: base.postApproval ?? emptyPostApproval(),
    aiActions: Array.isArray(base.aiActions) ? base.aiActions : [],
    projectId: base.projectId,
    createdAt: base.createdAt ?? new Date().toISOString(),
    updatedAt: base.updatedAt ?? new Date().toISOString(),
    createdBy: base.createdBy ?? 'Staff',
  };
}

function writeAll(applications: PlanningApplication[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(applications.slice(0, 200)));
  const snapshot = [...applications];
  subscribers.forEach((fn) => fn(snapshot));
  void syncPlanning();
}

async function syncPlanning(): Promise<void> {
  try {
    const { syncToServer } = await import('../project/projectStore');
    await syncToServer();
  } catch {
    // server may be offline in dev
  }
}

export function generateToken(): string {
  return `plan_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function subscribePlanningApplications(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function loadPlanningApplications(): PlanningApplication[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getPlanningApplication(id: string): PlanningApplication | undefined {
  return readAll().find((a) => a.id === id);
}

export function getPlanningApplicationByApprovalToken(token: string): PlanningApplication | undefined {
  return readAll().find((a) => a.customerApproval?.token === token);
}

export function findPlanningApplicationByProjectId(projectId: string): PlanningApplication | undefined {
  return readAll().find((a) => a.projectId === projectId);
}

export function findPlanningApplicationsByCustomerId(customerId: string): PlanningApplication[] {
  return readAll().filter((a) => a.customerId === customerId);
}

export interface CreatePlanningInput {
  customerId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  address?: string;
  title?: string;
  applicationType?: PlanningApplicationType;
  description?: string;
  createdBy: string;
}

export function createPlanningApplication(input: CreatePlanningInput): PlanningApplication {
  const now = new Date().toISOString();
  const application: PlanningApplication = {
    id: `plan-${Date.now()}`,
    customerId: input.customerId,
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone,
    address: input.address ?? '',
    title: input.title ?? `${input.customerName} - planning application`,
    applicationType: input.applicationType ?? 'householder',
    stage: 'pricing',
    description: input.description,
    pricing: {},
    drawings: [],
    customerApproval: { token: generateToken(), status: 'pending' },
    council: {},
    changeRequests: [],
    comments: [],
    postApproval: emptyPostApproval(),
    aiActions: [],
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
  };
  const all = readAll();
  all.unshift(application);
  writeAll(all);
  return application;
}

export function updatePlanningApplication(
  id: string,
  patch: Partial<PlanningApplication>
): PlanningApplication | null {
  const all = readAll();
  const idx = all.findIndex((a) => a.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function deletePlanningApplication(id: string): void {
  writeAll(readAll().filter((a) => a.id !== id));
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function addPlanningComment(
  id: string,
  body: string,
  source: PlanningComment['source'],
  author: string
): PlanningApplication | null {
  const app = getPlanningApplication(id);
  if (!app) return null;
  const comment: PlanningComment = {
    id: nextId('cmt'),
    author,
    body,
    source,
    createdAt: new Date().toISOString(),
  };
  return updatePlanningApplication(id, { comments: [...app.comments, comment] });
}

export function addPlanningChangeRequest(
  id: string,
  input: { description: string; deadline?: string; sourceEmail?: string; aiComment?: string }
): PlanningApplication | null {
  const app = getPlanningApplication(id);
  if (!app) return null;
  const cr: PlanningChangeRequest = {
    id: nextId('cr'),
    raisedAt: new Date().toISOString(),
    description: input.description,
    deadline: input.deadline,
    sourceEmail: input.sourceEmail,
    aiComment: input.aiComment,
    status: 'open',
  };
  return updatePlanningApplication(id, {
    changeRequests: [...app.changeRequests, cr],
    stage: 'changes_requested',
  });
}

export function updateChangeRequest(
  id: string,
  changeRequestId: string,
  patch: Partial<PlanningChangeRequest>
): PlanningApplication | null {
  const app = getPlanningApplication(id);
  if (!app) return null;
  const changeRequests = app.changeRequests.map((cr) =>
    cr.id === changeRequestId ? { ...cr, ...patch } : cr
  );
  return updatePlanningApplication(id, { changeRequests });
}

/** Record an AI action with a full pre-action snapshot so it can be undone. */
export function recordPlanningAiAction(
  id: string,
  entry: { action: string; summary: string; input: Record<string, unknown>; previous: Record<string, unknown> },
  createdBy = 'AI'
): void {
  const app = getPlanningApplication(id);
  if (!app) return;
  const aiAction: PlanningAiAction = {
    id: nextId('ai'),
    action: entry.action,
    summary: entry.summary,
    input: entry.input,
    previous: entry.previous,
    createdAt: new Date().toISOString(),
    createdBy,
    status: 'applied',
  };
  updatePlanningApplication(id, { aiActions: [aiAction, ...app.aiActions] });
}

/** Restore the application to the snapshot captured before an AI action ran. */
export function undoPlanningAiAction(id: string, actionId: string): PlanningApplication | null {
  const app = getPlanningApplication(id);
  if (!app) return null;
  const action = app.aiActions.find((a) => a.id === actionId);
  if (!action || action.status === 'undone' || !action.previous) return null;

  const restored = action.previous as Partial<PlanningApplication>;
  const aiActions = app.aiActions.map((a) =>
    a.id === actionId ? { ...a, status: 'undone' as const } : a
  );
  return updatePlanningApplication(id, {
    ...restored,
    aiActions,
  });
}

/** Snapshot used for undo: everything except the action log itself. */
export function snapshotForUndo(app: PlanningApplication): Record<string, unknown> {
  const { aiActions: _ignored, ...rest } = app;
  return rest;
}
