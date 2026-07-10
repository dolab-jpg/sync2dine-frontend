import type { Customer } from '../../App';
import { integrationService } from '../integrations/integrationService';
import { normalizeUkPhone } from '../messaging/whatsappProvider';
import type { WhatsAppMessage } from './cyrusChatService';

export interface ChatSummaryRecord {
  summary: string;
  generatedAt: string;
  messageCount: number;
}

const CHAT_SUMMARIES_KEY = 'chatSummaries';
export const CHAT_SUMMARY_START = '--- Chat Summary (auto) ---';
export const CHAT_SUMMARY_END = '--- End Chat Summary ---';

function loadAllSummaries(): Record<string, ChatSummaryRecord> {
  try {
    return JSON.parse(localStorage.getItem(CHAT_SUMMARIES_KEY) || '{}');
  } catch {
    return {};
  }
}

function saveAllSummaries(all: Record<string, ChatSummaryRecord>): void {
  localStorage.setItem(CHAT_SUMMARIES_KEY, JSON.stringify(all));
}

export function getCachedSummary(phone: string): ChatSummaryRecord | undefined {
  const key = normalizeUkPhone(phone);
  return loadAllSummaries()[key];
}

export function isSummaryStale(phone: string, messageCount: number): boolean {
  const cached = getCachedSummary(phone);
  if (!cached) return false;
  return cached.messageCount !== messageCount;
}

export function hasCachedSummary(phone: string): boolean {
  return Boolean(getCachedSummary(phone));
}

function cacheSummary(phone: string, record: ChatSummaryRecord): void {
  const key = normalizeUkPhone(phone);
  const all = loadAllSummaries();
  all[key] = record;
  saveAllSummaries(all);
}

export function buildCustomerNotesWithSummary(
  existingNotes: string,
  summary: string,
  generatedAt: string,
): string {
  const autoBlock = [
    CHAT_SUMMARY_START,
    `Updated: ${new Date(generatedAt).toLocaleString('en-GB')}`,
    '',
    summary,
    CHAT_SUMMARY_END,
  ].join('\n');

  const startIndex = existingNotes.indexOf(CHAT_SUMMARY_START);
  const endIndex = existingNotes.indexOf(CHAT_SUMMARY_END);

  if (startIndex !== -1 && endIndex !== -1 && endIndex > startIndex) {
    const before = existingNotes.slice(0, startIndex).trimEnd();
    const after = existingNotes.slice(endIndex + CHAT_SUMMARY_END.length).trimStart();
    return [before, autoBlock, after].filter(Boolean).join('\n\n');
  }

  if (!existingNotes.trim()) {
    return autoBlock;
  }

  return `${existingNotes.trimEnd()}\n\n${autoBlock}`;
}

export async function generateThreadSummary(
  phone: string,
  messages: WhatsAppMessage[],
  customerName?: string,
): Promise<ChatSummaryRecord> {
  if (!messages.length) {
    throw new Error('No messages to summarize');
  }

  const openaiConfig = integrationService.getConfig('openai');
  const res = await fetch('/api/ai/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp,
      })),
      customerName,
      model: openaiConfig.summaryModel || 'gpt-4o-mini',
      apiKey: openaiConfig.apiKey || undefined,
    }),
  });

  const data = await res.json() as { summary?: string; error?: string };
  if (!res.ok || !data.summary) {
    throw new Error(data.error ?? 'Failed to generate summary');
  }

  const record: ChatSummaryRecord = {
    summary: data.summary,
    generatedAt: new Date().toISOString(),
    messageCount: messages.length,
  };

  cacheSummary(phone, record);
  return record;
}

export function syncSummaryToCustomerNotes(
  customer: Customer,
  summaryRecord: ChatSummaryRecord,
  updateCustomer: (id: string, updates: Partial<Customer>) => void,
): void {
  updateCustomer(customer.id, {
    notes: buildCustomerNotesWithSummary(
      customer.notes,
      summaryRecord.summary,
      summaryRecord.generatedAt,
    ),
  });
}
