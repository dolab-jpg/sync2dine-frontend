import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, CreditCard, Download, MapPin, Phone, Receipt, Truck, Utensils } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { getActiveOrgId } from '../engine/platform/orgContext';

type OrderStatus = 'new' | 'coming' | 'paid' | 'preparing' | 'ready' | 'delivery' | 'completed' | 'cancelled';
type PaymentStatus = 'unpaid' | 'cash' | 'card';

type FoodOrder = {
  id: string;
  number: string;
  customer: string;
  phone: string;
  type: 'collection' | 'delivery' | 'table';
  status: OrderStatus;
  payment: PaymentStatus;
  total: number;
  address?: string;
  items: string[];
  createdAt: string;
  etaMinutes?: number;
};

function statusLabel(status: OrderStatus) {
  if (status === 'coming') return 'Coming to order';
  if (status === 'paid') return 'Paid';
  if (status === 'delivery') return 'Out for delivery';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function elapsedLabel(iso: string): string {
  const started = Date.parse(iso);
  if (!Number.isFinite(started)) return iso;
  const mins = Math.max(0, Math.floor((Date.now() - started) / 60_000));
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min';
  return `${mins} min`;
}

function deliveryTimerLabel(order: FoodOrder): string {
  const elapsed = elapsedLabel(order.createdAt);
  if (order.type !== 'delivery') return elapsed;
  const eta = order.etaMinutes ?? 40;
  const started = Date.parse(order.createdAt);
  const minsGone = Number.isFinite(started) ? Math.max(0, Math.floor((Date.now() - started) / 60_000)) : 0;
  const left = Math.max(0, eta - minsGone);
  if (left === 0) return `${elapsed} · ETA due`;
  return `${elapsed} · ${left} min left`;
}

function playKitchenAlert() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.stop(ctx.currentTime + 0.4);
    setTimeout(() => void ctx.close(), 500);
  } catch {
    // Audio may be blocked until a user gesture
  }
}

function mapApiOrder(raw: Record<string, unknown>): FoodOrder {
  const itemsRaw = raw.items;
  const items = Array.isArray(itemsRaw)
    ? itemsRaw.map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>;
          const name = String(row.name ?? row.title ?? 'Item');
          const qty = Number(row.qty ?? row.quantity ?? 1);
          return qty > 1 ? `${qty}× ${name}` : name;
        }
        return String(item);
      })
    : [];
  return {
    id: String(raw.id ?? ''),
    number: String(raw.orderNumber ?? raw.number ?? ''),
    customer: String(raw.customerName ?? raw.customer ?? 'Guest'),
    phone: String(raw.customerPhone ?? raw.phone ?? ''),
    type: (String(raw.orderType ?? raw.type ?? 'collection') as FoodOrder['type']),
    status: (String(raw.status ?? 'new') as OrderStatus),
    payment: (String(raw.paymentStatus ?? raw.payment ?? 'unpaid') as PaymentStatus),
    total: Number(raw.total ?? 0),
    address: raw.deliveryAddress ? String(raw.deliveryAddress) : undefined,
    items,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    etaMinutes: raw.etaMinutes != null ? Number(raw.etaMinutes) : undefined,
  };
}

