export type OrgStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type OrgPlan = 'starter' | 'pro' | 'enterprise';

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

export const PLAN_LABELS: Record<OrgPlan, string> = {
  starter: 'Starter',
  pro: 'Pro',
  enterprise: 'Enterprise',
};

async function parseJson<T>(res: Response): Promise<T> {
  const data = await res.json();
  if (!res.ok) throw new Error((data as { error?: string }).error ?? res.statusText);
  return data as T;
}

export async function fetchPlatformStats(): Promise<PlatformStats> {
  return parseJson(await fetch('/api/platform/stats'));
}

export async function fetchOrganizations(): Promise<PlatformOrganization[]> {
  const data = await parseJson<{ organizations: PlatformOrganization[] }>(
    await fetch('/api/platform/organizations'),
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
}): Promise<PlatformOrganization> {
  const data = await parseJson<{ organization: PlatformOrganization }>(
    await fetch('/api/platform/organizations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }),
  );
  return data.organization;
}

export async function updateOrganization(
  id: string,
  patch: Partial<PlatformOrganization> & { openaiApiKey?: string },
): Promise<PlatformOrganization> {
  const data = await parseJson<{ organization: PlatformOrganization }>(
    await fetch(`/api/platform/organizations/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  );
  return data.organization;
}

export async function deleteOrganization(id: string): Promise<void> {
  await parseJson(await fetch(`/api/platform/organizations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }));
}

export async function createStripeCheckout(orgId: string): Promise<string> {
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
