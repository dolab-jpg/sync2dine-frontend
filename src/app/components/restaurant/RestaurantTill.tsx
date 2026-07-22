import { useEffect, useMemo, useState } from 'react';
import { useContext } from 'react';
import { AppContext } from '../../App';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { toast } from 'sonner';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import { Plus, Trash2, ShoppingBag } from 'lucide-react';

type CartLine = { name: string; qty: number; price: number };
type MenuItem = { id: string; name: string; price: number; available?: boolean; category?: string };

/**
 * Staff till MVP ù creates orders via shared POST /api/orders (OrderService).
 * Menu lines load from GET /api/menu (fallback: AppContext products).
 */
export default function RestaurantTill() {
  const { customers, products } = useContext(AppContext);
  const orgId = getActiveOrgId();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<'collection' | 'delivery'>('collection');
  const [postcode, setPostcode] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [allergyConfirmed, setAllergyConfirmed] = useState(false);
  const [customerAllergies, setCustomerAllergies] = useState('');
  /** Pay at the door ù unpaid until staff mark Paid on the board. */
  const [payAtDoor, setPayAtDoor] = useState<'cash' | 'card'>('cash');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [pickId, setPickId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');

  // Stable fingerprint so sold-out / price edits in MenuManager refresh the till without fetch loops.
  const productFingerprint = useMemo(
    () => (products ?? [])
      .map((p) => `${p.id}:${p.available !== false ? 1 : 0}:${p.price}`)
      .sort()
      .join('|'),
    [products],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadMenu() {
      setMenuLoading(true);
      try {
        const res = await fetch('/api/menu', {
          headers: orgId ? { 'x-org-id': orgId } : {},
        });
        if (res.ok) {
          const data = (await res.json()) as { items?: MenuItem[] };
          const items = (data.items ?? []).filter(
            (p) => p.available !== false && Number.isFinite(Number(p.price)),
          );
          if (!cancelled && items.length) {
            setMenuItems(items.map((p) => ({
              id: String(p.id),
              name: String(p.name),
              price: Number(p.price),
              available: p.available,
              category: p.category,
            })));
            return;
          }
        } else if (!cancelled) {
          toast.message('Menu API unavailable ? using local catalog');
        }
      } catch {
        if (!cancelled) toast.message('Menu API unavailable ? using local catalog');
      }
      // Fallback: AppContext products (same Supabase catalog MenuManager edits)
      if (!cancelled) {
        const fallback = (products ?? [])
          .filter((p) => p.available !== false && typeof p.price === 'number')
          .map((p) => ({
            id: String(p.id),
            name: String(p.name),
            price: Number(p.price),
            available: p.available !== false,
            category: p.category,
          }));
        setMenuItems(fallback);
      }
    }
    void loadMenu().finally(() => {
      if (!cancelled) setMenuLoading(false);
    });
    return () => { cancelled = true; };
  }, [orgId, productFingerprint, products]);

  const total = useMemo(
    () => Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100,
    [lines],
  );

  const matchedCustomers = useMemo(() => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return [];
    return (customers ?? [])
      .filter((c) => {
        const name = String(c.name ?? '').toLowerCase();
        const phone = String(c.phone ?? '');
        return name.includes(q) || phone.includes(q);
      })
      .slice(0, 6);
  }, [customers, customerQuery]);

  function addPicked() {
    const item = menuItems.find((p) => String(p.id) === pickId);
    if (!item) {
      toast.error('Pick a menu item first');
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.name === item.name);
      if (existing) {
        return prev.map((l) => (l.name === item.name ? { ...l, qty: l.qty + 1 } : l));
      }
      return [...prev, { name: item.name, qty: 1, price: Number(item.price) || 0 }];
    });
  }

  async function submit() {
    if (!lines.length) {
      toast.error('Add at least one item');
      return;
    }
    if (!allergyConfirmed) {
      toast.error('Confirm allergy check before placing');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(orgId ? { 'x-org-id': orgId } : {}),
        },
        body: JSON.stringify({
          items: lines.map((l) => ({ name: l.name, qty: l.qty, price: l.price })),
          orderType,
          postcode: orderType === 'delivery' ? postcode : undefined,
          deliveryAddress: orderType === 'delivery' ? deliveryAddress : undefined,
          customerName: customerName.trim() || 'Guest',
          customerPhone: customerPhone.trim(),
          notes,
          customerAllergies,
          allergyConfirmed: true,
          paymentStatus: payAtDoor,
          channel: 'staff',
          source: 'sync2dine',
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        spokenHint?: string;
        order?: { orderNumber?: number | string; id?: string };
      };
      if (!res.ok || data.ok === false) {
        toast.error(data.spokenHint || data.error || `Could not place order (${res.status})`);
        return;
      }
      toast.success(
        data.spokenHint
          || `Order ${data.order?.orderNumber ?? ''} placed ù on the kitchen board.`,
      );
      setLines([]);
      setNotes('');
      setCustomerAllergies('');
      setAllergyConfirmed(false);
    } catch {
      toast.error('Network error placing order');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 pb-24">
      <header className="flex items-center gap-3">
        <ShoppingBag className="h-7 w-7 text-emerald-800" />
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Till</h1>
          <p className="text-sm text-stone-600">Staff order ù same rules as phone (delivery area, allergies, pricing).</p>
        </div>
      </header>

      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Customer</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="till-name">Name</Label>
            <Input id="till-name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="till-phone">Phone</Label>
            <Input id="till-phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} />
          </div>
        </div>
        <div>
          <Label htmlFor="till-cust-search">Search customers</Label>
          <Input
            id="till-cust-search"
            value={customerQuery}
            onChange={(e) => setCustomerQuery(e.target.value)}
            placeholder="Name or phone"
          />
          {matchedCustomers.length > 0 && (
            <ul className="mt-2 divide-y rounded-xl border border-stone-200">
              {matchedCustomers.map((c) => (
                <li key={String(c.id)}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-stone-50"
                    onClick={() => {
                      setCustomerName(String(c.name ?? ''));
                      setCustomerPhone(String(c.phone ?? ''));
                      setCustomerQuery('');
                    }}
                  >
                    <span className="font-medium">{String(c.name ?? 'Guest')}</span>
                    <span className="text-stone-500">{String(c.phone ?? '')}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Fulfilment</h2>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={orderType === 'collection' ? 'default' : 'outline'}
            className="min-h-11 flex-1"
            onClick={() => setOrderType('collection')}
          >
            Collection
          </Button>
          <Button
            type="button"
            variant={orderType === 'delivery' ? 'default' : 'outline'}
            className="min-h-11 flex-1"
            onClick={() => setOrderType('delivery')}
          >
            Delivery
          </Button>
        </div>
        {orderType === 'delivery' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="till-address">Address</Label>
              <Input
                id="till-address"
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="till-postcode">Postcode</Label>
              <Input id="till-postcode" value={postcode} onChange={(e) => setPostcode(e.target.value)} />
            </div>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Items</h2>
        {menuLoading ? (
          <p className="text-sm text-stone-500">Loading menuù</p>
        ) : menuItems.length === 0 ? (
          <p className="text-sm text-amber-800">No menu items available. Add dishes under Menu first.</p>
        ) : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="min-h-11 flex-1 rounded-xl border border-stone-200 px-3 text-sm"
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
          >
            <option value="">Select menu itemù</option>
            {menuItems.map((p) => (
              <option key={String(p.id)} value={String(p.id)}>
                {p.name} ù ù{Number(p.price).toFixed(2)}
              </option>
            ))}
          </select>
          <Button type="button" className="min-h-11" onClick={addPicked} disabled={!menuItems.length}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
        {lines.length === 0 ? (
          <p className="text-sm text-stone-500">No lines yet.</p>
        ) : (
          <ul className="divide-y rounded-xl border border-stone-200">
            {lines.map((l) => (
              <li key={l.name} className="flex items-center gap-2 px-3 py-2">
                <div className="flex-1">
                  <div className="font-medium">{l.name}</div>
                  <div className="text-xs text-stone-500">ù{l.price.toFixed(2)} each</div>
                </div>
                <Input
                  type="number"
                  min={1}
                  className="w-20"
                  value={l.qty}
                  onChange={(e) => {
                    const qty = Math.max(1, Number(e.target.value) || 1);
                    setLines((prev) => prev.map((row) => (row.name === l.name ? { ...row, qty } : row)));
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setLines((prev) => prev.filter((row) => row.name !== l.name))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="text-right text-lg font-bold">Total ù{total.toFixed(2)}</div>
      </section>

      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Pay at the door</h2>
        <p className="text-sm text-stone-600">Customer pays when they collect or when delivery arrives.</p>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={payAtDoor === 'cash' ? 'default' : 'outline'}
            className="min-h-11 flex-1"
            onClick={() => setPayAtDoor('cash')}
          >
            Cash
          </Button>
          <Button
            type="button"
            variant={payAtDoor === 'card' ? 'default' : 'outline'}
            className="min-h-11 flex-1"
            onClick={() => setPayAtDoor('card')}
          >
            Card
          </Button>
        </div>
      </section>

      <section className="space-y-3 rounded-2xl border border-stone-200 bg-white p-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-stone-500">Notes & allergies</h2>
        <div>
          <Label htmlFor="till-notes">Special instructions</Label>
          <Textarea id="till-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>
        <div>
          <Label htmlFor="till-allergies">Customer allergies (if any)</Label>
          <Input
            id="till-allergies"
            value={customerAllergies}
            onChange={(e) => setCustomerAllergies(e.target.value)}
            placeholder="e.g. peanuts, gluten"
          />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={allergyConfirmed}
            onChange={(e) => setAllergyConfirmed(e.target.checked)}
          />
          <span>Allergy check done ù safe to place this order</span>
        </label>
      </section>

      <Button
        type="button"
        className="min-h-14 w-full rounded-2xl text-base font-bold"
        disabled={submitting || menuLoading}
        onClick={() => void submit()}
      >
        {submitting ? 'Placingù' : 'Place order'}
      </Button>
    </div>
  );
}