function exportOrdersCsv(orders: FoodOrder[]) {
  const header = ['number', 'customer', 'phone', 'type', 'status', 'payment', 'total', 'address', 'items', 'createdAt'];
  const rows = orders.map((o) => [
    o.number,
    o.customer,
    o.phone,
    o.type,
    o.status,
    o.payment,
    o.total.toFixed(2),
    o.address ?? '',
    o.items.join('; '),
    o.createdAt,
  ]);
  const csv = [header, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sync2dine-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function RestaurantOrders() {
  const [tab, setTab] = useState<'kitchen' | 'till' | 'delivery'>('kitchen');
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [nowTick, setNowTick] = useState(0);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const orgId = getActiveOrgId();

  const patchOrder = useCallback(async (id: string, patch: Partial<FoodOrder>) => {
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, ...patch } : order)));
    try {
      await fetch(`/api/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(orgId ? { 'x-org-id': orgId } : {}),
        },
        body: JSON.stringify({
          status: patch.status,
          paymentStatus: patch.payment,
          paymentMethod: patch.payment === 'unpaid' ? undefined : patch.payment,
        }),
      });
    } catch {
      // Local UI already updated; API may be offline
    }
  }, [orgId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadOrders() {
      try {
        const res = await fetch('/api/orders', {
          headers: orgId ? { 'x-org-id': orgId } : {},
        });
        if (!res.ok) return;
        const data = await res.json() as { orders?: Array<Record<string, unknown>> };
        const next = Array.isArray(data.orders) ? data.orders.map(mapApiOrder) : [];
        if (cancelled) return;
        const prevIds = knownIdsRef.current;
        const fresh = next.filter((o) => o.status === 'new' && !prevIds.has(o.id));
        if (fresh.length > 0) playKitchenAlert();
        knownIdsRef.current = new Set(next.map((o) => o.id));
        setOrders(next);
      } catch {
        // Keep last successful list when API is unavailable (do not invent demo tickets)
      }
    }
    void loadOrders();
    const poll = window.setInterval(() => void loadOrders(), 8_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [orgId]);

  const visibleOrders = useMemo(() => {
    void nowTick;
    if (tab === 'delivery') return orders.filter((o) => o.type === 'delivery');
    if (tab === 'till') return orders.filter((o) => o.payment === 'unpaid' || o.status === 'coming');
    return orders;
  }, [orders, tab, nowTick]);

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-5">
      <section className="mx-auto max-w-7xl">
        <div className="mb-4 rounded-[1.75rem] bg-emerald-950 p-4 text-white shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200">Sync2Dine staff tablet</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Orders, till and delivery</h1>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="outline"
                className="min-h-[52px] rounded-xl border-white/30 bg-white/10 text-base font-bold text-white hover:bg-white/20"
                onClick={() => exportOrdersCsv(orders)}
              >
                <Download className="mr-2 h-5 w-5" />
                Export CSV
              </Button>
              <div className="grid grid-cols-3 gap-2 rounded-2xl bg-white/10 p-1">
                {[
                  ['kitchen', Utensils, 'Kitchen'],
                  ['till', CreditCard, 'Till'],
                  ['delivery', Truck, 'Delivery'],
                ].map(([id, Icon, label]) => {
                  const ActiveIcon = Icon as typeof Utensils;
                  return (
                    <button
                      key={id as string}
                      type="button"
                      onClick={() => setTab(id as typeof tab)}
                      className={`flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-3 text-base font-bold transition ${
                        tab === id ? 'bg-amber-200 text-emerald-950' : 'text-white hover:bg-white/10'
                      }`}
                    >
                      <ActiveIcon className="h-5 w-5" />
                      {label as string}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          {visibleOrders.map((order) => (
            <article key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Order #{order.number}</p>
                  <h2 className="text-2xl font-black text-slate-950">{order.customer}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-xl bg-emerald-950 px-3 py-1 text-white">{statusLabel(order.status)}</Badge>
                  <Badge variant="outline" className="rounded-xl px-3 py-1">
                    {order.payment === 'unpaid' ? 'Unpaid' : `Paid ${order.payment}`}
                  </Badge>
                </div>
              </header>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item} className="rounded-xl bg-slate-50 px-3 py-2 text-lg font-semibold text-slate-900">
                      {item}
                    </div>
                  ))}
                  {order.address && (
                    <p className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 font-semibold text-amber-950">
                      <MapPin className="h-5 w-5" />
                      {order.address}
                    </p>
                  )}
                </div>
                <div className="rounded-2xl bg-slate-950 p-4 text-center text-white">
                  <p className="flex items-center justify-center gap-1 text-sm text-slate-300">
                    <Clock className="h-4 w-4" />
                    {deliveryTimerLabel(order)}
                  </p>
                  <p className="mt-3 text-3xl font-black">£{order.total.toFixed(2)}</p>
                </div>
              </div>

              <footer className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Button
                  type="button"
                  className="min-h-[52px] rounded-xl bg-amber-400 text-base font-bold text-emerald-950 hover:bg-amber-300"
                  onClick={() => void patchOrder(order.id, { status: 'coming' })}
                >
                  <Receipt className="mr-2 h-5 w-5" />
                  Coming to order
                </Button>
                <Button
                  type="button"
                  className="min-h-[52px] rounded-xl bg-emerald-950 text-base font-bold text-white hover:bg-emerald-900"
                  onClick={() => void patchOrder(order.id, { status: 'paid', payment: 'cash' })}
                >
                  Cash paid
                </Button>
                <Button
                  type="button"
                  className="min-h-[52px] rounded-xl bg-emerald-950 text-base font-bold text-white hover:bg-emerald-900"
                  onClick={() => void patchOrder(order.id, { status: 'paid', payment: 'card' })}
                >
                  Card paid
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[52px] rounded-xl text-base font-bold"
                  onClick={() => {
                    if (order.phone) window.location.href = `tel:${order.phone}`;
                  }}
                >
                  <Phone className="mr-2 h-5 w-5" />
                  Call them
                </Button>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
