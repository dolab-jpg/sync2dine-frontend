import { getSupabase, isSupabaseConfigured, getCurrentProfile, getOrgId } from '../../../lib/supabase/client';
import { getHomeOrgId, isOrgUuid, sanitizeOrgId } from './homeOrg';

const ACTIVE_ORG_KEY = 'activeOrgId';
const AUTH_TOKEN_KEY = 'authToken';

let orgResolveInFlight: Promise<string | null> | null = null;

type OrgListener = () => void;
const orgListeners = new Set<OrgListener>();

/** Subscribe to active-org changes (experience gate, API headers). */
export function subscribeActiveOrg(listener: OrgListener): () => void {
  orgListeners.add(listener);
  return () => {
    orgListeners.delete(listener);
  };
}

function notifyActiveOrgListeners(): void {
  for (const listener of orgListeners) {
    try {
      listener();
    } catch {
      // ignore subscriber errors
    }
  }
}

export function getActiveOrgId(): string | null {
  try {
    const raw = localStorage.getItem(ACTIVE_ORG_KEY);
    const sanitized = sanitizeOrgId(raw);
    if (raw && !sanitized) {
      // Clear poisoned legacy slug (e.g. "bdiddies") so Supabase stops 500ing
      localStorage.removeItem(ACTIVE_ORG_KEY);
      return null;
    }
    if (raw && sanitized && raw.trim() !== sanitized) {
      localStorage.setItem(ACTIVE_ORG_KEY, sanitized);
    }
    return sanitized;
  } catch {
    return null;
  }
}

export function setActiveOrgId(orgId: string | null): void {
  try {
    const prev = getActiveOrgId();
    const sanitized = sanitizeOrgId(orgId);
    if (sanitized) localStorage.setItem(ACTIVE_ORG_KEY, sanitized);
    else localStorage.removeItem(ACTIVE_ORG_KEY);
    if (prev !== sanitized) notifyActiveOrgListeners();
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

/** Resolve and cache org id from profile when localStorage is empty. */
export async function ensureActiveOrgId(): Promise<string | null> {
  const existing = getActiveOrgId();
  if (existing) return existing;
  if (!orgResolveInFlight) {
    orgResolveInFlight = (async () => {
      try {
        if (isSupabaseConfigured()) {
          const profile = await getCurrentProfile();
          if (isOrgUuid(profile?.org_id)) {
            setActiveOrgId(profile!.org_id as string);
            return profile!.org_id as string;
          }
          // platform_owner with no home membership → configured home org uuid
          if (profile?.role === 'platform_owner') {
            const home = getHomeOrgId();
            setActiveOrgId(home);
            return home;
          }
        }
        const orgId = await getOrgId();
        const sanitized = sanitizeOrgId(orgId);
        if (sanitized) setActiveOrgId(sanitized);
        return sanitized;
      } catch {
        return null;
      } finally {
        orgResolveInFlight = null;
      }
    })();
  }
  return orgResolveInFlight;
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
      let orgId = getActiveOrgId();
      if (!orgId && !headers.has('X-Org-Id')) {
        orgId = await ensureActiveOrgId();
      }
      if (!orgId) {
        orgId = getHomeOrgId();
      }
      const token = await getSupabaseAccessToken();
      if (!headers.has('X-Org-Id') && isOrgUuid(orgId)) headers.set('X-Org-Id', orgId);
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
  // Always scrub a poisoned legacy value first
  getActiveOrgId();
  const profile = await getCurrentProfile();
  if (isOrgUuid(profile?.org_id)) {
    setActiveOrgId(profile!.org_id as string);
    return;
  }
  // platform_owner: keep existing acting-as if set; otherwise seed home uuid
  if (profile?.role === 'platform_owner' && !getActiveOrgId()) {
    setActiveOrgId(getHomeOrgId());
  }
}
