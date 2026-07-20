import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getOrganizationById } from './organizations';
import { getHomeOrgId } from './home-org';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), 'data');
const USAGE_FILE = join(DATA_DIR, 'usage-events.json');

export function normalizeUsageOrgId(orgId: string | null | undefined): string {
  const raw = (orgId || '').trim();
  if (!raw || raw === 'default') return getHomeOrgId() || 'default';
  return raw;
}

export type UsageProvider =
  | 'openai'
  | 'deepseek'
  | 'elevenlabs'
  | 'phone'
  | 'ai_minutes'
  | 'soho66'
  | string;

export type UsageUnit = 'tokens' | 'characters' | 'seconds' | 'messages' | string;

export interface UsageEvent {
  id: string;
  orgId: string;
  userId?: string;
  endpoint: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number;
  createdAt: string;
  provider?: UsageProvider;
  unit?: UsageUnit;
  quantity?: number;
  metadata?: Record<string, unknown>;
}

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
  'deepseek-v4-flash': { input: 0.14, output: 0.28 },
  'deepseek-v4-pro': { input: 0.435, output: 0.87 },
  'deepseek-chat': { input: 0.14, output: 0.28 },
  'deepseek-reasoner': { input: 0.55, output: 2.19 },
  'tts-1': { input: 15, output: 0 },
  'whisper-1': { input: 0.006, output: 0 },
};

let memoryEvents: UsageEvent[] = [];

