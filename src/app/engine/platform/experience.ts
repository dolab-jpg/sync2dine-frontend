/**
 * Sync2Dine experience gate (Super Master B2/B3).
 *
 * - `sales`      — Sync2Dine's own IT/sales org: platform_owner + home-org staff
 *                  (CRM, Platform Clients, Call Centre, Team, Recruitment…)
 * - `restaurant` — tenant restaurant staff on the tablet (Kitchen/Till/Delivery,
 *                  live calls, Menu, Settings)
 * - `kiosk`      — dedicated diner kiosk login → /front
 *
 * Decision is org-based (home org uuid vs tenant org uuid), NOT the legacy
 * `localStorage.sync2dine_mode` flag which had no setter.
 */
import { getHomeOrgId } from './homeOrg';
import { getActiveOrgId } from './orgContext';

export type Experience = 'sales' | 'restaurant' | 'kiosk';

export function getExperience(role: string): Experience {
  if (role === 'kiosk') return 'kiosk';
  // Platform owner is always Sync2Dine sales staff, even when acting-as a tenant.
  if (role === 'platform_owner') return 'sales';
  const orgId = getActiveOrgId();
  if (orgId && orgId !== getHomeOrgId()) return 'restaurant';
  return 'sales';
}
