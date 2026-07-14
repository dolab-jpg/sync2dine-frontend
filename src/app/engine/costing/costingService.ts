import { getProject, updateProject, loadProjects, syncToServer } from '../project/projectStore';
import { loadBuilders } from '../builder/builderStore';
import { getBuilderHourlyRate } from './profitCalculator';
import type { CostEntry, CostEntryItem, TimesheetEntry, UnifiedProject } from '../project/types';
import type { ReceiptParseResult } from './receiptService';
import { getProjectProfit, getPortfolioProfit, type ProjectProfitSummary } from './profitCalculator';

export { getProjectProfit, getPortfolioProfit, type ProjectProfitSummary };

function generateId(prefix: string): string {
  return `${prefix}${Date.now()}${Math.random().toString(36).slice(2, 6)}`;
}

export function getBuilderProjects(builderName: string): UnifiedProject[] {
  const normalized = builderName.toLowerCase();
  return loadProjects().filter(
    (p) =>
      p.assignedBuilder.toLowerCase().includes(normalized)
      || normalized.includes(p.assignedBuilder.toLowerCase())
      || p.status === 'in_progress'
      || p.status === 'planning'
  );
}

export function addCostEntry(
  projectId: string,
  entry: Omit<CostEntry, 'id' | 'createdAt' | 'projectId'>
): CostEntry | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;

  const newEntry: CostEntry = {
    ...entry,
    id: generateId('CE'),
    projectId,
    createdAt: new Date().toISOString(),
  };

  updateProject(projectId, {
    costEntries: [...(project.costEntries ?? []), newEntry],
  });
  void syncToServer();
  return newEntry;
}

export function createCostEntryFromReceipt(
  projectId: string,
  builderId: string,
  receipt: ReceiptParseResult,
  receiptPhoto?: string
): CostEntry | undefined {
  return addCostEntry(projectId, {
    builderId,
    type: 'receipt',
    supplier: receipt.supplier,
    date: receipt.date,
    items: receipt.items,
    subtotal: receipt.subtotal,
    vat: receipt.vat,
    total: receipt.total,
    receiptPhoto,
    aiConfidence: receipt.confidence,
    aiSummary: receipt.aiSummary,
    status: receipt.flagged ? 'flagged' : 'recorded',
  });
}

export function updateCostEntry(
  projectId: string,
  entryId: string,
  updates: Partial<Pick<CostEntry, 'supplier' | 'date' | 'items' | 'subtotal' | 'vat' | 'total' | 'status' | 'aiSummary'>>
): CostEntry | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;

  let updated: CostEntry | undefined;
  const costEntries = (project.costEntries ?? []).map((entry) => {
    if (entry.id !== entryId) return entry;
    updated = {
      ...entry,
      ...updates,
      status: updates.status ?? (updates.total && updates.total > 0 ? 'recorded' : entry.status),
    };
    return updated;
  });

  if (!updated) return undefined;
  updateProject(projectId, { costEntries });
  void syncToServer();
  return updated;
}

export function fixCostEntry(
  projectId: string,
  entryId: string,
  fixes: {
    supplier?: string;
    items?: CostEntryItem[];
    total?: number;
    notes?: string;
  }
): CostEntry | undefined {
  const items = fixes.items;
  const subtotal = items ? items.reduce((s, i) => s + i.total, 0) : undefined;
  return updateCostEntry(projectId, entryId, {
    supplier: fixes.supplier,
    items,
    subtotal,
    total: fixes.total ?? subtotal,
    status: 'recorded',
    aiSummary: fixes.notes,
  });
}

export function getActiveClockIn(projectId: string, builderId: string): TimesheetEntry | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;
  return (project.timesheets ?? []).find(
    (t) => t.builderId === builderId && t.clockIn && !t.clockOut
  );
}

export function clockIn(projectId: string, builderId: string, rate?: number): TimesheetEntry | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;

  const existing = getActiveClockIn(projectId, builderId);
  if (existing) return existing;

  const builder = loadBuilders().find((b) => b.id === builderId);
  const hourlyRate = rate ?? getBuilderHourlyRate(builder?.dayRate, builder?.hourlyRate);

  const entry: TimesheetEntry = {
    id: generateId('TS'),
    projectId,
    builderId,
    clockIn: new Date().toISOString(),
    rate: hourlyRate,
  };

  updateProject(projectId, {
    timesheets: [...(project.timesheets ?? []), entry],
  });
  void syncToServer();
  return entry;
}

export function clockOut(projectId: string, builderId: string, notes?: string): TimesheetEntry | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;

  const active = getActiveClockIn(projectId, builderId);
  if (!active) return undefined;

  const clockOutTime = new Date();
  const clockInTime = new Date(active.clockIn);
  const hours = Math.round(((clockOutTime.getTime() - clockInTime.getTime()) / 3600000) * 100) / 100;
  const labourCost = Math.round(hours * active.rate * 100) / 100;

  let updated: TimesheetEntry | undefined;
  const timesheets = (project.timesheets ?? []).map((t) => {
    if (t.id !== active.id) return t;
    updated = {
      ...t,
      clockOut: clockOutTime.toISOString(),
      hours,
      labourCost,
      notes: notes ?? t.notes,
    };
    return updated;
  });

  if (!updated) return undefined;
  updateProject(projectId, { timesheets });
  void syncToServer();
  return updated;
}

