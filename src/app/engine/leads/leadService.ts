import type { Customer, Quote } from '../../App';

export type LeadSource = NonNullable<Customer['source']>;

const PIPELINE_STATUSES = new Set(['lead', 'quoted', 'won', 'lost']);

export function isLeadCustomer(c: Customer): boolean {
  return PIPELINE_STATUSES.has(c.status) || !!c.source;
}

export function getDueFollowUps(customers: Customer[]): Customer[] {
  const now = Date.now();
  return customers.filter((c) => {
    if (!c.nextFollowUp) return false;
    if (c.status === 'won' || c.status === 'lost') return false;
    return new Date(c.nextFollowUp).getTime() <= now;
  });
}

/** Leads that belong on the Call Queue board (scraped / dial tracking). */
export function isCallQueueLead(c: Customer): boolean {
  if (c.status === 'won' || c.status === 'lost') return false;
  if (c.callQueueStatus) return true;
  if (c.source === 'purchased' || c.leadBatchId) return true;
  if (c.phone && (c.status === 'lead' || c.status === 'quoted')) return true;
  return false;
}

export function getCallQueueLeads(customers: Customer[]): Customer[] {
  return customers.filter(isCallQueueLead);
}

export function computeLeadAttribution(customers: Customer[], quotes: Quote[]) {
  const sources = new Map<string, { source: string; leads: number; won: number; revenue: number }>();

  for (const c of customers) {
    const source = c.source ?? 'unknown';
    const row = sources.get(source) ?? { source, leads: 0, won: 0, revenue: 0 };
    row.leads += 1;
    if (c.status === 'won') row.won += 1;
    sources.set(source, row);
  }

  for (const q of quotes) {
    if (q.status !== 'accepted') continue;
    const customer = customers.find((c) => c.id === q.customerId);
    const source = customer?.source ?? 'unknown';
    const row = sources.get(source) ?? { source, leads: 0, won: 0, revenue: 0 };
    row.revenue += q.total;
    sources.set(source, row);
  }

  return [...sources.values()].sort((a, b) => b.revenue - a.revenue);
}

export function syncCustomerStatusFromQuote(
  customerId: string,
  quoteStatus: Quote['status'],
  customers: Customer[],
): Partial<Customer> | null {
  const customer = customers.find((c) => c.id === customerId);
  if (!customer) return null;

  if (quoteStatus === 'sent' || quoteStatus === 'awaiting_approval' || quoteStatus === 'approved') {
    if (customer.status === 'lead') return { status: 'quoted' };
  }
  if (quoteStatus === 'accepted') {
    return { status: 'won', lastContact: new Date().toISOString() };
  }
  // Manager price rejection must not close the sales lead — only expired quotes do.
  if (quoteStatus === 'expired') {
    return { status: 'lost', lastContact: new Date().toISOString() };
  }
  return null;
}

export function buildLeadPipelineSnapshot(customers: Customer[]) {
  return {
    total: customers.filter(isLeadCustomer).length,
    leads: customers.filter((c) => c.status === 'lead').length,
    quoted: customers.filter((c) => c.status === 'quoted').length,
    won: customers.filter((c) => c.status === 'won').length,
    lost: customers.filter((c) => c.status === 'lost').length,
    followUpsDue: getDueFollowUps(customers).map((c) => ({
      id: c.id,
      name: c.name,
      nextFollowUp: c.nextFollowUp,
      source: c.source,
      leadScore: c.leadScore,
    })),
    recentLeads: customers
      .filter((c) => c.status === 'lead' || c.status === 'quoted')
      .slice(0, 10)
      .map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        source: c.source,
        leadScore: c.leadScore,
        budget: c.budget,
      })),
  };
}