function ensureDir() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function loadFromDisk(): UsageEvent[] {
  try {
    if (existsSync(USAGE_FILE)) {
      const parsed = JSON.parse(readFileSync(USAGE_FILE, 'utf-8'));
      return Array.isArray(parsed) ? (parsed as UsageEvent[]) : [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function persist() {
  ensureDir();
  try {
    writeFileSync(USAGE_FILE, JSON.stringify(memoryEvents, null, 2));
  } catch {
    /* ignore */
  }
}

function allEvents(): UsageEvent[] {
  if (memoryEvents.length === 0) memoryEvents = loadFromDisk();
  return memoryEvents;
}

/** Monday 00:00 UTC of the current week — Sync2Dine fares reset weekly. */
export function startOfBillingWeek(now = Date.now()): number {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 Sun .. 6 Sat
  const daysFromMonday = (day + 6) % 7;
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  d.setUTCHours(0, 0, 0, 0);
  return d.getTime();
}

export function currentBillingWeekKey(now = Date.now()): string {
  return new Date(startOfBillingWeek(now)).toISOString().slice(0, 10);
}

/** Prefer org Stripe period when currentPeriodEnd is set; else UTC week. */
export function usagePeriodStartMs(orgId?: string | null): number {
  if (orgId) {
    try {
      const org = getOrganizationById(normalizeUsageOrgId(orgId));
      const end = org?.currentPeriodEnd ? Date.parse(org.currentPeriodEnd) : NaN;
      if (Number.isFinite(end) && end > Date.now()) {
        // Assume weekly subscription: period is ~7 days ending at currentPeriodEnd
        const start = end - 7 * 24 * 60 * 60 * 1000;
        if (start < Date.now()) return start;
      }
    } catch {
      /* ignore */
    }
  }
  return startOfBillingWeek();
}

export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  const pricing = MODEL_PRICING[model] ?? MODEL_PRICING['gpt-4o-mini'];
  const inputCost = (promptTokens / 1_000_000) * pricing.input;
  const outputCost = (completionTokens / 1_000_000) * pricing.output;
  return Math.round((inputCost + outputCost) * 1_000_000) / 1_000_000;
}

/** Infer metering provider from model id (DeepSeek primary vs OpenAI specialist). */
export function providerFromModel(model: string): UsageProvider {
  const m = (model || '').toLowerCase();
  if (m.startsWith('deepseek')) return 'deepseek';
  if (m.startsWith('eleven') || m.includes('elevenlabs')) return 'elevenlabs';
  return 'openai';
}

export function recordUsage(
  orgId: string,
  endpoint: string,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number },
  userId?: string,
): UsageEvent {
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const totalTokens = usage.total_tokens ?? promptTokens + completionTokens;
  const event: UsageEvent = {
    id: `use_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    orgId: normalizeUsageOrgId(orgId),
    userId,
    endpoint,
    model,
    promptTokens,
    completionTokens,
    totalTokens,
    costUsd: estimateCostUsd(model, promptTokens, completionTokens),
    createdAt: new Date().toISOString(),
    provider: providerFromModel(model),
    unit: 'tokens',
    quantity: totalTokens,
  };
  memoryEvents = [event, ...allEvents()];
  persist();
  return event;
}

export function recordProviderUsage(input: {
  orgId: string;
  provider: UsageProvider;
  unit: UsageUnit;
  quantity: number;
  endpoint: string;
  model?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
  costUsd?: number;
}): UsageEvent {
  const quantity = Math.max(0, Number(input.quantity) || 0);
  const event: UsageEvent = {
    id: `use_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    orgId: normalizeUsageOrgId(input.orgId),
    userId: input.userId,
    endpoint: input.endpoint,
    model: input.model ?? String(input.provider),
    promptTokens: input.unit === 'tokens' ? quantity : 0,
    completionTokens: 0,
    totalTokens: input.unit === 'tokens' ? quantity : 0,
    costUsd: input.costUsd ?? 0,
    createdAt: new Date().toISOString(),
    provider: input.provider,
    unit: input.unit,
    quantity,
    metadata: input.metadata,
  };
  memoryEvents = [event, ...allEvents()];
  persist();
  return event;
}

export function getProviderEventsThisMonth(orgId: string, provider: UsageProvider): UsageEvent[] {
  const periodStart = usagePeriodStartMs(orgId);
  const oid = normalizeUsageOrgId(orgId);
  return allEvents().filter(
    (e) =>
      e.orgId === oid &&
      e.provider === provider &&
      new Date(e.createdAt).getTime() >= periodStart,
  );
}

export function getProviderQuantityThisMonth(orgId: string, provider: UsageProvider): number {
  return getProviderEventsThisMonth(orgId, provider).reduce(
    (sum, e) => sum + Number(e.quantity ?? e.totalTokens ?? 0),
    0,
  );
}

export function getTokensUsedThisMonth(orgId: string): number {
  const periodStart = usagePeriodStartMs(orgId);
  const oid = normalizeUsageOrgId(orgId);
  return allEvents()
    .filter(
      (e) =>
        e.orgId === oid &&
        new Date(e.createdAt).getTime() >= periodStart &&
        (!e.provider || e.provider === 'openai' || e.provider === 'deepseek') &&
        (!e.unit || e.unit === 'tokens'),
    )
    .reduce((sum, e) => sum + e.totalTokens, 0);
}

export function getTokenCostUsdThisMonth(orgId: string): number {
  const periodStart = usagePeriodStartMs(orgId);
  const oid = normalizeUsageOrgId(orgId);
  return allEvents()
    .filter(
      (e) =>
        e.orgId === oid &&
        new Date(e.createdAt).getTime() >= periodStart &&
        (!e.provider || e.provider === 'openai' || e.provider === 'deepseek') &&
        (!e.unit || e.unit === 'tokens'),
    )
    .reduce((sum, e) => sum + e.costUsd, 0);
}

export function getUsageSummaryForOrg(orgId: string) {
  const periodStart = usagePeriodStartMs(orgId);
  const oid = normalizeUsageOrgId(orgId);
  const events = allEvents().filter(
    (e) => e.orgId === oid && new Date(e.createdAt).getTime() >= periodStart,
  );
  const tokenEvents = events.filter(
    (e) => !e.provider || e.provider === 'openai' || e.provider === 'deepseek',
  );
  return {
    tokensUsed: tokenEvents.reduce((s, e) => s + e.totalTokens, 0),
    costUsd: events.reduce((s, e) => s + e.costUsd, 0),
    requestCount: events.length,
    periodWeek: currentBillingWeekKey(),
    periodStart: new Date(periodStart).toISOString(),
    byEndpoint: events.reduce<Record<string, number>>((acc, e) => {
      acc[e.endpoint] = (acc[e.endpoint] ?? 0) + Number(e.quantity ?? e.totalTokens ?? 0);
      return acc;
    }, {}),
    aiMinutesSeconds: getProviderQuantityThisMonth(orgId, 'ai_minutes'),
    phoneOutboundSeconds: getProviderQuantityThisMonth(orgId, 'phone'),
  };
}

export function getGlobalUsageThisMonth(): number {
  const periodStart = startOfBillingWeek();
  return allEvents()
    .filter(
      (e) =>
        new Date(e.createdAt).getTime() >= periodStart &&
        (!e.provider || e.provider === 'openai' || e.provider === 'deepseek'),
    )
    .reduce((sum, e) => sum + e.totalTokens, 0);
}

export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

export function assertWithinQuota(orgId: string): void {
  const org = getOrganizationById(orgId);
  if (!org) return;
  if (org.status === 'suspended' || org.status === 'cancelled') {
    throw new QuotaExceededError(`Organization "${org.name}" is ${org.status}. AI access is disabled.`);
  }
}

export function getTokenQuotaWarning(orgId: string): string | null {
  const org = getOrganizationById(orgId);
  if (!org) return null;
  const used = getTokensUsedThisMonth(orgId);
  if (used >= org.monthlyTokenCap) {
    return `Token allowance exceeded for "${org.name}" (${used.toLocaleString()} / ${org.monthlyTokenCap.toLocaleString()}). Overage will appear on this week's invoice.`;
  }
  if (used >= org.monthlyTokenCap * 0.8) {
    return `Token allowance at ${Math.round((used / org.monthlyTokenCap) * 100)}% for "${org.name}".`;
  }
  return null;
}
