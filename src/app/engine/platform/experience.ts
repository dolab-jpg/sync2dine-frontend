/**
 * Sync2Dine experience gate (Super Master B2/B3).
 *
 * - `sales`      — Sync2Dine's own IT/sales org: platform_owner on home org
 *                  (CRM, Platform Clients, Call Centre, Team, Recruitment…)
 * - `restaurant` — tenant restaurant staff on the tablet (Kitchen/Till/Delivery,
 *                  live calls, Menu, Settings); also platform_owner when
 *                  acting-as a non-home client org
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

export function getExperience(role: string): Experience {
  // Recruitment tools live in the sales shell.
  if (role === 'recruitment') return 'sales';

  const orgId = getActiveOrgId();
  const homeOrgId = getHomeOrgId();

  // platform_owner: sales shell on home / cleared; restaurant tablet when acting-as a tenant.
  // Note: App.tsx forces sales/AppShell when path starts with /platform so Ops/Clients
  // never render inside RestaurantShell (which has no /platform/* routes).
  if (role === 'platform_owner') {
    if (orgId && orgId !== homeOrgId) return 'restaurant';
    return 'sales';
  }

  // No org yet, or home (Sync2Dine sales) org → sales shell (API hub, CRM, etc.).
  if (!orgId || orgId === homeOrgId) {
    return 'sales';
  }

  // Tenant org + restaurant roles → tablet shell.
  return RESTAURANT_ROLES.has(role) ? 'restaurant' : 'restaurant';
}
