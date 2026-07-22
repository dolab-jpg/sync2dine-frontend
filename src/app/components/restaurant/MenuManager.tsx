import { useContext, useEffect, useMemo, useState } from 'react';
import { AppContext, Product } from '../../App';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Search, Trash2, Edit, UtensilsCrossed, EyeOff, Grid3x3 } from 'lucide-react';
import { toast } from 'sonner';
import DietaryFactsEditor, { type DietaryFactsValue } from './DietaryFactsEditor';
import AllergenMatrix from './AllergenMatrix';
import {
  allergenBadgeLabels,
  isAllergenIncomplete,
  normalizeAllergenFields,
} from '../../engine/restaurant/allergens';
import { getActiveOrgId } from '../../engine/platform/orgContext';

/**
 * Restaurant food menu manager (Super Master C12).
 * Same Supabase `products` rows that the phone/kiosk agent reads via getMenu —
 * editing here changes what Judie offers on the next call.
 * Also hydrates from GET /api/menu when AppContext products are empty (RLS gap).
 */

const FOOD_CATEGORIES = [
  { value: 'starters', label: 'Starters' },
  { value: 'mains', label: 'Mains' },
  { value: 'sides', label: 'Sides' },
  { value: 'drinks', label: 'Drinks' },
  { value: 'desserts', label: 'Desserts' },
  { value: 'specials', label: 'Specials' },
  { value: 'other', label: 'Other' },
];

const CATEGORY_ORDER = FOOD_CATEGORIES.map((c) => c.value);

type FoodForm = {
  name: string;
  category: string;
  price: string;
  description: string;
  image: string;
  available: boolean;
  /** Comma-separated choice lists for meal deals (specials). */
  dealMains: string;
  dealSides: string;
  dealDrinks: string;
  /**
   * Upgrade options Judie can offer — one group per line:
   * crust: Classic Crust|0, Stuffed Crust|2.5
   * side*: Coleslaw|0, Baked Beans|0
   * (* = required)
   */
  optionsText: string;
  dietary: DietaryFactsValue;
};

const EMPTY_DIETARY: DietaryFactsValue = {
  allergensContains: [],
  allergensMayContain: [],
  dietary: [],
  allergenNotes: '',
  allergenDeclared: false,
};

const EMPTY_FORM: FoodForm = {
  name: '',
  category: 'mains',
  price: '',
  description: '',
  image: '',
  available: true,
  dealMains: '',
  dealSides: '',
  dealDrinks: '',
  optionsText: '',
  dietary: EMPTY_DIETARY,
};

function parseChoiceList(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildDealFromForm(form: FoodForm): Product['deal'] | null {
  if (form.category !== 'specials') return null;
  const mains = parseChoiceList(form.dealMains);
  const sides = parseChoiceList(form.dealSides);
  const drinks = parseChoiceList(form.dealDrinks);
  if (!mains.length && !sides.length && !drinks.length) return null;
  const roles: NonNullable<Product['deal']>['roles'] = [];
  if (mains.length) roles.push({ role: 'main', qtyPerDeal: 1, choices: mains });
  if (sides.length) roles.push({ role: 'side', qtyPerDeal: 1, choices: sides });
  if (drinks.length) roles.push({ role: 'drink', qtyPerDeal: 1, choices: drinks });
  return roles.length ? { roles } : null;
}

function optionsToText(options: Product['options'] | undefined): string {
  if (!options?.length) return '';
  return options
    .map((g) => {
      const role = g.required ? `${g.role}*` : g.role;
      const choices = g.choices
        .map((c) => `${c.name}|${Number(c.priceDelta ?? 0)}`)
        .join(', ');
      return `${role}: ${choices}`;
    })
    .join('\n');
}

function buildOptionsFromForm(form: FoodForm): Product['options'] | undefined {
  const lines = form.optionsText
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return undefined;
  const groups: NonNullable<Product['options']> = [];
  for (const line of lines) {
    const colon = line.indexOf(':');
    if (colon < 1) continue;
    let role = line.slice(0, colon).trim().toLowerCase();
    const required = role.endsWith('*');
    if (required) role = role.slice(0, -1).trim();
    if (!role) continue;
    const choices = line
      .slice(colon + 1)
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const [namePart, deltaPart] = part.split('|').map((s) => s.trim());
        const name = namePart || '';
        const priceDelta = Number(deltaPart ?? 0);
        return {
          name,
          priceDelta: Number.isFinite(priceDelta) ? priceDelta : 0,
        };
      })
      .filter((c) => c.name);
    if (!choices.length) continue;
    groups.push({ role, required, choices });
  }
  return groups.length ? groups : undefined;
}

