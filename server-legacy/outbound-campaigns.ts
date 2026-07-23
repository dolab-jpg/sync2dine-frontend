/**
 * Campaign helpers for Call Centre (CSV bulk queue + lightweight templates).
 * Full lapsed-order campaigns live in sync2dine-backend when orders are available.
 */
import {
  enqueueOutboundCall,
  getAgentSettings,
  getDataStore,
  normalizePhoneExport,
} from './data-store';

export type CsvCampaignRow = {
  name: string;
  phone: string;
  notes?: string;
  customerId?: string;
};

export function getCampaignTemplates() {
  const settings = getAgentSettings();
  return [
    {
      id: 'lead_callback' as const,
      label: 'Lead callback',
      defaultDays: 0,
      brief: settings.defaultOutboundBrief ?? 'Follow up on their enquiry.',
    },
    {
      id: 'customer_reorder' as const,
      label: 'Reorder reminder',
      defaultDays: 14,
      brief: 'Check if they would like to place another order.',
    },
    {
      id: 'lapse_winback' as const,
      label: 'Win-back call',
      defaultDays: 30,
      brief: 'We have not seen them in a while — invite them back.',
    },
  ];
}

export async function listCustomersWithLastOrderOlderThan(_days: number) {
  return [] as Array<{
    customerId?: string;
    customerName: string;
    phone: string;
    lastOrderAt: string;
    daysSinceOrder: number;
    orderCount: number;
  }>;
}

export async function queueLapsedCampaign(_input: {
  template: string;
  daysOlderThan: number;
  dryRun?: boolean;
}) {
  return { queued: 0, candidates: [], jobs: [] as Array<Record<string, unknown>> };
}

/** Parse simple CSV with headers name,phone[,notes][,customerId]. */
export function parseCampaignCsv(text: string): CsvCampaignRow[] {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].toLowerCase();
  const hasHeader = /name/.test(header) && /phone/.test(header);
  const start = hasHeader ? 1 : 0;
  const cols = hasHeader
    ? lines[0].split(',').map((c) => c.trim().toLowerCase().replace(/^"|"$/g, ''))
    : ['name', 'phone', 'notes', 'customerId'];
  const idx = (key: string) => cols.findIndex((c) => c === key || c.includes(key));
  const nameI = idx('name');
  const phoneI = idx('phone');
  const notesI = idx('note');
  const idI = idx('customer');
  const rows: CsvCampaignRow[] = [];
  for (let i = start; i < lines.length; i++) {
    const parts = lines[i].match(/("([^"]|"")*"|[^,]*)/g)?.map((p) => p.replace(/^"|"$/g, '').replace(/""/g, '"').trim())
      ?? lines[i].split(',').map((p) => p.trim());
    const phone = parts[phoneI >= 0 ? phoneI : 1] ?? '';
    const name = parts[nameI >= 0 ? nameI : 0] ?? 'Guest';
    if (!phone) continue;
    rows.push({
      name: name || 'Guest',
      phone,
      notes: notesI >= 0 ? parts[notesI] : undefined,
      customerId: idI >= 0 ? parts[idI] : undefined,
    });
  }
  return rows;
}

export function queueCsvCampaign(input: {
  rows: CsvCampaignRow[];
  template?: string;
  brief?: string;
  dryRun?: boolean;
}): { queued: number; skipped: number; jobs: Array<Record<string, unknown>>; preview: CsvCampaignRow[] } {
  const template = String(input.template || 'lead_callback');
  const brief = String(input.brief || getAgentSettings().defaultOutboundBrief || 'Follow up on their enquiry.');
  const store = getDataStore();
  const alreadyQueued = new Set(
    store.outboundQueue
      .filter((j) => ['queued', 'dialling'].includes(String(j.status ?? '')))
      .map((j) => normalizePhoneExport(String(j.to ?? ''))),
  );
  const jobs: Array<Record<string, unknown>> = [];
  let skipped = 0;
  const campaignId = `camp-${Date.now()}`;
  for (let i = 0; i < input.rows.length; i++) {
    const row = input.rows[i];
    const phone = normalizePhoneExport(row.phone);
    if (!phone || alreadyQueued.has(phone)) {
      skipped += 1;
      continue;
    }
    alreadyQueued.add(phone);
    if (input.dryRun) continue;
    const job = enqueueOutboundCall({
      to: phone,
      template,
      status: 'queued',
      customerId: row.customerId,
      context: {
        customerId: row.customerId,
        customerName: row.name,
        aim: template,
        brief: row.notes ? `${brief} Notes: ${row.notes}` : brief,
        source: 'csv_campaign',
        campaignId,
        rowIndex: i,
      },
    });
    jobs.push(job);
  }
  return {
    queued: jobs.length,
    skipped,
    jobs,
    preview: input.rows.slice(0, 10),
  };
}
