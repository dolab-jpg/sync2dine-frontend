/**
 * UK FIC Annex II — 14 allergens (frontend mirror of backend allergens.ts).
 */

export const UK_ALLERGEN_CODES = [
  'celery',
  'gluten',
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
] as const;

export type AllergenCode = (typeof UK_ALLERGEN_CODES)[number];

export const DIETARY_CODES = ['vegetarian', 'vegan', 'halal', 'gluten_free'] as const;
export type DietaryCode = (typeof DIETARY_CODES)[number];

export const ALLERGEN_LABELS: Record<AllergenCode, string> = {
  celery: 'Celery',
  gluten: 'Gluten',
  crustaceans: 'Crustaceans',
  eggs: 'Eggs',
  fish: 'Fish',
  lupin: 'Lupin',
  milk: 'Milk',
  molluscs: 'Molluscs',
  mustard: 'Mustard',
  nuts: 'Nuts',
  peanuts: 'Peanuts',
  sesame: 'Sesame',
  soya: 'Soya',
  sulphites: 'Sulphites',
};

export const DIETARY_LABELS: Record<DietaryCode, string> = {
  vegetarian: 'Vegetarian',
  vegan: 'Vegan',
  halal: 'Halal',
  gluten_free: 'Gluten-free',
};

function dedupe<T extends string>(codes: T[]): T[] {
  return [...new Set(codes)];
}

export function normalizeAllergenCodes(raw: unknown): AllergenCode[] {
  if (!Array.isArray(raw)) return [];
  const out: AllergenCode[] = [];
  for (const row of raw) {
    const key = String(row ?? '').trim().toLowerCase().replace(/\s+/g, '_');
    if ((UK_ALLERGEN_CODES as readonly string[]).includes(key)) out.push(key as AllergenCode);
  }
  return dedupe(out);
}

export function normalizeDietaryCodes(raw: unknown): DietaryCode[] {
  if (!Array.isArray(raw)) return [];
  const out: DietaryCode[] = [];
  for (const row of raw) {
    const key = String(row ?? '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    if ((DIETARY_CODES as readonly string[]).includes(key)) out.push(key as DietaryCode);
  }
  return dedupe(out);
}

export interface AllergenFields {
  allergensContains: AllergenCode[];
  allergensMayContain: AllergenCode[];
  dietary: DietaryCode[];
  allergenNotes?: string;
  allergenDeclared: boolean;
}

export function normalizeAllergenFields(data: Record<string, unknown> | null | undefined): AllergenFields {
  const src = data ?? {};
  const contains = normalizeAllergenCodes(
    src.allergensContains ?? src.allergens_contains ?? src.contains,
  );
  const mayContain = normalizeAllergenCodes(
    src.allergensMayContain ?? src.allergens_may_contain ?? src.mayContain ?? src.may_contain,
  );
  const dietary = normalizeDietaryCodes(src.dietary);
  const notesRaw = src.allergenNotes ?? src.allergen_notes;
  const allergenNotes = typeof notesRaw === 'string' && notesRaw.trim() ? notesRaw.trim() : undefined;
  const declaredRaw = src.allergenDeclared ?? src.allergen_declared;
  const allergenDeclared = declaredRaw === true || declaredRaw === 'true' || declaredRaw === 1;
  return {
    allergensContains: contains,
    allergensMayContain: mayContain.filter((c) => !contains.includes(c)),
    dietary,
    allergenNotes,
    allergenDeclared,
  };
}

export function isAllergenIncomplete(
  fields: Pick<AllergenFields, 'allergenDeclared'> | Record<string, unknown>,
): boolean {
  const declared =
    'allergenDeclared' in fields
      ? (fields as { allergenDeclared?: boolean }).allergenDeclared
      : normalizeAllergenFields(fields as Record<string, unknown>).allergenDeclared;
  return declared !== true;
}

/** Max 3 badges + optional +N for card footers. */
export function allergenBadgePreview(
  fields: AllergenFields,
  max = 3,
): { labels: string[]; extra: number; tone: 'ok' | 'none' | 'missing' } {
  if (isAllergenIncomplete(fields)) {
    return { labels: ['Allergens not set'], extra: 0, tone: 'missing' };
  }
  if (!fields.allergensContains.length) {
    return { labels: ['No 14 allergens'], extra: 0, tone: 'ok' };
  }
  const labels = fields.allergensContains.map((c) => ALLERGEN_LABELS[c]);
  return {
    labels: labels.slice(0, max),
    extra: Math.max(0, labels.length - max),
    tone: 'none',
  };
}

/** Card footer helper used by MenuManager (max 3 + overflow). */
export function allergenBadgeLabels(
  product: Record<string, unknown> | { allergenDeclared?: boolean; allergensContains?: unknown },
  max = 3,
): { labels: string[]; overflow: number; tone: 'ok' | 'warn' | 'none' } {
  const fields = normalizeAllergenFields(product as Record<string, unknown>);
  const preview = allergenBadgePreview(fields, max);
  return {
    labels: preview.labels,
    overflow: preview.extra,
    tone: preview.tone === 'missing' ? 'warn' : preview.tone === 'ok' ? 'ok' : 'none',
  };
}
