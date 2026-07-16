/** Structured conversation / call notes on a CRM lead (Customer.activities). */

export const LEAD_AIMS = [
  'discovery',
  'demo_book',
  'trial_followup',
  'upgrade',
  'past_due',
  'win_back',
  'callback',
  'quote_chase',
  'other',
] as const;

export type LeadAim = (typeof LEAD_AIMS)[number];

export type LeadActivityType = 'note' | 'call' | 'callback' | 'status_change' | 'aria_call';

export interface LeadActivity {
  id: string;
  type: LeadActivityType;
  aim?: LeadAim | string;
  detail: string;
  outcome?: string;
  callSessionId?: string;
  createdAt: string;
  createdBy: 'staff' | 'cynthia' | string;
}

export const AIM_LABELS: Record<string, string> = {
  discovery: 'Discovery',
  demo_book: 'Book demo',
  trial_followup: 'Trial follow-up',
  upgrade: 'Upgrade',
  past_due: 'Past due',
  win_back: 'Win-back',
  callback: 'Callback',
  quote_chase: 'Quote chase',
  other: 'Other',
};

export function normalizeLeadActivities(raw: unknown): LeadActivity[] {
  if (!Array.isArray(raw)) return [];
  const out: LeadActivity[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const r = row as Record<string, unknown>;
    const detail = String(r.detail ?? r.summary ?? '').trim();
    if (!detail && !r.type) continue;
    out.push({
      id: String(r.id ?? `LA${Date.now()}`),
      type: (String(r.type ?? 'note') as LeadActivityType),
      aim: r.aim != null ? String(r.aim) : undefined,
      detail: detail || '(no detail)',
      outcome: r.outcome != null ? String(r.outcome) : undefined,
      callSessionId: r.callSessionId != null
        ? String(r.callSessionId)
        : r.callId != null
          ? String(r.callId)
          : undefined,
      createdAt: String(r.createdAt ?? new Date().toISOString()),
      createdBy: String(r.createdBy ?? (String(r.type) === 'aria_call' ? 'cynthia' : 'staff')),
    });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function createLeadActivity(input: {
  type: LeadActivityType;
  detail: string;
  aim?: string;
  outcome?: string;
  callSessionId?: string;
  createdBy?: string;
}): LeadActivity {
  return {
    id: `LA${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type: input.type,
    aim: input.aim,
    detail: input.detail.trim(),
    outcome: input.outcome,
    callSessionId: input.callSessionId,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy ?? 'staff',
  };
}

export function formatLeadBriefLines(activities: LeadActivity[], limit = 8): string[] {
  return activities.slice(0, limit).map((a) => {
    const when = a.createdAt.slice(0, 16).replace('T', ' ');
    const aim = a.aim ? ` [${AIM_LABELS[a.aim] ?? a.aim}]` : '';
    const who = a.createdBy === 'cynthia' ? 'Cynthia' : a.createdBy;
    return `${when}${aim} (${who}/${a.type}): ${a.detail.slice(0, 200)}${a.outcome ? ` → ${a.outcome}` : ''}`;
  });
}
