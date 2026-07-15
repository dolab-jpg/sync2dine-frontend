import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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
 */
export async function getOrgId(): Promise<string | null> {
  try {
    const active = localStorage.getItem('activeOrgId')?.trim();
    if (active) return active;
  } catch {
    // ignore
  }
  const profile = await getCurrentProfile();
  if (profile?.org_id) return profile.org_id;
  // platform_owner with no acting-as → B-Diddies home
  if (profile?.role === 'platform_owner') {
    try {
      localStorage.setItem('activeOrgId', 'bdiddies');
    } catch {
      // ignore
    }
    return 'bdiddies';
  }
  return null;
}
