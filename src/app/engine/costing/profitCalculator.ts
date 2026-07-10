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

export function getBuilderHourlyRate(dayRate?: number, hourlyRate?: number): number {
  if (typeof hourlyRate === 'number' && hourlyRate > 0) return hourlyRate;
  if (typeof dayRate === 'number' && dayRate > 0) return dayRate / 8;
  return 25;
}

export function sumMaterialCosts(entries: CostEntry[] = []): number {
  return entries
    .filter((e) => e.status !== 'flagged' || e.total > 0)
    .reduce((sum, e) => sum + e.total, 0);
}

export function sumLabourCosts(timesheets: TimesheetEntry[] = []): number {
  return timesheets.reduce((sum, t) => sum + (t.labourCost ?? 0), 0);
}

export function sumHours(timesheets: TimesheetEntry[] = []): number {
  return timesheets.reduce((sum, t) => sum + (t.hours ?? 0), 0);
}

export function getCategoryBreakdown(entries: CostEntry[] = []): Record<string, number> {
  const breakdown: Record<string, number> = {};
  for (const entry of entries) {
    for (const item of entry.items) {
      const cat = item.category || 'uncategorised';
      breakdown[cat] = (breakdown[cat] ?? 0) + item.total;
    }
    if (entry.items.length === 0) {
      breakdown.other = (breakdown.other ?? 0) + entry.total;
    }
  }
  return breakdown;
}

export function getProjectRevenue(project: UnifiedProject): number {
  const paidInvoices = project.invoices
    .filter((inv) => inv.status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);
  if (paidInvoices > 0) return paidInvoices;
  return project.totalCustomerCost;
}

export function getProjectProfit(project: UnifiedProject): ProjectProfitSummary {
  const costEntries = project.costEntries ?? [];
  const timesheets = project.timesheets ?? [];
  const materialCosts = sumMaterialCosts(costEntries);
  const labourCosts = sumLabourCosts(timesheets);
  const otherCosts = project.builderPayments
    .filter((p) => p.status !== 'pending')
    .reduce((sum, p) => sum + p.amount, 0);
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
    marginPct,
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
  return {
    totalRevenue,
    totalCosts,
    grossProfit,
    marginPct: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
    projects: summaries,
  };
}