export function logHours(
  projectId: string,
  builderId: string,
  hours: number,
  date?: string,
  notes?: string,
  rate?: number
): TimesheetEntry | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;

  const builder = loadBuilders().find((b) => b.id === builderId);
  const hourlyRate = rate ?? getBuilderHourlyRate(builder?.dayRate, builder?.hourlyRate);
  const labourCost = Math.round(hours * hourlyRate * 100) / 100;
  const clockInDate = date ? new Date(date) : new Date();
  const clockOutDate = new Date(clockInDate.getTime() + hours * 3600000);

  const entry: TimesheetEntry = {
    id: generateId('TS'),
    projectId,
    builderId,
    clockIn: clockInDate.toISOString(),
    clockOut: clockOutDate.toISOString(),
    hours,
    rate: hourlyRate,
    labourCost,
    notes,
  };

  updateProject(projectId, {
    timesheets: [...(project.timesheets ?? []), entry],
  });
  void syncToServer();
  return entry;
}

export function correctTimesheet(
  projectId: string,
  timesheetId: string,
  updates: { hours?: number; notes?: string; rate?: number }
): TimesheetEntry | undefined {
  const project = getProject(projectId);
  if (!project) return undefined;

  let updated: TimesheetEntry | undefined;
  const timesheets = (project.timesheets ?? []).map((t) => {
    if (t.id !== timesheetId) return t;
    const hours = updates.hours ?? t.hours ?? 0;
    const rate = updates.rate ?? t.rate;
    updated = {
      ...t,
      hours,
      rate,
      labourCost: Math.round(hours * rate * 100) / 100,
      notes: updates.notes ?? t.notes,
    };
    return updated;
  });

  if (!updated) return undefined;
  updateProject(projectId, { timesheets });
  void syncToServer();
  return updated;
}

export function recordManualCostEntry(
  projectId: string,
  builderId: string,
  data: {
    supplier: string;
    total: number;
    items?: CostEntryItem[];
    aiSummary?: string;
    type?: 'manual' | 'ai';
  }
): CostEntry | undefined {
  const items = data.items ?? [{
    description: data.aiSummary ?? data.supplier,
    qty: 1,
    unitPrice: data.total,
    total: data.total,
    category: 'other',
  }];

  return addCostEntry(projectId, {
    builderId,
    type: data.type ?? 'ai',
    supplier: data.supplier,
    date: new Date().toISOString().split('T')[0],
    items,
    subtotal: data.total,
    vat: 0,
    total: data.total,
    aiConfidence: 1,
    aiSummary: data.aiSummary ?? `Manual cost: ${data.supplier} — £${data.total}`,
    status: 'recorded',
  });
}

export function getFlaggedEntries(): Array<{ project: UnifiedProject; entry: CostEntry }> {
  return loadProjects().flatMap((project) =>
    (project.costEntries ?? [])
      .filter((e) => e.status === 'flagged')
      .map((entry) => ({ project, entry }))
  );
}

export async function generateCostInsights(
  projects: UnifiedProject[],
  question?: string
): Promise<string> {
  const portfolio = getPortfolioProfit(projects);
  const openaiConfig = (await import('../integrations/integrationService')).integrationService.getConfig('openai');

  const context = {
    totalRevenue: portfolio.totalRevenue,
    totalCosts: portfolio.totalCosts,
    grossProfit: portfolio.grossProfit,
    marginPct: portfolio.marginPct,
    projects: portfolio.projects.map((p) => ({
      name: p.projectName,
      customer: p.customerName,
      revenue: p.revenue,
      costs: p.totalCosts,
      profit: p.grossProfit,
      margin: p.marginPct,
      flagged: p.flaggedCount,
      categories: p.categoryBreakdown,
    })),
  };

  const res = await fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKey: integrationService.getLiveOpenAIApiKey(),
      model: openaiConfig.staffModel || 'gpt-4o-mini',
      systemPrompt: 'You are a UK construction finance AI. Analyse job costing data and give concise profit insights, flag overspend, and highlight margin risks. Use GBP.',
      messages: [{
        role: 'user',
        content: question
          ? `Cost data:\n${JSON.stringify(context, null, 2)}\n\nQuestion: ${question}`
          : `Analyse this portfolio costing data and give 3-5 bullet insights:\n${JSON.stringify(context, null, 2)}`,
      }],
    }),
  });

  const data = await res.json() as { content?: string };
  if (data.content) return data.content;

  const lowMargin = portfolio.projects.filter((p) => p.marginPct < 20);
  const lines = [
    `Portfolio margin: ${portfolio.marginPct.toFixed(1)}% (£${portfolio.grossProfit.toLocaleString('en-GB')} profit on £${portfolio.totalRevenue.toLocaleString('en-GB')} revenue).`,
  ];
  if (lowMargin.length) {
    lines.push(`Low margin jobs: ${lowMargin.map((p) => p.projectName).join(', ')}.`);
  }
  const flagged = portfolio.projects.reduce((s, p) => s + p.flaggedCount, 0);
  if (flagged) lines.push(`${flagged} receipt(s) flagged for review.`);
  return lines.join('\n');
}
