import { useContext, useMemo, useState } from 'react';
import { AppContext, Product } from '../../App';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Search, Trash2, Edit, UtensilsCrossed, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

/**
 * Restaurant food menu manager (Super Master C12).
 * Same Supabase `products` rows that the phone/kiosk agent reads via getMenu —
 * editing here changes what Lizzie offers on the next call.
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
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FoodForm>(EMPTY_FORM);
  if (!context) return null;

  const { products, addProduct, updateProduct, deleteProduct } = context;

  const foodItems = useMemo(
    () =>
      products
        .filter(isFoodItem)
        .sort(
          (a, b) =>
            CATEGORY_ORDER.indexOf(String(a.category)) - CATEGORY_ORDER.indexOf(String(b.category)) ||
            String(a.name).localeCompare(String(b.name)),
        ),
    [products],
  );

  const filtered = foodItems.filter((p) => {
    const matchesSearch = String(p.name ?? '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || p.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

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

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: Product) => {
    const rec = p as Record<string, unknown>;
    const deal = (p.deal ?? rec.deal) as Product['deal'] | undefined;
    const roleChoices = (role: string) =>
      deal?.roles?.find((r) => r.role === role)?.choices?.join(', ') ?? '';
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
    };
    if (editingId) {
      updateProduct(editingId, {
        ...payload,
        ...(form.category !== 'specials' || !deal ? { deal: undefined } : {}),
      } as Partial<Product>);
      toast.success('Dish updated — Lizzie will offer the new details on the next call');
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
            What Lizzie offers on calls and the kiosk — changes go live on the next call
          </p>
        </div>
        <Button onClick={openAdd} className="min-h-12 bg-s2d-teal-deep font-bold text-s2d-cream hover:bg-s2d-teal">
          <Plus className="mr-2 h-5 w-5" />
          Add dish
        </Button>
      </div>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
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
      </div>

      {filtered.length === 0 ? (
        <Card className="border-s2d-teal-deep/10">
          <CardContent className="py-14 text-center">
            <UtensilsCrossed className="mx-auto mb-4 h-16 w-16 text-s2d-teal-deep/20" />
            <p className="mb-4 text-s2d-teal-deep/60">
              {searchTerm || filterCategory !== 'all'
                ? 'No dishes match your filters'
                : 'No dishes yet — add your menu so Lizzie can take orders'}
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
                            {(item.deal || rec.deal) ? (
                              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-amber-800">
                                Meal deal
                              </p>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-lg font-extrabold text-s2d-teal-deep">
                            £{itemPrice(item).toFixed(2)}
                          </span>
                        </div>
                        {soldOut && (
                          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">
                            <EyeOff className="h-3 w-3" /> Sold out
                          </span>
                        )}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Edit dish' : 'Add dish'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
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
              <Label htmlFor="dish-description">Description (optional — Lizzie can read it out)</Label>
              <Textarea
                id="dish-description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g. Fragrant basmati rice with spiced chicken"
                rows={2}
              />
            </div>
            {form.category === 'specials' && (
              <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-3">
                <p className="text-sm font-bold text-amber-950">
                  Meal deal choices (comma-separated dish names from your menu)
                </p>
                <p className="text-xs text-amber-900/80">
                  Lizzie will ask for one of each per deal when the customer orders 2× or 3×.
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
            <div className="flex justify-end gap-2 border-t pt-4">
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
    </div>
  );
}
