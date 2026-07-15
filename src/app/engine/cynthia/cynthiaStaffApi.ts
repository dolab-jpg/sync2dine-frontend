/** Client API for staff Cynthia inbox (cards from calls + thread sync). */

export type CynthiaCardAction = {
  label: string;
  kind: 'call' | 'email' | 'open' | 'navigate';
  value: string;
};

export type CynthiaStaffCard = {
  id: string;
  title: string;
  customerName?: string;
  phone?: string;
  address?: string;
  amount?: number;
  currency?: string;
  summary?: string;
  notes?: string;
  quoteId?: string;
  projectId?: string;
  customerId?: string;
  pdfDataUrl?: string;
  pdfFilename?: string;
  reportMarkdown?: string;
  actions?: CynthiaCardAction[];
  source?: 'phone' | 'cynthia' | 'share' | 'voice' | 'system';
  createdAt: string;
};

export type CynthiaStaffMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'card';
  content: string;
  card?: CynthiaStaffCard;
  artifact?: {
    type: 'pdf' | 'report';
    title: string;
    dataUrl?: string;
    filename?: string;
    markdown?: string;
  };
  timestamp: string;
  source?: string;
};

export type CynthiaStaffThread = {
  userId: string;
  orgId: string;
  messages: CynthiaStaffMessage[];
  updatedAt: string;
};

function headers(userId?: string): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const orgId = localStorage.getItem('tradepro_active_org_id') || localStorage.getItem('activeOrgId');
    if (orgId) h['X-Org-Id'] = orgId;
  } catch { /* ignore */ }
  if (userId) h['X-User-Id'] = userId;
  return h;
}

export async function fetchCynthiaThread(userId: string): Promise<CynthiaStaffThread> {
  const res = await fetch(`/api/cynthia/thread?userId=${encodeURIComponent(userId)}`, {
    headers: headers(userId),
  });
  if (!res.ok) return { userId, orgId: 'default', messages: [], updatedAt: new Date().toISOString() };
  const data = (await res.json()) as { thread: CynthiaStaffThread };
  return data.thread;
}

export async function postCynthiaMessage(
  userId: string,
  payload: {
    role: 'user' | 'assistant' | 'system';
    content: string;
    source?: string;
    artifact?: CynthiaStaffMessage['artifact'];
  },
): Promise<CynthiaStaffMessage | null> {
  const res = await fetch('/api/cynthia/thread', {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ userId, ...payload }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { message: CynthiaStaffMessage };
  return data.message;
}

export async function sendCynthiaCard(
  userId: string,
  card: Partial<CynthiaStaffCard> & { title: string },
): Promise<CynthiaStaffCard | null> {
  const res = await fetch('/api/cynthia/send-card', {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ userId, ...card, source: card.source || 'cynthia' }),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { card: CynthiaStaffCard };
  return data.card;
}
