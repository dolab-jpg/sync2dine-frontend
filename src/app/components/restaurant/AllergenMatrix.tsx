import { useMemo } from 'react';
import type { Product } from '../../App';
import {
  ALLERGEN_LABELS,
  UK_ALLERGEN_CODES,
  normalizeAllergenFields,
  type AllergenCode,
} from '../../engine/restaurant/allergens';
import { Button } from '../ui/button';

type Props = {
  products: Product[];
  onClose?: () => void;
};

function isFoodItem(p: Product): boolean {
  const bathroom = new Set(['toilet', 'basin', 'shower', 'bath', 'tap', 'accessory', 'tile']);
  return !bathroom.has(String(p.category ?? '').toLowerCase());
}

/**
 * Printable dish × UK-14 allergen matrix (embed in a dialog or page).
 */
export default function AllergenMatrix({ products, onClose }: Props) {
  const rows = useMemo(() => {
    return products
      .filter(isFoodItem)
      .map((p) => {
        const fields = normalizeAllergenFields(p as unknown as Record<string, unknown>);
        return { id: p.id, name: p.name, category: String(p.category ?? ''), fields };
      })
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [products]);

  function mark(code: AllergenCode, contains: AllergenCode[], may: AllergenCode[]): string {
    if (contains.includes(code)) return '●';
    if (may.includes(code)) return '○';
    return '';
  }

  return (
    <div data-testid="allergen-matrix" className="space-y-3">
      <p className="text-sm text-slate-600">
        ● = Contains · ○ = May contain. Print for the pass / written allergen info.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-xs sm:text-sm">
          <thead>
            <tr className="bg-s2d-teal-deep text-white">
              <th className="sticky left-0 z-10 bg-s2d-teal-deep px-2 py-2 font-bold">Dish</th>
              {UK_ALLERGEN_CODES.map((code) => (
                <th key={code} className="px-1 py-2 text-center font-semibold" title={ALLERGEN_LABELS[code]}>
                  <span className="inline-block max-w-[3.5rem] truncate sm:max-w-none">{ALLERGEN_LABELS[code]}</span>
                </th>
              ))}
              <th className="px-2 py-2 font-bold">Checked</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-200 odd:bg-white even:bg-s2d-cream/40">
                <td className="sticky left-0 z-10 bg-inherit px-2 py-2 font-bold text-s2d-teal-deep">{row.name}</td>
                {UK_ALLERGEN_CODES.map((code) => (
                  <td key={code} className="px-1 py-2 text-center font-black text-s2d-teal-deep">
                    {mark(code, row.fields.allergensContains, row.fields.allergensMayContain)}
                  </td>
                ))}
                <td className="px-2 py-2 text-center">{row.fields.allergenDeclared ? 'Yes' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <p className="py-8 text-center text-slate-500">No menu dishes yet.</p>
      )}
      <div className="flex flex-wrap gap-2 print:hidden">
        <Button
          type="button"
          className="min-h-12 bg-s2d-teal-deep font-bold text-white hover:bg-s2d-teal"
          onClick={() => window.print()}
        >
          Print
        </Button>
        {onClose ? (
          <Button type="button" variant="outline" className="min-h-12" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
    </div>
  );
}
