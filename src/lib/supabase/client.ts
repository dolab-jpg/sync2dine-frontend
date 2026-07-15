import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

// import.meta.env only exists under Vite/Vitest — guard so Node scripts
// (e.g. scripts/verify-generic-ai.mjs via tsx) can import this module chain.
const viteEnv = (import.meta.env ?? {}) as Record<string, string | undefined>;
const url = viteEnv.VITE_SUPABASE_URL;
const anonKey = viteEnv.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient<Database> | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(url?.trim() && anonKey?.trim());
}

export function getSupabase(): SupabaseClient<Database> {
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required');
  }
  if (!client) {
    client = createClient<Database>(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}

export async function getCurrentProfile() {
  const supabase = getSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();
  return profile;
}

/**
 * Resolve org for data reads/writes.
 * platform_owner has profiles.org_id = null; when acting as (or on home org),
 * prefer localStorage activeOrgId so Supabase queries match Node X-Org-Id.
 * Never returns the legacy "bdiddies" slug — Supabase org_id columns are uuid.
 */
export async function getOrgId(): Promise<string | null> {
  const { sanitizeOrgId, getHomeOrgId } = await import('../../app/engine/platform/homeOrg');
  try {
    const active = sanitizeOrgId(localStorage.getItem('activeOrgId'));
    if (active) {
      if (localStorage.getItem('activeOrgId')?.trim() !== active) {
        localStorage.setItem('activeOrgId', active);
      }
      return active;
    }
  } catch {
    // ignore
  }
  const profile = await getCurrentProfile();
  if (profile?.org_id && sanitizeOrgId(profile.org_id)) return sanitizeOrgId(profile.org_id);
  if (profile?.role === 'platform_owner') {
    const home = getHomeOrgId();
    try {
      localStorage.setItem('activeOrgId', home);
    } catch {
      // ignore
    }
    return home;
  }
  return null;
}
