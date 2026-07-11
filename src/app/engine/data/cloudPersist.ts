import { isSupabaseConfigured } from '../../../lib/supabase/client';

/** When Supabase is configured, business data must not use localStorage. */
export function useCloudPersistence(): boolean {
  return isSupabaseConfigured();
}

export function readLocalJson<T>(key: string, fallback: T): T {
  if (useCloudPersistence()) return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    // ignore
  }
  return fallback;
}

export function writeLocalJson(key: string, value: unknown): void {
  if (useCloudPersistence()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}
