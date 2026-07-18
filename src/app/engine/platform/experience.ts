/**
 * Sync2Dine experience gate (Super Master B2/B3).
 *
 * - `sales`      — Sync2Dine's own IT/sales org: platform_owner + home-org staff
 *                  (CRM, Platform Clients, Call Centre, Team, Recruitment…)
 * - `restaurant` — tenant restaurant staff on the tablet (Kitchen/Till/Delivery,
 *                  live calls, Menu, Settings)
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
  // platform_owner is always Sync2Dine sales staff, even when acting-as a tenant.
  if (role === 'platform_owner') return 'sales';
  // Recruitment tools live in the sales shell.
  if (role === 'recruitment') return 'sales';

  const orgId = getActiveOrgId();
  const homeOrgId = getHomeOrgId();

  // No org yet, or home (Sync2Dine sales) org → sales shell (API hub, CRM, etc.).
  if (!orgId || orgId === homeOrgId) {
    // #region agent log
    fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'73adb0'},body:JSON.stringify({sessionId:'73adb0',runId:'pre-deploy',hypothesisId:'H2',location:'experience.ts:getExperience',message:'sales experience (home or no org)',data:{role,orgId,homeOrgId,result:'sales'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return 'sales';
  }

  // Tenant org + restaurant roles → tablet shell.
  const result = RESTAURANT_ROLES.has(role) ? 'restaurant' : 'restaurant';
  // #region agent log
  fetch('http://127.0.0.1:7756/ingest/45011e36-ac12-4dbc-b7c1-e1827334fcf5',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'73adb0'},body:JSON.stringify({sessionId:'73adb0',runId:'pre-deploy',hypothesisId:'H2',location:'experience.ts:getExperience',message:'tenant experience',data:{role,orgId,homeOrgId,result},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return result;
}
