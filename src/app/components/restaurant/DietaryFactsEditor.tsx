import { ALLERGEN_LABELS, DIETARY_LABELS, type AllergenCode, type DietaryCode, UK_ALLERGEN_CODES, DIETARY_CODES } from '../../engine/restaurant/allergens';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';

export type DietaryFactsValue = {
  allergensContains: AllergenCode[];
  allergensMayContain: AllergenCode[];
  dietary: DietaryCode[];
  allergenNotes: string;
  allergenDeclared: boolean;
};

type Props = {
  value: DietaryFactsValue;
  onChange: (next: DietaryFactsValue) => void;
};

function toggleCode<T extends string>(list: T[], code: T): T[] {
  return list.includes(code) ? list.filter((c) => c !== code) : [...list, code];
}

function Chip({
  active,
  muted,
  label,
  onClick,
}: {
  active: boolean;
  muted?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-12 rounded-xl px-3 py-2 text-sm font-bold touch-manipulation transition ${
        active
          ? muted
            ? 'bg-amber-200 text-amber-950 ring-2 ring-amber-400'
            : 'bg-s2d-teal-deep text-white ring-2 ring-s2d-teal'
          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
      }`}
    >
      {label}
    </button>
  );
}

/**
 * Otter-style Dietary facts editor: UK 14 Contains / May contain + dietary chips.
 */
export default function DietaryFactsEditor({ value, onChange }: Props) {
  return (
    <div className="space-y-4 rounded-xl border border-s2d-teal/20 bg-s2d-cream/50 p-3" data-testid="dietary-facts-editor">
      <div>
        <h3 className="text-base font-extrabold text-s2d-teal-deep">Dietary facts (UK 14)</h3>
        <p className="text-xs text-slate-600">Tap allergens this dish contains. May-contain is for cross-contamination risk.</p>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-bold text-s2d-teal-deep">Contains</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {UK_ALLERGEN_CODES.map((code) => (
            <Chip
              key={`c-${code}`}
              label={ALLERGEN_LABELS[code]}
              active={value.allergensContains.includes(code)}
              onClick={() => {
                const allergensContains = toggleCode(value.allergensContains, code);
                onChange({
                  ...value,
                  allergensContains,
                  allergensMayContain: value.allergensMayContain.filter((c) => !allergensContains.includes(c)),
                });
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-bold text-amber-900">May contain</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {UK_ALLERGEN_CODES.map((code) => (
            <Chip
              key={`m-${code}`}
              muted
              label={ALLERGEN_LABELS[code]}
              active={value.allergensMayContain.includes(code)}
              onClick={() => {
                if (value.allergensContains.includes(code)) return;
                onChange({
                  ...value,
                  allergensMayContain: toggleCode(value.allergensMayContain, code),
                });
              }}
            />
          ))}
        </div>
      </div>

      <div>
        <Label className="mb-2 block text-sm font-bold text-s2d-teal-deep">Dietary</Label>
        <div className="flex flex-wrap gap-2">
          {DIETARY_CODES.map((code) => (
            <Chip
              key={code}
              label={DIETARY_LABELS[code]}
              active={value.dietary.includes(code)}
              onClick={() => onChange({ ...value, dietary: toggleCode(value.dietary, code) })}
            />
          ))}
        </div>
      </div>

      <div>
        <Label htmlFor="allergen-notes">Allergen notes</Label>
        <Textarea
          id="allergen-notes"
          value={value.allergenNotes}
          onChange={(e) => onChange({ ...value, allergenNotes: e.target.value })}
          placeholder="e.g. Prepared in a kitchen that also handles nuts"
          rows={2}
          className="mt-1"
        />
      </div>

      <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-s2d-teal-deep/15 bg-white px-3">
        <input
          type="checkbox"
          checked={value.allergenDeclared}
          onChange={(e) => onChange({ ...value, allergenDeclared: e.target.checked })}
          className="h-5 w-5 accent-[#0f3d3e]"
          data-testid="allergen-declared-check"
        />
        <span className="font-medium text-s2d-teal-deep">I’ve checked this dish (even if none of the 14 apply)</span>
      </label>
    </div>
  );
}
