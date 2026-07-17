import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Clock, Download, MapPin, Phone, Receipt, Truck, Utensils, Volume2, X,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { getActiveOrgId } from '../engine/platform/orgContext';
import {
  acknowledgeOrderFlash,
  bootstrapSeenIfEmpty,
  getUnseenNewOrders,
  isKitchenAudioUnlocked,
  isOrderFlashing,
  noteOrdersSeen,
  subscribeKitchenAlerts,
  unlockKitchenAudio,
} from '../engine/restaurant/kitchenAlertStore';

type OrderStatus = 'new' | 'coming' | 'paid' | 'preparing' | 'ready' | 'delivery' | 'completed' | 'cancelled';
type PayStatus = 'unpaid' | 'paid';
type PayMethod = 'cash' | 'card';

type OrderLine = { label: string; qty: number; price?: number };

type FoodOrder = {
  id: string;
  number: string;
  customer: string;
  phone: string;
  type: 'collection' | 'delivery' | 'table';
  status: OrderStatus;
  payment: PayStatus;
  paymentMethod?: PayMethod;
  total: number;
  address?: string;
  postcode?: string;
  specialName?: string;
  notes?: string;
  items: OrderLine[];
  createdAt: string;
  etaMinutes?: number;
};

function statusLabel(status: OrderStatus) {
  if (status === 'coming') return 'Coming to order';
  if (status === 'paid') return 'Paid';
  if (status === 'delivery') return 'Out for delivery';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function paymentBadge(order: FoodOrder): { label: string; className: string } {
  if (order.payment === 'paid') {
    return {
      label: order.paymentMethod ? `Paid ${order.paymentMethod}` : 'Paid',
      className: 'rounded-xl border border-s2d-teal px-3 py-1 text-s2d-teal-deep bg-white',
    };
  }
  if (order.paymentMethod === 'cash') {
    return { label: 'Cash on arrival', className: 'rounded-xl bg-amber-500 px-3 py-1 text-white' };
  }
  if (order.paymentMethod === 'card') {
    return { label: 'Card on arrival', className: 'rounded-xl bg-amber-600 px-3 py-1 text-white' };
  }
  return { label: 'Unpaid', className: 'rounded-xl bg-red-600 px-3 py-1 text-white' };
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

function mapPayment(raw: Record<string, unknown>): { payment: PayStatus; paymentMethod?: PayMethod } {
  const statusRaw = String(raw.paymentStatus ?? raw.payment ?? 'unpaid').toLowerCase();
  const methodRaw = raw.paymentMethod != null ? String(raw.paymentMethod).toLowerCase() : '';
  if (statusRaw === 'cash' || statusRaw === 'card') {
    return { payment: 'paid', paymentMethod: statusRaw };
  }
  if (statusRaw === 'paid') {
    const method = methodRaw === 'cash' || methodRaw === 'card' ? methodRaw : undefined;
    return { payment: 'paid', paymentMethod: method };
  }
  const method = methodRaw === 'cash' || methodRaw === 'card' ? methodRaw : undefined;
  return { payment: 'unpaid', paymentMethod: method };
}

function mapApiOrder(raw: Record<string, unknown>): FoodOrder {
  const itemsRaw = raw.items;
  const items: OrderLine[] = Array.isArray(itemsRaw)
    ? itemsRaw.map((item) => {
        if (typeof item === 'string') return { label: item, qty: 1 };
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>;
          const name = String(row.name ?? row.title ?? 'Item');
          const qty = Number(row.qty ?? row.quantity ?? 1) || 1;
          const price = row.price != null ? Number(row.price) : undefined;
          return {
            label: qty > 1 ? `${qty}× ${name}` : name,
            qty,
            price: Number.isFinite(price) ? price : undefined,
          };
        }
        return { label: String(item), qty: 1 };
      })
    : [];
  const address = raw.deliveryAddress ? String(raw.deliveryAddress) : undefined;
  const postcodeRaw = raw.deliveryPostcode ? String(raw.deliveryPostcode).trim() : '';
  const postcodeFromAddress = address?.match(/\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i)?.[1];
  const postcode = (postcodeRaw || postcodeFromAddress || '').toUpperCase().replace(/\s+/g, ' ').trim() || undefined;
  const pay = mapPayment(raw);
  return {
    id: String(raw.id ?? ''),
    number: String(raw.orderNumber ?? raw.number ?? ''),
    customer: String(raw.customerName ?? raw.customer ?? 'Guest'),
    phone: String(raw.customerPhone ?? raw.phone ?? ''),
    type: (String(raw.orderType ?? raw.type ?? 'collection') as FoodOrder['type']),
    status: (String(raw.status ?? 'new') as OrderStatus),
    payment: pay.payment,
    paymentMethod: pay.paymentMethod,
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
  const header = ['number', 'customer', 'phone', 'type', 'status', 'payment', 'method', 'total', 'address', 'postcode', 'items', 'createdAt'];
  const rows = orders.map((o) => [
    o.number,
    o.customer,
    o.phone,
    o.type,
    o.status,
    o.payment,
    o.paymentMethod ?? '',
    o.total.toFixed(2),
    o.address ?? '',
    o.postcode ?? '',
    o.items.map((i) => i.label).join('; '),
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
  tab?: BoardTab;
  showTabs?: boolean;
  embedded?: boolean;
}

function AddressBlock({ order }: { order: FoodOrder }) {
  if (order.type === 'collection' && !order.address && !order.postcode) {
    return (
      <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-600">
        Collection — no address
      </div>
    );
  }
  if (!order.address && !order.postcode) return null;
  return (
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
  );
}

function OrderActions({
  order,
  patchOrder,
  compact,
}: {
  order: FoodOrder;
  patchOrder: (id: string, patch: Partial<FoodOrder>) => Promise<void>;
  compact?: boolean;
}) {
  return (
    <div className={`grid gap-2 ${compact ? 'sm:grid-cols-2' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
      <Button
        type="button"
        className="min-h-[48px] rounded-xl bg-s2d-gold text-base font-bold text-s2d-teal-deep hover:bg-s2d-gold-soft"
        onClick={(e) => {
          e.stopPropagation();
          void patchOrder(order.id, { status: 'coming' });
        }}
      >
        <Receipt className="mr-2 h-4 w-4 shrink-0" />
        Coming to order
      </Button>
      <Button
        type="button"
        className="min-h-[48px] rounded-xl bg-s2d-teal-deep text-base font-bold text-white hover:bg-s2d-teal"
        onClick={(e) => {
          e.stopPropagation();
          void patchOrder(order.id, { status: 'ready' });
        }}
      >
        Mark ready
      </Button>
      {order.type === 'delivery' && order.status === 'ready' && (
        <Button
          type="button"
          className="min-h-[48px] rounded-xl bg-indigo-700 text-base font-bold text-white hover:bg-indigo-600"
          onClick={(e) => {
            e.stopPropagation();
            void patchOrder(order.id, { status: 'delivery' });
          }}
        >
          <Truck className="mr-2 h-4 w-4 shrink-0" />
          Out for delivery
        </Button>
      )}
      {order.payment === 'unpaid' && (
        <>
          <Button
            type="button"
            className="min-h-[48px] rounded-xl bg-emerald-700 text-base font-bold text-white hover:bg-emerald-600"
            onClick={(e) => {
              e.stopPropagation();
              void patchOrder(order.id, { payment: 'paid', paymentMethod: 'cash' });
            }}
          >
            Paid cash
          </Button>
          <Button
            type="button"
            className="min-h-[48px] rounded-xl bg-emerald-800 text-base font-bold text-white hover:bg-emerald-700"
            onClick={(e) => {
              e.stopPropagation();
              void patchOrder(order.id, { payment: 'paid', paymentMethod: 'card' });
            }}
          >
            Paid card
          </Button>
          {!order.paymentMethod && (
            <>
              <Button
                type="button"
                variant="outline"
                className="min-h-[48px] rounded-xl text-sm font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  void patchOrder(order.id, { payment: 'unpaid', paymentMethod: 'cash' });
                }}
              >
                Expect cash
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-[48px] rounded-xl text-sm font-bold"
                onClick={(e) => {
                  e.stopPropagation();
                  void patchOrder(order.id, { payment: 'unpaid', paymentMethod: 'card' });
                }}
              >
                Expect card
              </Button>
            </>
          )}
        </>
      )}
      <Button
        type="button"
        variant="outline"
        className="min-h-[48px] rounded-xl text-base font-bold"
        disabled={!order.phone}
        title={order.phone ? `Call ${order.phone}` : 'No phone on this order'}
        onClick={(e) => {
          e.stopPropagation();
          if (order.phone) window.location.href = `tel:${order.phone}`;
          else toast.error('No phone number on this order');
        }}
      >
        <Phone className="mr-2 h-4 w-4 shrink-0" />
        Call them
      </Button>
      {order.status !== 'completed' && order.status !== 'cancelled' && (
        <Button
          type="button"
          variant="outline"
          className="min-h-[48px] rounded-xl text-sm font-bold"
          onClick={(e) => {
            e.stopPropagation();
            void patchOrder(order.id, { status: 'completed' });
          }}
        >
          Complete
        </Button>
      )}
    </div>
  );
}

export default function RestaurantOrders({ tab: tabProp, showTabs = true, embedded = false }: RestaurantOrdersProps = {}) {
  const [tabState, setTab] = useState<BoardTab>('kitchen');
  const tab = tabProp ?? tabState;
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [nowTick, setNowTick] = useState(0);
  const [audioOk, setAudioOk] = useState(() => isKitchenAudioUnlocked());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setAlertTick] = useState(0);
  const orgId = getActiveOrgId();

  useEffect(() => subscribeKitchenAlerts(() => setAlertTick((n) => n + 1)), []);

  const patchOrder = useCallback(async (id: string, patch: Partial<FoodOrder>) => {
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, ...patch } : order)));
    try {
      const body: Record<string, unknown> = {};
      if (patch.status !== undefined) body.status = patch.status;
      if (patch.payment !== undefined) body.paymentStatus = patch.payment;
      if (patch.paymentMethod !== undefined) body.paymentMethod = patch.paymentMethod;
      const res = await fetch(`/api/orders/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(orgId ? { 'x-org-id': orgId } : {}),
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      if (patch.payment === 'paid') toast.success(`Marked paid${patch.paymentMethod ? ` (${patch.paymentMethod})` : ''}`);
      else if (patch.status) toast.success(statusLabel(patch.status));
      else if (patch.paymentMethod) toast.success(`Expect ${patch.paymentMethod} on arrival`);
    } catch {
      toast.error('Could not update order — check connection');
    }
  }, [orgId]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowTick((n) => n + 1), 15_000);
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
        if (bootstrapSeenIfEmpty(next.map((o) => o.id))) {
          setOrders(next);
          return;
        }
        const freshIds = getUnseenNewOrders(next);
        if (freshIds.length > 0) {
          noteOrdersSeen(next.map((o) => o.id), freshIds);
          const first = next.find((o) => o.id === freshIds[0]);
          toast.message(`New order${freshIds.length > 1 ? `s (${freshIds.length})` : ''}`, {
            description: first ? `#${first.number} · ${first.customer}` : undefined,
          });
        } else {
          noteOrdersSeen(next.map((o) => o.id), []);
        }
        setOrders(next);
      } catch {
        /* keep last list */
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

  const selected = selectedId ? orders.find((o) => o.id === selectedId) ?? null : null;

  const openOrder = (order: FoodOrder) => {
    acknowledgeOrderFlash(order.id);
    setSelectedId(order.id);
  };

  return (
    <main className={embedded ? '' : 'min-h-full bg-s2d-cream p-3 sm:p-5'}>
      <section className="mx-auto max-w-7xl">
        {!embedded && (
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
        )}

        {embedded && (
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-black text-s2d-teal-deep">Orders right now</h2>
            {!audioOk && (
              <Button
                type="button"
                size="sm"
                className="rounded-xl bg-s2d-gold font-bold text-s2d-teal-deep"
                onClick={() => {
                  unlockKitchenAudio();
                  setAudioOk(true);
                  toast.success('Kitchen sound on');
                }}
              >
                <Volume2 className="mr-2 h-4 w-4" />
                Tap to enable kitchen sound
              </Button>
            )}
          </div>
        )}

        {!embedded && !audioOk && (
          <button
            type="button"
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950"
            onClick={() => {
              unlockKitchenAudio();
              setAudioOk(true);
              toast.success('Kitchen sound on');
            }}
          >
            <Volume2 className="h-4 w-4" />
            Tap to enable kitchen sound for new orders
          </button>
        )}

        {visibleOrders.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-s2d-teal/30 bg-white/70 p-10 text-center">
            <p className="text-xl font-bold text-s2d-teal-deep">No orders on this board right now</p>
            <p className="mt-1 text-s2d-teal-soft">New phone and kiosk orders appear here with a kitchen alert.</p>
          </div>
        )}

        <div className="grid gap-3 lg:grid-cols-2">
          {visibleOrders.map((order) => {
            const pay = paymentBadge(order);
            const flashing = isOrderFlashing(order.id) || order.status === 'new';
            const unpaidAttention = order.payment === 'unpaid' && order.type === 'delivery';
            const preview = order.items.slice(0, 4);
            const more = Math.max(0, order.items.length - preview.length);
            return (
              <article
                key={order.id}
                role="button"
                tabIndex={0}
                onClick={() => openOrder(order)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openOrder(order);
                  }
                }}
                className={`cursor-pointer rounded-[1.5rem] border bg-white p-4 shadow-sm transition outline-none focus-visible:ring-2 focus-visible:ring-s2d-teal ${
                  flashing
                    ? 'border-s2d-gold animate-pulse ring-2 ring-s2d-gold/70'
                    : unpaidAttention
                      ? 'border-red-300 ring-2 ring-red-200/80'
                      : 'border-slate-200 hover:border-s2d-teal/40'
                }`}
              >
                <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
                  <div>
                    <p className="text-sm font-bold uppercase tracking-wide text-slate-500">Order #{order.number}</p>
                    <h2 className="text-2xl font-black text-slate-950">{order.customer}</h2>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-semibold text-slate-600">
                      <span className="rounded-lg bg-slate-100 px-2 py-0.5 capitalize">{order.type}</span>
                      {order.phone ? (
                        <a
                          href={`tel:${order.phone}`}
                          className="inline-flex items-center gap-1 text-s2d-teal-deep hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {order.phone}
                        </a>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="rounded-xl bg-s2d-teal-deep px-3 py-1 text-white">{statusLabel(order.status)}</Badge>
                    <Badge className={pay.className}>{pay.label}</Badge>
                  </div>
                </header>

                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
                  <div className="space-y-2">
                    {preview.map((item, idx) => (
                      <div key={`${item.label}-${idx}`} className="rounded-xl bg-slate-50 px-3 py-2 text-lg font-semibold text-slate-900">
                        {item.label}
                        {item.price != null ? (
                          <span className="ml-2 text-sm font-medium text-slate-500">£{item.price.toFixed(2)}</span>
                        ) : null}
                      </div>
                    ))}
                    {more > 0 && (
                      <p className="text-sm font-bold text-s2d-teal-deep">+{more} more — open</p>
                    )}
                    <AddressBlock order={order} />
                    {(order.specialName || order.notes) && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                        {order.specialName ? <p>Special: {order.specialName}</p> : null}
                        {order.notes ? <p className="mt-0.5 line-clamp-2 text-amber-900/80 font-medium">{order.notes}</p> : null}
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

                <footer className="mt-4" onClick={(e) => e.stopPropagation()}>
                  <OrderActions order={order} patchOrder={patchOrder} compact />
                </footer>
              </article>
            );
          })}
        </div>
      </section>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto rounded-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-2xl font-black">
                  Order #{selected.number}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xl font-black text-slate-950">{selected.customer}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className="rounded-xl bg-s2d-teal-deep px-3 py-1 text-white capitalize">{selected.type}</Badge>
                    <Badge className="rounded-xl bg-s2d-teal-deep px-3 py-1 text-white">{statusLabel(selected.status)}</Badge>
                    <Badge className={paymentBadge(selected).className}>{paymentBadge(selected).label}</Badge>
                  </div>
                  {selected.phone ? (
                    <a href={`tel:${selected.phone}`} className="mt-2 inline-flex items-center gap-1 font-semibold text-s2d-teal-deep hover:underline">
                      <Phone className="h-4 w-4" />
                      {selected.phone}
                    </a>
                  ) : null}
                </div>

                <AddressBlock order={selected} />

                <div>
                  <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Items</p>
                  <ul className="max-h-64 space-y-2 overflow-y-auto">
                    {selected.items.map((item, idx) => (
                      <li key={`${item.label}-${idx}`} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-base font-semibold">
                        <span>{item.label}</span>
                        {item.price != null ? <span className="text-slate-600">£{item.price.toFixed(2)}</span> : null}
                      </li>
                    ))}
                  </ul>
                </div>

                {(selected.specialName || selected.notes) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950">
                    {selected.specialName ? <p>Meal deal / special: {selected.specialName}</p> : null}
                    {selected.notes ? <p className="mt-1 font-medium text-amber-900/80">{selected.notes}</p> : null}
                  </div>
                )}

                <div className="rounded-2xl bg-slate-950 p-4 text-center text-white">
                  <p className="text-sm text-slate-300">{deliveryTimerLabel(selected)}</p>
                  <p className="mt-2 text-3xl font-black">£{selected.total.toFixed(2)}</p>
                </div>

                <OrderActions order={selected} patchOrder={patchOrder} />

                <Button type="button" variant="ghost" className="w-full" onClick={() => setSelectedId(null)}>
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
