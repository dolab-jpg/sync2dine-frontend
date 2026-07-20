/**
 * Allergen helpers for restaurant phone/order tools.
 * Stub-safe: returns empty / permissive defaults when no catalog data.
 */

export type AllergenCode =
  | 'celery'
  | 'cereals_gluten'
  | 'crustaceans'
  | 'eggs'
  | 'fish'
  | 'lupin'
  | 'milk'
  | 'molluscs'
  | 'mustard'
  | 'nuts'
  | 'peanuts'
  | 'sesame'
  | 'soya'
  | 'sulphites';

export const UK_14_ALLERGENS: AllergenCode[] = [
  'celery',
  'cereals_gluten',
  'crustaceans',
  'eggs',
  'fish',
  'lupin',
  'milk',
  'molluscs',
  'mustard',
  'nuts',
  'peanuts',
  'sesame',
  'soya',
  'sulphites',
];

export function normalizeAllergen(raw: string): AllergenCode | null {
  const s = String(raw || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_');
  if ((UK_14_ALLERGENS as string[]).includes(s)) return s as AllergenCode;
  const aliases: Record<string, AllergenCode> = {
    gluten: 'cereals_gluten',
    wheat: 'cereals_gluten',
    dairy: 'milk',
    shellfish: 'crustaceans',
  };
  return aliases[s] || null;
}

export function allergensForMenuItem(_itemId: string, _orgId?: string): AllergenCode[] {
  return [];
}

export function spokenAllergenWarning(codes: AllergenCode[]): string {
  if (!codes.length) {
    return 'I do not have allergen details for that item — please ask a team member in the restaurant if you have allergies.';
  }
  return `That item may contain: ${codes.join(', ')}. If you have allergies, please confirm with the restaurant team.`;
}

/** Hint text Judie can speak when an item has allergen data. */
export function allergenSafetyHint(item: {
  name?: string;
  allergensContains?: string[] | null;
  allergensMayContain?: string[] | null;
}): string | null {
  const contains = (item.allergensContains || []).filter(Boolean);
  const may = (item.allergensMayContain || []).filter(Boolean);
  if (!contains.length && !may.length) return null;
  const bits: string[] = [];
  if (contains.length) bits.push(`contains ${contains.join(', ')}`);
  if (may.length) bits.push(`may contain ${may.join(', ')}`);
  return `${item.name || 'This item'} ${bits.join('; ')}.`;
}

/** Returns allergen codes that conflict with the customer's stated allergies. */
export function customerAllergenConflict(
  customerAllergies: string[] | null | undefined,
  itemContains: string[] | null | undefined,
): string[] {
  const cust = (customerAllergies || [])
    .map((a) => normalizeAllergen(a) || String(a).toLowerCase().trim())
    .filter(Boolean);
  const item = (itemContains || [])
    .map((a) => normalizeAllergen(a) || String(a).toLowerCase().trim())
    .filter(Boolean);
  if (!cust.length || !item.length) return [];
  return item.filter((a) => cust.includes(a));
}