function itemPrice(p: Product): number {
  const price = Number((p as Record<string, unknown>).price ?? p.sellPrice ?? p.basePrice ?? 0);
  return Number.isFinite(price) ? price : 0;
}

// BD legacy bathroom categories — filter by category (not tradeId) because the
// legacy product migration stamped tradeId onto every synced row, food included.
const BATHROOM_CATEGORIES = new Set(['toilet', 'basin', 'shower', 'bath', 'tap', 'accessory', 'tile']);

function isFoodItem(p: Product): boolean {
  return !BATHROOM_CATEGORIES.has(String(p.category ?? '').toLowerCase());
}

export default function MenuManager() {
  const context = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [missingAllergensOnly, setMissingAllergensOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [matrixOpen, setMatrixOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FoodForm>(EMPTY_FORM);
  const [apiMenu, setApiMenu] = useState<Product[]>([]);
  const products = context?.products ?? [];
  const addProduct = context?.addProduct;
  const updateProduct = context?.updateProduct;
  const deleteProduct = context?.deleteProduct;

  useEffect(() => {
    let cancelled = false;
    const orgId = getActiveOrgId();
    void (async () => {
      try {
        const res = await fetch('/api/menu', {
          headers: orgId ? { 'x-org-id': orgId } : {},
        });
        if (!res.ok) return;
        const data = (await res.json()) as { items?: Product[] };
        const items = Array.isArray(data.items) ? data.items : [];
        if (!cancelled) setApiMenu(items);
      } catch {
        /* keep AppContext products */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const foodItems = useMemo(
    () => {
      const source = products.filter(isFoodItem).length ? products : apiMenu;
      return source
        .filter(isFoodItem)
        .sort(
          (a, b) =>
            CATEGORY_ORDER.indexOf(String(a.category)) - CATEGORY_ORDER.indexOf(String(b.category)) ||
            String(a.name).localeCompare(String(b.name)),
        );
    },
    [products, apiMenu],
  );

  const filtered = useMemo(() => foodItems.filter((p) => {
    const matchesSearch = String(p.name ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    const matchesAllergen = !missingAllergensOnly || isAllergenIncomplete(p);
    return matchesSearch && matchesCategory && matchesAllergen;
  }), [foodItems, searchTerm, filterCategory, missingAllergensOnly]);

  const grouped = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const item of filtered) {
      const cat = CATEGORY_ORDER.includes(String(item.category)) ? String(item.category) : 'other';
      map.set(cat, [...(map.get(cat) ?? []), item]);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => ({
      category: c,
      label: FOOD_CATEGORIES.find((f) => f.value === c)?.label ?? c,
      items: map.get(c) ?? [],
    }));
  }, [filtered]);

  if (!context || !addProduct || !updateProduct || !deleteProduct) return null;

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    const rec = p as Record<string, unknown>;
    const deal = (p.deal ?? rec.deal) as Product['deal'] | undefined;
    const options = (p.options ?? rec.options) as Product['options'] | undefined;
    const roleChoices = (role: string) =>
      deal?.roles?.find((r) => r.role === role)?.choices?.join(', ') ?? '';
    const allergens = normalizeAllergenFields({
      ...rec,
      allergensContains: p.allergensContains ?? rec.allergensContains,
      allergensMayContain: p.allergensMayContain ?? rec.allergensMayContain,
      dietary: p.dietary ?? rec.dietary,
      allergenNotes: p.allergenNotes ?? rec.allergenNotes,
      allergenDeclared: p.allergenDeclared ?? rec.allergenDeclared,
    });
    setEditingId(p.id);
    setForm({
      name: p.name,
      category: CATEGORY_ORDER.includes(String(p.category)) ? String(p.category) : 'other',
      price: String(itemPrice(p) || ''),
      description: typeof rec.description === 'string' ? rec.description : '',
      image: p.image ?? '',
      available: rec.available !== false,
      dealMains: roleChoices('main'),
      dealSides: roleChoices('side'),
      dealDrinks: roleChoices('drink'),
      optionsText: optionsToText(options),
      dietary: {
        allergensContains: allergens.allergensContains,
        allergensMayContain: allergens.allergensMayContain,
        dietary: allergens.dietary,
        allergenNotes: allergens.allergenNotes ?? '',
        allergenDeclared: allergens.allergenDeclared,
      },
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const price = parseFloat(form.price);
    if (!form.name.trim() || !Number.isFinite(price) || price < 0) {
      toast.error('A dish needs a name and a valid price');
      return;
    }
    const deal = buildDealFromForm(form);
    const options = buildOptionsFromForm(form);
    const payload = {
      name: form.name.trim(),
      image: form.image.trim(),
      basePrice: price,
      margin: 0,
      source: 'restaurant',
      category: form.category,
      tradeId: null,
      price,
      description: form.description.trim(),
      available: form.available,
      deal: deal ?? undefined,
      options: options ?? undefined,
      allergensContains: form.dietary.allergensContains,
      allergensMayContain: form.dietary.allergensMayContain,
      dietary: form.dietary.dietary,
      allergenNotes: form.dietary.allergenNotes.trim() || undefined,
      allergenDeclared: form.dietary.allergenDeclared,
    };
    if (editingId) {
      updateProduct(editingId, {
        ...payload,
        ...(form.category !== 'specials' || !deal ? { deal: undefined } : {}),
        ...(!options ? { options: undefined } : {}),
      } as Partial<Product>);
      toast.success('Dish updated — Judie will offer the new details on the next call');
    } else {
      addProduct(payload as Omit<Product, 'id' | 'sellPrice'>);
      toast.success(deal ? 'Meal deal added to the menu' : 'Dish added to the menu');
    }
    setDialogOpen(false);
    setForm(EMPTY_FORM);
    setEditingId(null);
  };

  const handleDelete = (p: Product) => {
    if (confirm(`Remove "${p.name}" from the menu?`)) {
      deleteProduct(p.id);
      toast.success('Dish removed');
    }
  };

  const toggleAvailable = (p: Product) => {
    const nowAvailable = (p as Record<string, unknown>).available === false;
    updateProduct(p.id, { available: nowAvailable } as Partial<Product>);
    toast.success(nowAvailable ? `${p.name} back on the menu` : `${p.name} marked sold out`);
  };

  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-s2d-teal-deep sm:text-3xl">Menu</h1>
          <p className="mt-1 text-sm text-s2d-teal-deep/70">
            What Judie offers on calls and the kiosk — changes go live on the next call
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setMatrixOpen(true)}
            className="min-h-12 font-bold"
            data-testid="open-allergen-matrix"
          >
            <Grid3x3 className="mr-2 h-5 w-5" />
            Allergen matrix
          </Button>
          <Button onClick={openAdd} className="min-h-12 bg-s2d-teal-deep font-bold text-s2d-cream hover:bg-s2d-teal">
            <Plus className="mr-2 h-5 w-5" />
            Add dish
          </Button>
        </div>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-s2d-teal-deep/40" />
          <Input
            placeholder="Search dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="min-h-12 pl-10"
          />
        </div>
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger className="min-h-12 sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {FOOD_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={missingAllergensOnly ? 'default' : 'outline'}
          className={`min-h-12 font-bold ${missingAllergensOnly ? 'bg-amber-600 text-white hover:bg-amber-700' : ''}`}
          onClick={() => setMissingAllergensOnly((v) => !v)}
          data-testid="filter-missing-allergens"
        >
          Missing allergens
        </Button>
      </div>

      {filtered.length === 0 ? (
        <Card className="border-s2d-teal-deep/10">
          <CardContent className="py-14 text-center">
            <UtensilsCrossed className="mx-auto mb-4 h-16 w-16 text-s2d-teal-deep/20" />
            <p className="mb-4 text-s2d-teal-deep/60">
              {searchTerm || filterCategory !== 'all'
                ? 'No dishes match your filters'
                : 'No dishes yet — add your menu so Judie can take orders'}
            </p>
            {!searchTerm && filterCategory === 'all' && (
              <Button onClick={openAdd} className="min-h-12 bg-s2d-teal-deep font-bold text-s2d-cream hover:bg-s2d-teal">
                <Plus className="mr-2 h-5 w-5" />
                Add first dish
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.category}>
              <h2 className="mb-3 text-lg font-extrabold uppercase tracking-wide text-s2d-teal-deep/80">
                {group.label}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => {
                  const rec = item as Record<string, unknown>;
                  const soldOut = rec.available === false;
                  const badges = allergenBadgeLabels(item);
                  const badgeNodes = [
                    ...(item.deal || rec.deal
                      ? [{ key: 'deal', className: 'bg-amber-100 text-amber-900', text: 'Meal deal' }]
                      : []),
                    ...badges.labels.map((text, i) => ({
                      key: `a-${i}`,
                      className:
                        badges.tone === 'warn'
                          ? 'bg-amber-100 text-amber-900'
                          : badges.tone === 'ok'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-s2d-cream text-s2d-teal-deep',
                      text,
                    })),
                  ];
                  const shown = badgeNodes.slice(0, 3);
                  const overflow = badgeNodes.length - shown.length + (badges.overflow > 0 ? badges.overflow : 0);
                  return (
                    <Card key={item.id} className={`border-s2d-teal-deep/10 transition-shadow hover:shadow-md ${soldOut ? 'opacity-60' : ''}`}>
                      <CardContent className="p-4">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="mb-3 h-32 w-full rounded-lg object-cover" />
                        ) : null}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <h3 className="truncate font-bold text-s2d-teal-deep">{item.name}</h3>
                            {typeof rec.description === 'string' && rec.description ? (
                              <p className="mt-0.5 line-clamp-2 text-sm text-s2d-teal-deep/60">{rec.description}</p>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-lg font-extrabold text-s2d-teal-deep">
                            £{itemPrice(item).toFixed(2)}
                          </span>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {soldOut && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                              <EyeOff className="h-3 w-3" /> Sold out
                            </span>
                          )}
                          {shown.map((b) => (
                            <span key={b.key} className={`rounded-full px-2 py-0.5 text-xs font-bold ${b.className}`}>
                              {b.text}
                            </span>
                          ))}
                          {overflow > 0 ? (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-700">
                              +{overflow}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex gap-2 border-t border-s2d-teal-deep/10 pt-3">
                          <Button variant="outline" size="sm" className="min-h-10 flex-1" onClick={() => openEdit(item)}>
                            <Edit className="mr-1 h-3.5 w-3.5" />
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" className="min-h-10" onClick={() => toggleAvailable(item)}>
                            {soldOut ? 'Restock' : 'Sold out'}
                          </Button>
                          <Button variant="outline" size="sm" className="min-h-10" onClick={() => handleDelete(item)} aria-label={`Delete ${item.name}`}>
                            <Trash2 className="h-3.5 w-3.5 text-red-600" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm(EMPTY_FORM); setEditingId(null); } }}>
        <DialogContent className="flex max-h-[90dvh] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>{editingId ? 'Edit dish' : 'Add dish'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
            <div>
              <Label htmlFor="dish-name">Dish name</Label>
              <Input
                id="dish-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Chicken biryani"
                required
                className="min-h-12"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="dish-category">Category</Label>
                <Select value={form.category} onValueChange={(value) => setForm({ ...form, category: value })}>
                  <SelectTrigger id="dish-category" className="min-h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FOOD_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="dish-price">Price (£)</Label>
                <Input
                  id="dish-price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.price}
                  onChange={(e) => setForm({ ...form, price: e.target.value })}
                  required
                  className="min-h-12"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="dish-description">Description (optional — Judie can read it out)</Label>
              <Textarea
                id="dish-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Fragrant basmati rice with spiced chicken"
                rows={2}
              />
            </div>
            {form.category !== 'specials' && (
              <div className="space-y-2 rounded-xl border border-s2d-teal/20 bg-s2d-cream/40 p-3">
                <p className="text-sm font-bold text-s2d-teal-deep">Upgrade options (Judie upsells)</p>
                <p className="text-xs text-slate-600">
                  One group per line: <code>crust: Classic Crust|0, Stuffed Crust|2.5</code>. Use{' '}
                  <code>side*</code> for a required choice (e.g. coleslaw vs beans).
                </p>
                <Textarea
                  id="dish-options"
                  value={form.optionsText}
                  onChange={(e) => setForm({ ...form, optionsText: e.target.value })}
                  placeholder={'crust: Classic Crust|0, Stuffed Crust|2.5\nside*: Coleslaw|0, Baked Beans|0'}
                  rows={3}
                  className="bg-white font-mono text-sm"
                />
              </div>
            )}
            {form.category === 'specials' && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                <p className="text-sm font-bold text-amber-950">
                  Meal deal choices (comma-separated dish names from your menu)
                </p>
                <p className="text-xs text-amber-900/80">
                  Judie will ask for one of each per deal when the customer orders 2× or 3×.
                </p>
                <div>
                  <Label htmlFor="deal-mains">Mains</Label>
                  <Input
                    id="deal-mains"
                    value={form.dealMains}
                    onChange={(e) => setForm({ ...form, dealMains: e.target.value })}
                    placeholder="Chicken biryani, Butter chicken"
                    className="min-h-11 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="deal-sides">Sides</Label>
                  <Input
                    id="deal-sides"
                    value={form.dealSides}
                    onChange={(e) => setForm({ ...form, dealSides: e.target.value })}
                    placeholder="Pilau rice, Chips, Garlic naan"
                    className="min-h-11 bg-white"
                  />
                </div>
                <div>
                  <Label htmlFor="deal-drinks">Drinks</Label>
                  <Input
                    id="deal-drinks"
                    value={form.dealDrinks}
                    onChange={(e) => setForm({ ...form, dealDrinks: e.target.value })}
                    placeholder="Coke, Mango lassi"
                    className="min-h-11 bg-white"
                  />
                </div>
              </div>
            )}
            <DietaryFactsEditor
              value={form.dietary}
              onChange={(dietary) => setForm({ ...form, dietary })}
            />
            <div>
              <Label htmlFor="dish-image">Image URL (optional)</Label>
              <Input
                id="dish-image"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                placeholder="https://..."
                className="min-h-12"
              />
            </div>
            <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-s2d-teal-deep/15 px-3">
              <input
                type="checkbox"
                checked={form.available}
                onChange={(e) => setForm({ ...form, available: e.target.checked })}
                className="h-5 w-5 accent-[#0f3d3e]"
              />
              <span className="font-medium text-s2d-teal-deep">Available to order</span>
            </label>
            </div>
            <div className="sticky bottom-0 flex shrink-0 justify-end gap-2 border-t bg-white px-6 py-4">
              <Button type="button" variant="outline" className="min-h-12" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="min-h-12 bg-s2d-teal-deep font-bold text-s2d-cream hover:bg-s2d-teal">
                {editingId ? 'Save changes' : 'Add dish'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={matrixOpen} onOpenChange={setMatrixOpen}>
        <DialogContent className="max-h-[90dvh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Allergen matrix</DialogTitle>
          </DialogHeader>
          <AllergenMatrix products={foodItems} onClose={() => setMatrixOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
