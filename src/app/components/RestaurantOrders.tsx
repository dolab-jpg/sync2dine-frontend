import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Download, MapPin, Phone, Receipt, Truck, Utensils } from 'lucide-react';
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
  postcode?: string;
  specialName?: string;
  notes?: string;
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
  const address = raw.deliveryAddress ? String(raw.deliveryAddress) : undefined;
  const postcodeRaw = raw.deliveryPostcode ? String(raw.deliveryPostcode).trim() : '';
  const postcodeFromAddress = address?.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)?.[1];
  const postcode = (postcodeRaw || postcodeFromAddress || '').toUpperCase().replace(/\s+/g, ' ').trim() || undefined;
  return {
    id: String(raw.id ?? ''),
    number: String(raw.orderNumber ?? raw.number ?? ''),
    customer: String(raw.customerName ?? raw.customer ?? 'Guest'),
    phone: String(raw.customerPhone ?? raw.phone ?? ''),
    type: (String(raw.orderType ?? raw.type ?? 'collection') as FoodOrder['type']),
    status: (String(raw.status ?? 'new') as OrderStatus),
    payment: (String(raw.paymentStatus ?? raw.payment ?? 'unpaid') as PaymentStatus),
    total: Number(raw.total ?? 0),
    address,
    postcode,
    specialName: raw.specialName ? String(raw.specialName) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
    items,
    createdAt: String(raw.createdAt ?? new Date().toISOString()),
    etaMinutes: raw.etaMinutes != null ? Number(raw.etaMinutes) : undefined,
  };
}

function exportOrdersCsv(orders: FoodOrder[]) {
  const header = ['number', 'customer', 'phone', 'type', 'status', 'payment', 'total', 'address', 'postcode', 'items', 'createdAt'];
  const rows = orders.map((o) => [
    o.number,
    o.customer,
    o.phone,
    o.type,
    o.status,
    o.payment,
    o.total.toFixed(2),
    o.address ?? '',
    o.postcode ?? '',
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

export type BoardTab = 'kitchen' | 'delivery';

interface RestaurantOrdersProps {
  /** Controlled tab (RestaurantShell routes /orders/kitchen|delivery) */
  tab?: BoardTab;
  /** Hide the internal tab switcher when the shell already provides tabs */
  showTabs?: boolean;
  /** Skip full-page chrome when composed inside the Live board */
  embedded?: boolean;
}

export default function RestaurantOrders({ tab: tabProp, showTabs = true, embedded = false }: RestaurantOrdersProps = {}) {
  const [tabState, setTab] = useState<BoardTab>('kitchen');
  const tab = tabProp ?? tabState;
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
    return orders;
  }, [orders, tab, nowTick]);

  return (
    <main className={embedded ? '' : 'min-h-full bg-s2d-cream p-3 sm:p-5'}>
      <section className="mx-auto max-w-7xl">
        <div className="mb-4 rounded-[1.75rem] bg-s2d-teal-deep p-4 text-white shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-s2d-gold">Sync2Dine staff tablet</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                {showTabs ? 'Kitchen and delivery' : tab === 'delivery' ? 'Delivery board' : 'Kitchen board'}
              </h1>
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
              {showTabs && (
                <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/10 p-1">
                  {[
                    ['kitchen', Utensils, 'Kitchen'],
                    ['delivery', Truck, 'Delivery'],
                  ].map(([id, Icon, label]) => {
                    const ActiveIcon = Icon as typeof Utensils;
                    return (
                      <button
                        key={id as string}
                        type="button"
                        onClick={() => setTab(id as BoardTab)}
                        className={`flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-3 text-base font-bold transition ${
                          tab === id ? 'bg-s2d-gold text-s2d-teal-deep' : 'text-white hover:bg-white/10'
                        }`}
                      >
                        <ActiveIcon className="h-5 w-5" />
                        {label as string}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {visibleOrders.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-s2d-teal/30 bg-white/70 p-10 text-center">
            <p className="text-xl font-bold text-s2d-teal-deep">No orders on this board right now</p>
            <p className="mt-1 text-s2d-teal-soft">New phone and kiosk orders appear here with a kitchen alert.</p>
          </div>
        )}
        <div className="grid gap-3 lg:grid-cols-2">
          {visibleOrders.map((order) => (
            <article key={order.id} className="rounded-[1.5rem] border border-slate-200 bg-white p-4 shadow-sm">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Order #{order.number}</p>
                  <h2 className="text-2xl font-black text-slate-950">{order.customer}</h2>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-600">
                    <span className="rounded-lg bg-slate-100 px-2 py-0.5 capitalize">{order.type}</span>
                    {order.phone ? (
                      <a href={`tel:${order.phone}`} className="inline-flex items-center gap-1 text-s2d-teal-deep hover:underline">
                        <Phone className="h-3.5 w-3.5" />
                        {order.phone}
                      </a>
                    ) : null}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge className="rounded-xl bg-s2d-teal-deep px-3 py-1 text-white">{statusLabel(order.status)}</Badge>
                  {order.payment === 'unpaid' ? (
                    <Badge className="rounded-xl bg-red-600 px-3 py-1 text-white">Unpaid</Badge>
                  ) : (
                    <Badge variant="outline" className="rounded-xl border-s2d-teal px-3 py-1 text-s2d-teal-deep">
                      Paid {order.payment}
                    </Badge>
                  )}
                </div>
              </header>

              <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  {order.items.map((item) => (
                    <div key={item} className="rounded-xl bg-slate-50 px-3 py-2 text-lg font-semibold text-slate-900">
                      {item}
                    </div>
                  ))}
                  {(order.address || order.postcode) && (
                    <div className="rounded-xl bg-s2d-cream-bright px-3 py-2 font-semibold text-s2d-teal-ink">
                      <p className="flex items-start gap-2">
                        <MapPin className="mt-0.5 h-5 w-5 shrink-0" />
                        <span>
                          {order.address || 'Delivery'}
                          {order.postcode && order.address && !order.address.toUpperCase().includes(order.postcode.replace(/\s+/g, '')) ? (
                            <span className="mt-1 block text-base font-black tracking-wide">{order.postcode}</span>
                          ) : null}
                          {order.postcode && !order.address ? (
                            <span className="font-black tracking-wide">{order.postcode}</span>
                          ) : null}
                        </span>
                      </p>
                    </div>
                  )}
                  {(order.specialName || order.notes) && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                      {order.specialName ? <p>Special: {order.specialName}</p> : null}
                      {order.notes ? <p className="mt-0.5 text-amber-900/80 font-medium">{order.notes}</p> : null}
                    </div>
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

              <footer className="mt-4 grid gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  className="min-h-[52px] rounded-xl bg-s2d-gold text-base font-bold text-s2d-teal-deep hover:bg-s2d-gold-soft"
                  onClick={() => void patchOrder(order.id, { status: 'coming' })}
                >
                  <Receipt className="mr-2 h-5 w-5" />
                  Coming to order
                </Button>
                <Button
                  type="button"
                  className="min-h-[52px] rounded-xl bg-s2d-teal-deep text-base font-bold text-white hover:bg-s2d-teal"
                  onClick={() => void patchOrder(order.id, { status: 'ready' })}
                >
                  Mark ready
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
