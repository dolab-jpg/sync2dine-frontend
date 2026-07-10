import { getSupabase, isSupabaseConfigured, getCurrentProfile } from '../../../lib/supabase/client';

const ACTIVE_ORG_KEY = 'activeOrgId';
const AUTH_TOKEN_KEY = 'authToken';

export function getActiveOrgId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_ORG_KEY);
  } catch {
    return null;
  }
}

export function setActiveOrgId(orgId: string | null): void {
  try {
    if (orgId) localStorage.setItem(ACTIVE_ORG_KEY, orgId);
    else localStorage.removeItem(ACTIVE_ORG_KEY);
  } catch {
    // ignore
  }
}

/** @deprecated Use Supabase session — kept for transition */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/** @deprecated Use Supabase session — kept for transition */
export function setAuthToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    // ignore
  }
}

export async function getSupabaseAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured()) return getAuthToken();
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function signOut(): Promise<void> {
  setAuthToken(null);
  if (isSupabaseConfigured()) {
    const supabase = getSupabase();
    await supabase.auth.signOut();
  }
}

export function installApiFetchInterceptor(): () => void {
  const original = window.fetch.bind(window);
  const apiBase = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '');

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    let url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    // Proxy API routes to Node companion when configured
    if (apiBase && (url.startsWith('/api/') || url.startsWith('/webhooks/'))) {
      url = `${apiBase}${url}`;
      input = url;
    }

    if (url.includes('/api/') || url.includes('/webhooks/')) {
      const headers = new Headers(init?.headers);
      const orgId = getActiveOrgId();
      const token = await getSupabaseAccessToken();
      if (orgId && !headers.has('X-Org-Id')) headers.set('X-Org-Id', orgId);
      if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
      return original(input, { ...init, headers });
    }
    return original(input, init);
  };
  return () => {
    window.fetch = original;
  };
}

export async function syncActiveOrgFromProfile(): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const profile = await getCurrentProfile();
  if (profile?.org_id) setActiveOrgId(profile.org_id);
}
