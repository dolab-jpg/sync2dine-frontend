/** Canonical home tenant branding for platform_owner (Sync2Dine). */

const ORG_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Legacy slug used in early file-based org store — NOT a Postgres uuid. */
export const BDIDDIES_HOME_ORG_LEGACY_ID = 'sync2dine';

/**
 * Real Supabase org id for Sync2Dine / home tenant.
 * Prefer VITE_HOME_ORG_ID when set; fall back to the seeded demo org uuid.
 */
const FALLBACK_HOME_ORG_UUID = '4fc49703-d1b0-4ac7-892d-9c32d31e9661';

export function isOrgUuid(id: string | null | undefined): id is string {
  return Boolean(id && ORG_UUID_RE.test(id.trim()));
}

/** @deprecated Use getHomeOrgId() — kept so old imports compile; never a non-uuid. */
export const BDIDDIES_HOME_ORG_ID = (() => {
  const fromEnv = (typeof import.meta !== 'undefined'
    ? (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_HOME_ORG_ID
    : undefined)?.trim();
  return isOrgUuid(fromEnv) ? fromEnv : FALLBACK_HOME_ORG_UUID;
})();

export function getHomeOrgId(): string {
  const fromEnv = (typeof import.meta !== 'undefined'
    ? (import.meta as ImportMeta & { env?: Record<string, string> }).env?.VITE_HOME_ORG_ID
    : undefined)?.trim();
  if (isOrgUuid(fromEnv)) return fromEnv;
  return FALLBACK_HOME_ORG_UUID;
}

export function sanitizeOrgId(id: string | null | undefined): string | null {
  if (!id) return null;
  const trimmed = id.trim();
  if (trimmed === BDIDDIES_HOME_ORG_LEGACY_ID || trimmed === 'bdiddies') return getHomeOrgId();
  if (isOrgUuid(trimmed)) return trimmed;
  return null;
}

export const BDIDDIES_COMPANY = {
  companyName: 'Sync2Dine',
  website: 'https://sync2dine.io',
  email: 'info@sync2dine.io',
  phone: '020 3745 3233',
  address: '',
} as const;
