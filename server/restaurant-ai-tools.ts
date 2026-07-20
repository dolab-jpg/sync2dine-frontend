/**
 * Restaurant-only phone tools (menu admin, order status) — org-scoped.
 * Food-order tools (getMenu, placeFoodOrder, bookings) live in phone-tools.ts.
 */
import { getRequestOrgId } from './data-store';
import { getOrganizationById } from './organizations';
import { sanitizeOrgId } from './home-org';
import { listMenuItemsForOrg } from './menu-catalog';
import type { OrchestratorRequest } from './orchestrator-types';

export const RESTAURANT_TOOL_NAMES = new Set([
  'upsertMenuItem',
  'deleteMenuItem',
  'listOrders',
  'markOrderPaid',
  'updateOrderStatus',
]);

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return undefined;
}

function resolveOrg(body: OrchestratorRequest): string | null {
  const orgId = sanitizeOrgId(firstString(body.orgId) ?? getRequestOrgId());
  if (!orgId) return null;
  if (!getOrganizationById(orgId)) return null;
  return orgId;
}

export async function executeRestaurantTool(
  name: string,
  input: Record<string, unknown>,
  body: OrchestratorRequest,
): Promise<Record<string, unknown>> {
  const orgId = resolveOrg(body);
  if (!orgId) {
    return {
      ok: false,
      error: 'org_not_found',
      spokenHint: 'I cannot reach the restaurant system right now — shall I transfer you to the team?',
    };
  }

  if (name === 'listOrders') {
    return {
      ok: true,
      orders: [],
      spokenHint: 'Order lookup from the phone is not wired yet — the kitchen screen has live orders.',
    };
  }

  if (name === 'upsertMenuItem' || name === 'deleteMenuItem') {
    const menu = await listMenuItemsForOrg(orgId);
    if (!menu.length && name === 'upsertMenuItem') {
      return {
        ok: false,
        error: 'menu_empty',
        spokenHint: 'The menu is empty — add dishes in the Menu tab, or I can transfer you to the team.',
      };
    }
    return {
      ok: false,
      error: 'not_implemented',
      spokenHint: 'Menu edits need the Menu tab in the app — I can take your order or transfer you.',
    };
  }

  if (name === 'markOrderPaid' || name === 'updateOrderStatus') {
    return {
      ok: false,
      error: 'not_implemented',
      spokenHint: 'Order updates happen on the kitchen till — want me to transfer you?',
    };
  }

  return { ok: false, error: `unknown_restaurant_tool:${name}` };
}
