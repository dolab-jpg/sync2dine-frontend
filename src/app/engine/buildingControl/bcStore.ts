import type { ChatMessage } from '../../context/AIAssistantContext';

export interface BCCitation {
  chunkId: string;
  docTitle: string;
  section: string;
  versionDate: string;
  sourceUrl: string;
}

export interface BCInquiry {
  id: string;
  sessionId: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  role: string;
  projectId?: string;
  projectName?: string;
  tradeId?: string;
  sourceEmail?: string;
  question?: string;
  photos: string[];
  messages: ChatMessage[];
  citations: BCCitation[];
  complianceActions: string[];
  draftEmailReply?: string;
  status: 'open' | 'resolved';
}

const STORAGE_KEY = 'tradepro_bc_inquiries';
const ACTIVE_SESSION_KEY = 'tradepro_bc_active_session';

type Subscriber = (inquiries: BCInquiry[]) => void;
const subscribers = new Set<Subscriber>();

function readAll(): BCInquiry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(inquiries: BCInquiry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inquiries.slice(0, 100)));
  subscribers.forEach((fn) => fn(inquiries));
}

function notify(): void {
  subscribers.forEach((fn) => fn(readAll()));
}

export function subscribeBCInquiries(fn: Subscriber): () => void {
  subscribers.add(fn);
  return () => subscribers.delete(fn);
}

export function loadBCInquiries(): BCInquiry[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getBCInquiry(id: string): BCInquiry | undefined {
  return readAll().find((i) => i.id === id);
}

export function getBCInquiryBySession(sessionId: string): BCInquiry | undefined {
  return readAll().find((i) => i.sessionId === sessionId);
}

export function createBCInquiry(input: {
  createdBy: string;
  role: string;
  projectId?: string;
  projectName?: string;
  tradeId?: string;
  sourceEmail?: string;
  question?: string;
  photos?: string[];
}): BCInquiry {
  const now = new Date().toISOString();
  const sessionId = `bc-${Date.now()}`;
  const inquiry: BCInquiry = {
    id: `inquiry-${Date.now()}`,
    sessionId,
    createdAt: now,
    updatedAt: now,
    createdBy: input.createdBy,
    role: input.role,
    projectId: input.projectId,
    projectName: input.projectName,
    tradeId: input.tradeId,
    sourceEmail: input.sourceEmail,
    question: input.question,
    photos: input.photos ?? [],
    messages: [],
    citations: [],
    complianceActions: [],
    status: 'open',
  };

  const all = readAll();
  all.unshift(inquiry);
  writeAll(all);
  setActiveBCSession(sessionId);
  return inquiry;
}

export function updateBCInquiry(id: string, patch: Partial<BCInquiry>): BCInquiry | null {
  const all = readAll();
  const idx = all.findIndex((i) => i.id === id);
  if (idx < 0) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  writeAll(all);
  return all[idx];
}

export function resolveBCInquiry(id: string): void {
  updateBCInquiry(id, { status: 'resolved' });
  clearActiveBCSession();
}

export function setActiveBCSession(sessionId: string): void {
  localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
}

export function getActiveBCSession(): string | null {
  return localStorage.getItem(ACTIVE_SESSION_KEY);
}

export function clearActiveBCSession(): void {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
}
