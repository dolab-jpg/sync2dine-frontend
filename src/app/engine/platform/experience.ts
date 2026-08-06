/**
 * Sync2Dine experience gate (Super Master B2/B3).
 *
 * - `sales`      — Sync2Dine's own IT/sales org. platform_owner ALWAYS lives here
 *                  (CRM, Platform Clients, Call Centre, Team, Recruitment…), even
 *                  when acting-as a client — acting-as only scopes data (X-Org-Id),
 *                  it never reroutes the UI into the restaurant tablet.
 * - `restaurant` — tenant restaurant staff on the tablet (Kitchen/Till/Delivery,
 *                  live calls, Menu, Settings). platform_owner can only land here
 *                  via an explicit, session-scoped tablet preview
 *                  (Platform Clients → "View restaurant tablet").
 *
 * Diner ordering is public `/front?org=` (no login) — not an experience gate.
 *
 * Decision is org-based (home org uuid vs tenant org uuid), NOT the legacy
 * `localStorage.sync2dine_mode` flag which had no setter.
 */
import { getHomeOrgId } from './homeOrg';
import { getActiveOrgId } from './orgContext';

export type Experience = 'sales' | 'restaurant';

const RESTAURANT_ROLES = new Set(['super_admin', 'manager', 'staff', 'builder']);

/**
 * Session-scoped flag (sessionStorage): set only when a platform_owner explicitly
 * opens a client's restaurant tablet preview. Clears automatically when the tab
 * closes, and is cleared by Act-as / picker changes / logout.
 */
const TABLET_PREVIEW_KEY = 's2d_tablet_preview';

export function isTabletPreviewActive(): boolean {
  try {
    return sessionStorage.getItem(TABLET_PREVIEW_KEY) === '1';
  } catch {
    return false;
  }
}

export function setTabletPreview(active: boolean): void {
  try {
    if (active) sessionStorage.setItem(TABLET_PREVIEW_KEY, '1');
    else sessionStorage.removeItem(TABLET_PREVIEW_KEY);
  } catch {
    // ignore
  }
}

export function getExperience(role: string): Experience {
  // Recruitment tools live in the sales shell.
  if (role === 'recruitment') return 'sales';

  const orgId = getActiveOrgId();
  const homeOrgId = getHomeOrgId();

  // platform_owner is an IT company, not a restaurant: always the sales shell.
  // The restaurant tablet is reachable only through the explicit preview flag.
  // App.tsx additionally forces sales/AppShell on /platform/* paths as a guard.
  if (role === 'platform_owner') {
    if (isTabletPreviewActive() && orgId && orgId !== homeOrgId) return 'restaurant';
    return 'sales';
  }

  // No org yet, or home (Sync2Dine sales) org → sales shell (API hub, CRM, etc.).
  if (!orgId || orgId === homeOrgId) {
    return 'sales';
  }

  // Tenant org + restaurant roles → tablet shell.
  return RESTAURANT_ROLES.has(role) ? 'restaurant' : 'restaurant';
}
