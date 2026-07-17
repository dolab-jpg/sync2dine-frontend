import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase/client';
import { getSupabaseAccessToken } from './orgContext';

export type OrgStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type OrgPlan = 'starter' | 'pro' | 'enterprise' | 'sync2dine_platform' | 'sync2dine_kiosk';

export interface PlatformOrganization {
  id: string;
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  status: OrgStatus;
  plan: OrgPlan;
  openaiApiKeyEncrypted: string;
  monthlyTokenCap: number;
  tokensUsedThisMonth: number;
  usageCostUsd?: number;
  monthlyPriceGbp: number;
  planLabel: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  createdAt: string;
  updatedAt: string;
  notes?: string;
}

export interface PlatformStats {
  total: number;
  active: number;
  trialing: number;
  pastDue: number;
  suspended: number;
  mrr: number;
  tokensThisMonth: number;
}

export interface CreateOrganizationResult {
  organization: PlatformOrganization;
  mainUserEmail?: string;
  mainUserCreated?: boolean;
  /** Public diner ordering URL — no Auth account. */
  kioskUrl?: string;
  stripeCheckoutUrl?: string;
  stripeWarning?: string;
}

export const PLAN_LABELS: Record<OrgPlan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
  sync2dine_platform: 'Sync2Dine Platform',
  sync2dine_kiosk: 'Sync2Dine Kiosk Screen',
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

function supabaseFunctionsBase(): string | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  if (!url || !isSupabaseConfigured()) return null;
  return `${url.replace(/\/$/, '')}/functions/v1/platform-orgs`;
}

/** Edge uses '' | /stats | /:id ; Node uses /api/platform/... */
async function callPlatform<T>(
  edgePath: string,
  nodePath: string,
  init?: RequestInit,
): Promise<T> {
  const edgeBase = supabaseFunctionsBase();
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type') && init?.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (edgeBase) {
    const token = await getSupabaseAccessToken();
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    if (anon) headers.set('apikey', anon);
    const edgeRes = await fetch(`${edgeBase}${edgePath}`, { ...init, headers });
    if (edgeRes.status !== 404 && edgeRes.status !== 502 && edgeRes.status !== 503) {
      return parseJson<T>(edgeRes);
    }
  }

  return parseJson<T>(await fetch(nodePath, { ...init, headers }));
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  const data = await callPlatform<PlatformStats & { orgCount?: number; activeOrgs?: number }>(
    '/stats',
    '/api/platform/stats',
  );
  return {
    total: data.total ?? data.orgCount ?? 0,
    active: data.active ?? data.activeOrgs ?? 0,
    trialing: data.trialing ?? 0,
    pastDue: data.pastDue ?? 0,
    suspended: data.suspended ?? 0,
    mrr: data.mrr ?? 0,
    tokensThisMonth: data.tokensThisMonth ?? 0,
  };
}

export async function fetchOrganizations(): Promise<PlatformOrganization[]> {
  const data = await callPlatform<{ organizations: PlatformOrganization[] }>(
    '',
    '/api/platform/organizations',
  );
  return data.organizations;
}

export async function createOrganization(input: {
  name: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  address?: string;
  plan: OrgPlan;
  status?: OrgStatus;
  openaiApiKey?: string;
  monthlyTokenCap?: number;
  notes?: string;
  adminPassword?: string;
  createStripeSubscription?: boolean;
  sendInviteEmail?: boolean;
}): Promise<CreateOrganizationResult> {
  return callPlatform<CreateOrganizationResult>(
    '',
    '/api/platform/organizations',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );
}

export async function updateOrganization(
  id: string,
  patch: Partial<PlatformOrganization> & { openaiApiKey?: string },
): Promise<PlatformOrganization> {
  const data = await callPlatform<{ organization: PlatformOrganization }>(
    `/${encodeURIComponent(id)}`,
    `/api/platform/organizations/${encodeURIComponent(id)}`,
    {
      method: 'PATCH',
      body: JSON.stringify(patch),
    },
  );
  return data.organization;
}

export async function deleteOrganization(id: string): Promise<void> {
  await callPlatform(
    `/${encodeURIComponent(id)}`,
    `/api/platform/organizations/${encodeURIComponent(id)}`,
    { method: 'DELETE' },
  );
}

export async function createStripeCheckout(orgId: string): Promise<string> {
  // Stripe checkout remains on Node companion.
  const data = await parseJson<{ url: string }>(
    await fetch(`/api/platform/organizations/${encodeURIComponent(orgId)}/stripe-checkout`, {
      method: 'POST',
    }),
  );
  return data.url;
}

export function tokenUsageColor(used: number, cap: number): string {
  if (cap <= 0) return 'bg-gray-400';
  const pct = used / cap;
  if (pct >= 0.9) return 'bg-red-500';
  if (pct >= 0.7) return 'bg-yellow-500';
  return 'bg-green-500';
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}k`;
  return String(n);
}

/** Warm Supabase client so session exists before platform calls. */
export async function ensurePlatformSession(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = getSupabase();
  await supabase.auth.getSession();
}
