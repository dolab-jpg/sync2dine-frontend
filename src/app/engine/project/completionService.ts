import type { UnifiedProject, SnagItem, Invoice, PaymentStage } from '../types';

const PORTFOLIO_KEY = 'portfolioEntries';

export function loadPortfolioEntries() {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function savePortfolioEntries(entries: unknown[]) {
  localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(entries));
}

export function addProjectToPortfolio(project: UnifiedProject) {
  const entries = loadPortfolioEntries();
  const entry = {
    id: `PF${Date.now()}`,
    projectId: project.id,
    title: project.projectName,
    tradeName: project.tradeName,
    beforePhotos: project.photos.slice(0, 2),
    afterPhotos: project.photos.slice(-2),
    review: project.review,
    completedAt: project.handover?.signedAt ?? new Date().toISOString(),
  };
  entries.unshift(entry);
  savePortfolioEntries(entries);
  return entry;
}

export function seedSnagsFromChecklist(project: UnifiedProject, checklist: readonly string[]): SnagItem[] {
  const existing = project.snags ?? [];
  const titles = new Set(existing.map((s) => s.title));
  const added: SnagItem[] = [];
  for (const title of checklist) {
    if (titles.has(title)) continue;
    added.push({
      id: `SN${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      status: 'open',
      source: 'checklist',
    });
  }
  return [...existing, ...added];
}

export function canProceedToHandover(project: UnifiedProject): boolean {
  return (project.snags ?? []).every((s) => s.status === 'resolved');
}

export function settleBuilderPayments(project: UnifiedProject) {
  return (project.builderPayments ?? []).map((p) =>
    p.status === 'pending' || p.status === 'approved' ? { ...p, status: 'paid' as const } : p,
  );
}

export function createFinalInvoice(project: UnifiedProject, stage: PaymentStage): Invoice {
  return {
    id: `INV${Date.now()}`,
    stageId: stage.id,
    lineItems: [{ description: `${stage.name} — ${project.projectName}`, amount: stage.amount }],
    total: stage.amount,
    status: 'draft',
    createdAt: new Date().toISOString(),
  };
}

export function appendFinalInvoiceIfMissing(project: UnifiedProject, stage: PaymentStage | undefined): Invoice[] {
  if (!stage) return project.invoices ?? [];
  const invoices = project.invoices ?? [];
  if (invoices.some((i) => i.stageId === stage.id)) return invoices;
  return [...invoices, createFinalInvoice(project, stage)];
}

export function markCustomerForRepeatBusiness(customerId: string): void {
  if (!customerId) return;
  try {
    const raw = localStorage.getItem('customers');
    if (!raw) return;
    const customers = JSON.parse(raw) as Array<Record<string, unknown>>;
    const idx = customers.findIndex((c) => c.id === customerId);
    if (idx < 0) return;
    const followUp = new Date();
    followUp.setMonth(followUp.getMonth() + 3);
    const existingNotes = typeof customers[idx].notes === 'string' ? customers[idx].notes : '';
    const noteLine = 'Project completed — follow up for repeat work';
    customers[idx] = {
      ...customers[idx],
      status: 'won',
      lastContact: new Date().toISOString(),
      nextFollowUp: followUp.toISOString(),
      notes: existingNotes.includes(noteLine) ? existingNotes : `${existingNotes}\n${noteLine}`.trim(),
    };
    localStorage.setItem('customers', JSON.stringify(customers));
  } catch {
    /* ignore */
  }
}
