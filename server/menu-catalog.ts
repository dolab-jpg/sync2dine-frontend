/**
 * Restaurant menu catalog — loads org-scoped dishes for Judie getMenu / placeFoodOrder.
 * Returns an empty array when Supabase/local data has no food items (fail gracefully).
 */
import { createClient } from '@supabase/supabase-js';
import { sanitizeOrgId } from './home-org';

export type OrderLineInput = {
  name?: string;
  itemId?: string;
  qty?: number;
  quantity?: number;
  price?: number;
  notes?: string;
  dealName?: string;
  dealIndex?: number;
  role?: string;
  dealChoices?: Array<Record<string, string>>;
  [key: string]: unknown;
};

export type MenuDealRole = {
  role: string;
  qtyPerDeal: number;
  choices: string[];
};

export type MenuCatalogItem = {
  id: string;
  name: string;
  category?: string;
  price?: number;
  description?: string;
  deal?: { roles: MenuDealRole[] };
  allergensContains?: string[];
  allergensMayContain?: string[];
  dietary?: string[];
  allergenNotes?: string;
  allergenDeclared?: boolean;
  [key: string]: unknown;
};

const FOOD_CATEGORIES = new Set([
  'starters',
  'mains',
  'sides',
  'drinks',
  'desserts',
  'specials',
  'other',
]);

type ExpandResult =
  | { ok: true; items: OrderLineInput[] }
  | { ok: false; error: string; spokenHint: string };

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function loadProductsForOrg(orgId: string): Promise<Array<Record<string, unknown>>> {
  const client = supabaseAdmin();
  if (!client) return [];
  const { data, error } = await client.from('products').select('id, data').eq('org_id', orgId);
  if (error || !data?.length) return [];
  return data.map((row) => ({
    id: String(row.id),
    ...((row.data && typeof row.data === 'object' ? row.data : {}) as Record<string, unknown>),
  }));
}

function mapRowToMenuItem(row: Record<string, unknown>): MenuCatalogItem | null {
  const name = String(row.name ?? '').trim();
  if (!name) return null;
  if (row.available === false) return null;

  const category = String(row.category ?? 'other').toLowerCase();
  const hasFoodShape = FOOD_CATEGORIES.has(category)
    || row.description != null
    || row.price != null
    || row.deal != null;
  if (!hasFoodShape) return null;

  const priceRaw = row.price ?? row.sellPrice ?? row.basePrice;
  const price = priceRaw != null ? Number(priceRaw) : undefined;

  const deal = row.deal && typeof row.deal === 'object'
    ? (row.deal as MenuCatalogItem['deal'])
    : undefined;

  return {
    id: String(row.id ?? name),
    name,
    category,
    ...(Number.isFinite(price) ? { price } : {}),
    ...(row.description ? { description: String(row.description) } : {}),
    ...(deal ? { deal } : {}),
    ...(Array.isArray(row.allergensContains) ? { allergensContains: row.allergensContains as string[] } : {}),
    ...(Array.isArray(row.allergensMayContain) ? { allergensMayContain: row.allergensMayContain as string[] } : {}),
    ...(Array.isArray(row.dietary) ? { dietary: row.dietary as string[] } : {}),
    ...(row.allergenNotes ? { allergenNotes: String(row.allergenNotes) } : {}),
    ...(row.allergenDeclared === true ? { allergenDeclared: true } : {}),
  };
}

/** Menu rows for an org — Supabase products table; empty array when none configured. */
export async function listMenuItemsForOrg(
  orgId?: string | null,
  category?: string,
): Promise<MenuCatalogItem[]> {
  const resolved = sanitizeOrgId(orgId ?? null);
  if (!resolved) return [];

  const rows = await loadProductsForOrg(resolved);
  let items = rows.map(mapRowToMenuItem).filter(Boolean) as MenuCatalogItem[];

  const catFilter = category?.trim().toLowerCase();
  if (catFilter) {
    items = items.filter((item) => String(item.category ?? '').toLowerCase() === catFilter);
  }

  return items.sort((a, b) => {
    const ca = String(a.category ?? '');
    const cb = String(b.category ?? '');
    if (ca !== cb) return ca.localeCompare(cb);
    return a.name.localeCompare(b.name);
  });
}

/** Expand meal-deal lines into kitchen component rows; pass-through when no deal metadata. */
export function expandMealDealOrderItems(
  lines: OrderLineInput[],
  catalog: MenuCatalogItem[],
): ExpandResult {
  if (!Array.isArray(lines) || !lines.length) {
    return { ok: false, error: 'no_items', spokenHint: 'What would you like to order?' };
  }

  const expanded: OrderLineInput[] = [];

  for (const line of lines) {
    const name = String(line.name ?? '').trim();
    if (!name) continue;
    const qty = Math.max(1, Number(line.qty ?? line.quantity ?? 1) || 1);
    const match = catalog.find((c) => c.name.toLowerCase() === name.toLowerCase());

    if (!match?.deal) {
      expanded.push({ ...line, name, qty, price: line.price ?? match?.price });
      continue;
    }

    const choicesList = Array.isArray(line.dealChoices) ? line.dealChoices : [];
    if (choicesList.length < qty) {
      return {
        ok: false,
        error: 'deal_choices_required',
        spokenHint: `For ${name}, I need your choices for each deal — main, side, and drink.`,
      };
    }

    for (let i = 0; i < qty; i += 1) {
      const unitChoices = choicesList[i] ?? {};
      for (const roleDef of match.deal.roles) {
        const roleKey = roleDef.role.toLowerCase();
        const chosen = unitChoices[roleKey] || unitChoices[roleDef.role];
        if (!chosen?.trim()) {
          return {
            ok: false,
            error: 'deal_choice_missing',
            spokenHint: `Which ${roleDef.role} would you like for deal ${i + 1} of ${name}?`,
          };
        }
        expanded.push({
          name: chosen.trim(),
          qty: roleDef.qtyPerDeal,
          price: 0,
          dealName: name,
          dealIndex: i + 1,
          role: roleDef.role,
        });
      }
    }
  }

  if (!expanded.length) {
    return { ok: false, error: 'no_items', spokenHint: 'I did not catch any items — what can I get you?' };
  }

  return { ok: true, items: expanded };
}
