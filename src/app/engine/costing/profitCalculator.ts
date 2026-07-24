import type { UnifiedProject, CostEntry, TimesheetEntry } from '../project/types';

export interface ProjectProfitSummary {
  projectId: string;
  projectName: string;
  customerName: string;
  status: string;
  revenue: number;
  materialCosts: number;
  labourCosts: number;
  otherCosts: number;
  totalCosts: number;
  grossProfit: number;
  marginPct: number;
  totalHours: number;
  costEntryCount: number;
  flaggedCount: number;
  categoryBreakdown: Record<string, number>;
}

/** Coerce unknown money fields to a finite number (legacy payments omit `amount`). */
export function finiteMoney(value: unknown, fallback = 0): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** Resolve builder payment cost from canonical or legacy shapes. */
export function resolveBuilderPaymentAmount(payment: {
  amount?: unknown;
  totalEarned?: unknown;
  agreedAmount?: unknown;
}): number {
  if (payment.amount != null && payment.amount !== '') {
    return finiteMoney(payment.amount);
  }
  if (payment.totalEarned != null && payment.totalEarned !== '') {
    return finiteMoney(payment.totalEarned);
  }
  if (payment.agreedAmount != null && payment.agreedAmount !== '') {
    return finiteMoney(payment.agreedAmount);
  }
  return 0;
}

export function getBuilderHourlyRate(dayRate?: number, hourlyRate?: number): number {
  if (typeof hourlyRate === 'number' && hourlyRate > 0) return hourlyRate;
  if (typeof dayRate === 'number' && dayRate > 0) return dayRate / 8;
  return 25;
}

export function sumMaterialCosts(entries: CostEntry[] = []): number {
  return entries
    .filter((e) => e.status !== 'flagged' || finiteMoney(e.total) > 0)
    .reduce((sum, e) => sum + finiteMoney(e.total), 0);
}

export function sumLabourCosts(timesheets: TimesheetEntry[] = []): number {
  return timesheets.reduce((sum, t) => sum + finiteMoney(t.labourCost), 0);
}

export function sumHours(timesheets: TimesheetEntry[] = []): number {
  return timesheets.reduce((sum, t) => sum + finiteMoney(t.hours), 0);
}

export function getCategoryBreakdown(entries: CostEntry[] = []): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const entry of entries) {
    for (const item of entry.items) {
      const cat = item.category || 'uncategorised';
      breakdown[cat] = (breakdown[cat] ?? 0) + finiteMoney(item.total);
    }
    if (entry.items.length === 0) {
      breakdown.other = (breakdown.other ?? 0) + finiteMoney(entry.total);
    }
  }
  return breakdown;
}

export function getProjectRevenue(project: UnifiedProject): number {
  const paidInvoices = (project.invoices ?? [])
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + finiteMoney(inv.total), 0);
  if (paidInvoices > 0) return paidInvoices;
  return finiteMoney(project.totalCustomerCost);
}

export function getProjectProfit(project: UnifiedProject): ProjectProfitSummary {
  const costEntries = project.costEntries ?? [];
  const timesheets = project.timesheets ?? [];
  const materialCosts = sumMaterialCosts(costEntries);
  const labourCosts = sumLabourCosts(timesheets);
  const otherCosts = (project.builderPayments ?? [])
    .filter((p) => p.status !== 'pending')
    .reduce((sum, p) => sum + resolveBuilderPaymentAmount(p), 0);
  const revenue = getProjectRevenue(project);
  const totalCosts = materialCosts + labourCosts + otherCosts;
  const grossProfit = revenue - totalCosts;
  const marginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  return {
    projectId: project.id,
    projectName: project.projectName,
    customerName: project.customerName,
    status: project.status,
    revenue,
    materialCosts,
    labourCosts,
    otherCosts,
    totalCosts,
    grossProfit,
    marginPct: Number.isFinite(marginPct) ? marginPct : 0,
    totalHours: sumHours(timesheets),
    costEntryCount: costEntries.length,
    flaggedCount: costEntries.filter((e) => e.status === 'flagged').length,
    categoryBreakdown: getCategoryBreakdown(costEntries),
  };
}

export function getPortfolioProfit(projects: UnifiedProject[]): {
  totalRevenue: number;
  totalCosts: number;
  grossProfit: number;
  marginPct: number;
  projects: ProjectProfitSummary[];
} {
  const summaries = projects.map(getProjectProfit);
  const totalRevenue = summaries.reduce((s, p) => s + p.revenue, 0);
  const totalCosts = summaries.reduce((s, p) => s + p.totalCosts, 0);
  const grossProfit = totalRevenue - totalCosts;
  const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
  return {
    totalRevenue,
    totalCosts,
    grossProfit,
    marginPct: Number.isFinite(marginPct) ? marginPct : 0,
    projects: summaries,
  };
}
