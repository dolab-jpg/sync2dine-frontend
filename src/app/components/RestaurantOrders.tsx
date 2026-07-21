import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, ChevronDown, Clock, Download, MapPin, MoreHorizontal, Phone, Truck, Utensils, Volume2, X,
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
  setBoardBadgeCounts,
  setOverdueAlertIds,
  subscribeKitchenAlerts,
  unlockKitchenAudio,
} from '../engine/restaurant/kitchenAlertStore';
import {
  boardStage,
  normalizeKitchenStatus,
  primaryBump,
  slaTier,
  stageLabel,
  statusLabel,
  type BoardStage,
  type FoodOrder,
  type OrderLine,
  type OrderSource,
  type OrderStatus,
  type PayMethod,
  type PayStatus,
} from '../engine/restaurant/foodOrderTypes';
import { ALLERGEN_LABELS, normalizeAllergenCodes, type AllergenCode } from '../engine/restaurant/allergens';
import CallRecordingPlayer, { CallRecordingBadge } from './restaurant/CallRecordingPlayer';
import CallContextChip from './restaurant/CallContextChip';
import OrderPosSyncBadge from './restaurant/OrderPosSyncBadge';

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
        if (typeof item === 'string') return { label: item, qty: 1, name: item };
        if (item && typeof item === 'object') {
          const row = item as Record<string, unknown>;
          const name = String(row.name ?? row.title ?? 'Item');
          const qty = Number(row.qty ?? row.quantity ?? 1) || 1;
          const price = row.price != null ? Number(row.price) : undefined;
          const dealName = row.dealName != null ? String(row.dealName) : undefined;
          const dealIndex = row.dealIndex != null ? Number(row.dealIndex) : undefined;
          const role = row.role != null ? String(row.role) : undefined;
          const roleHint = role ? ` (${role})` : '';
          const dealHint = dealName && dealIndex ? ` · ${dealName} #${dealIndex}` : dealName ? ` · ${dealName}` : '';
          const allergensContains = normalizeAllergenCodes(
            row.allergensContains ?? row.allergens_contains ?? row.allergens,
          );
          return {
            label: (qty > 1 ? `${qty}× ${name}` : name) + roleHint + dealHint,
            qty,
            price: Number.isFinite(price) ? price : undefined,
            dealName,
            dealIndex,
            role,
            name,
            allergensContains,
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
  const sourceRaw = String(raw.source ?? raw.channel ?? '').toLowerCase();
  const source = (['phone', 'kiosk', 'whatsapp', 'sync2dine', 'deliverect', 'otter', 'custom'].includes(sourceRaw)
    ? sourceRaw
    : undefined) as OrderSource | undefined;
  return {
    id: String(raw.id ?? ''),
    number: String(raw.orderNumber ?? raw.number ?? ''),
    customer: String(raw.customerName ?? raw.customer ?? 'Guest'),
    phone: String(raw.customerPhone ?? raw.phone ?? ''),
    type: (String(raw.orderType ?? raw.type ?? 'collection') as FoodOrder['type']),
    status: normalizeKitchenStatus(String(raw.status ?? 'new')),
    payment: pay.payment,
    paymentMethod: pay.paymentMethod,
    total: Number(raw.total ?? 0),
    address,
    postcode,
    specialName: raw.specialName ? String(raw.specialName) : undefined,
    notes: raw.notes ? String(raw.notes) : undefined,
    items,
    createdAt: String(raw.createdAt ?? raw.placedAt ?? new Date().toISOString()),
    etaMinutes: raw.etaMinutes != null ? Number(raw.etaMinutes) : undefined,
    customerAllergies: raw.customerAllergies != null ? String(raw.customerAllergies) : undefined,
    allergyConfirmed: raw.allergyConfirmed === true,
    source,
    channelLabel: raw.channelLabel != null ? String(raw.channelLabel) : undefined,
    externalId: raw.externalId != null ? String(raw.externalId) : undefined,
    sourceStatus: raw.sourceStatus != null ? String(raw.sourceStatus) : undefined,
    syncState: raw.syncState as FoodOrder['syncState'],
    dueAt: raw.dueAt != null ? String(raw.dueAt) : undefined,
    placedAt: raw.placedAt != null ? String(raw.placedAt) : undefined,
    sourceCallId: raw.sourceCallId != null ? String(raw.sourceCallId) : (raw.callId != null ? String(raw.callId) : undefined),
    callId: raw.callId != null ? String(raw.callId) : undefined,
    recordingUrl: raw.recordingUrl != null ? String(raw.recordingUrl) : undefined,
    listenUrl: raw.listenUrl != null ? String(raw.listenUrl) : undefined,
    callIds: Array.isArray(raw.callIds) ? raw.callIds.map(String) : undefined,
  };
}

function exportOrdersCsv(orders: FoodOrder[]) {
  const header = ['number', 'customer', 'phone', 'type', 'status', 'payment', 'method', 'total', 'address', 'postcode', 'allergies', 'source', 'items', 'createdAt'];
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
    o.customerAllergies ?? '',
    o.source ?? '',
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

function sourceBadge(order: FoodOrder): string | null {
  if (order.channelLabel) return order.channelLabel;
  if (!order.source) return null;
  const map: Record<string, string> = {
    phone: 'Phone',
    kiosk: 'Kiosk',
    whatsapp: 'WhatsApp',
    deliverect: 'Deliverect',
    otter: 'Otter',
    sync2dine: 'Sync2Dine',
    custom: 'Connector',
  };
  return map[order.source] ?? order.source;
}

export type BoardTab = 'kitchen' | 'delivery';

interface RestaurantOrdersProps {
  tab?: BoardTab;
  showTabs?: boolean;
  embedded?: boolean;
}

const HISTORY_KEY = 's2d.orders.showHistory';
const DONE_HIDE_MS = 8 * 60_000;

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

/** Compact item list — denser on delivery so ~15 lines stay readable. */
function OrderItemsList({
  items,
  dense,
  maxHeightClass,
  showAllergens,
}: {
  items: OrderLine[];
  dense?: boolean;
  maxHeightClass?: string;
  showAllergens?: boolean;
}) {
  return (
    <ul className={`${dense ? 'space-y-px' : 'space-y-1'} ${maxHeightClass ?? ''} ${maxHeightClass ? 'overflow-y-auto pr-1' : ''}`}>
      {items.map((item, idx) => (
        <li
          key={`${item.label}-${idx}`}
          className={`flex flex-col border-l-2 bg-slate-50 font-semibold text-slate-900 ${
            item.dealName ? 'border-amber-400' : 'border-slate-200'
          } ${dense ? 'rounded-md px-2 py-0.5 text-[13px]' : 'rounded-lg px-3 py-1.5 text-lg'}`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="min-w-0 leading-tight">{item.label}</span>
            {item.price != null ? (
              <span className={`shrink-0 font-bold text-slate-600 ${dense ? 'text-sm' : 'text-sm'}`}>
                £{item.price.toFixed(2)}
              </span>
            ) : null}
          </div>
          {showAllergens && item.allergensContains && item.allergensContains.length > 0 ? (
            <p className="text-[11px] font-bold uppercase tracking-wide text-amber-800">
              {(item.allergensContains as AllergenCode[]).map((c) => ALLERGEN_LABELS[c] ?? c).join(' · ')}
            </p>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function AllergyBanner({ text }: { text: string }) {
  return (
    <div
      className="flex items-start gap-2 rounded-xl border-2 border-red-500 bg-red-50 px-3 py-2 text-sm font-black text-red-950"
      data-testid="customer-allergy-banner"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <span>Allergy: {text}</span>
    </div>
  );
}

function SlaChip({ order }: { order: FoodOrder }) {
  const tier = slaTier(order);
  const cls =
    tier === 'overdue'
      ? 'bg-red-600 text-white'
      : tier === 'warn'
        ? 'bg-amber-400 text-amber-950'
        : 'bg-emerald-100 text-emerald-900';
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-bold ${cls}`}>
      <Clock className="h-3 w-3" />
      {deliveryTimerLabel(order)}
    </span>
  );
}

function SecondaryActions({
  order,
  patchOrder,
  onOpenMore,
}: {
  order: FoodOrder;
  patchOrder: (id: string, patch: Partial<FoodOrder>) => Promise<void>;
  onOpenMore?: () => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {order.payment === 'unpaid' && (
        <>
          <Button
            type="button"
            className="min-h-12 rounded-xl bg-emerald-700 text-sm font-bold text-white"
            onClick={(e) => {
              e.stopPropagation();
              void patchOrder(order.id, { payment: 'paid', paymentMethod: 'cash' });
            }}
          >
            Paid cash
          </Button>
          <Button
            type="button"
            className="min-h-12 rounded-xl bg-emerald-800 text-sm font-bold text-white"
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
                className="min-h-12 rounded-xl text-sm font-bold"
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
                className="min-h-12 rounded-xl text-sm font-bold"
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
        className="min-h-12 rounded-xl text-sm font-bold"
        disabled={!order.phone}
        onClick={(e) => {
          e.stopPropagation();
          if (order.phone) window.location.href = `tel:${order.phone}`;
          else toast.error('No phone number on this order');
        }}
      >
        <Phone className="mr-2 h-4 w-4" />
        Call them
      </Button>
      {order.status !== 'completed' && order.status !== 'cancelled' && (
        <>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 rounded-xl text-sm font-bold"
            onClick={(e) => {
              e.stopPropagation();
              void patchOrder(order.id, { status: 'completed' });
            }}
          >
            Complete
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 rounded-xl text-sm font-bold text-red-700 border-red-200 hover:bg-red-50"
            onClick={(e) => {
              e.stopPropagation();
              if (!window.confirm(`Cancel order #${order.number ?? order.id}?`)) return;
              void patchOrder(order.id, { status: 'cancelled' });
            }}
          >
            Cancel
          </Button>
        </>
      )}
      {onOpenMore && (
        <Button type="button" variant="ghost" className="min-h-12 sm:col-span-2" onClick={onOpenMore}>
          <MoreHorizontal className="mr-2 h-4 w-4" />
          Open details
        </Button>
      )}
    </div>
  );
}

function OrderCard({
  order,
  patchOrder,
  openOrder,
}: {
  order: FoodOrder;
  patchOrder: (id: string, patch: Partial<FoodOrder>) => Promise<void>;
  openOrder: (order: FoodOrder) => void;
}) {
  const pay = paymentBadge(order);
  const flashing = isOrderFlashing(order.id);
  const unpaidAttention = order.payment === 'unpaid' && order.type === 'delivery';
  const bump = primaryBump(order);
  const src = sourceBadge(order);
  const tier = slaTier(order);

  const rawCustomer = order.customer && !/^guest$/i.test(order.customer) ? order.customer.trim() : 'Guest';
  // Notes/specials sometimes land in customerName — never show those as the title.
  const looksLikeNote = rawCustomer !== 'Guest' && (
    /^(huge|large|big)\b/i.test(rawCustomer)
    || /\b(party delivery|party collection|meal deal)\b/i.test(rawCustomer)
    || (rawCustomer.length > 48 && !/^[A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,3}$/.test(rawCustomer))
  );
  const customerName = looksLikeNote
    ? (order.phone ? `Guest · ${order.phone}` : 'Guest')
    : rawCustomer;
  const noteAsSpecial = looksLikeNote ? rawCustomer : order.specialName;

  const canListen = Boolean(order.listenUrl || order.recordingUrl || order.sourceCallId);

  return (
    <article
      role="button"
      tabIndex={0}
      data-testid={`order-card-${order.id}`}
      data-order-source={order.source || 'local'}
      data-external-id={order.externalId || ''}
      onClick={() => openOrder(order)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openOrder(order);
        }
      }}
      className={`flex h-[13.5rem] cursor-pointer flex-col gap-1.5 rounded-2xl border bg-white p-2.5 shadow-sm transition outline-none focus-visible:ring-2 focus-visible:ring-s2d-teal ${
        flashing
          ? 'border-s2d-gold animate-pulse ring-2 ring-s2d-gold/70'
          : unpaidAttention
            ? 'border-red-300 ring-2 ring-red-200/80'
            : tier === 'overdue'
              ? 'border-red-400'
              : 'border-slate-200 hover:border-s2d-teal/40'
      }`}
    >
      <header className="flex shrink-0 items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">#{order.number}</p>
          <h2
            className={`truncate text-base font-black leading-tight ${canListen ? 'text-s2d-teal-deep underline decoration-dotted underline-offset-2 hover:text-s2d-teal' : 'text-slate-950'}`}
            title={canListen ? 'Open to listen to the call' : customerName}
          >
            {customerName}
            {canListen ? <span className="ml-1 text-[10px] font-bold text-s2d-teal">▶</span> : null}
          </h2>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          <div className="rounded-lg bg-slate-950 px-2.5 py-0.5 text-center text-white">
            <p className="text-base font-black leading-tight">£{order.total.toFixed(2)}</p>
          </div>
          <SlaChip order={order} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        <div className="flex shrink-0 flex-wrap items-center gap-1 text-[10px] font-semibold text-slate-600">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 capitalize">{order.type}</span>
          <Badge className="rounded-md bg-s2d-teal-deep px-1.5 py-0.5 text-[10px] text-white">{statusLabel(order.status)}</Badge>
          <Badge className={`${pay.className} !px-1.5 !py-0.5 !text-[10px]`}>{pay.label}</Badge>
          {src ? <span className="rounded-md bg-indigo-100 px-1.5 py-0.5 text-indigo-900">{src}</span> : null}
          {order.syncState && order.syncState !== 'local' ? (
            <span onClick={(e) => e.stopPropagation()}>
              <OrderPosSyncBadge
                orderId={order.id}
                syncState={order.syncState}
                externalId={order.externalId}
                compact
              />
            </span>
          ) : null}
        </div>
        {order.customerAllergies ? (
          <div className="flex shrink-0 items-center gap-1 rounded-md border border-red-400 bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-900">
            <AlertTriangle className="h-3 w-3 shrink-0" />
            <span className="truncate">Allergy: {order.customerAllergies}</span>
          </div>
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <OrderItemsList
            items={order.items}
            dense
            showAllergens
            maxHeightClass="h-full"
          />
        </div>
        {noteAsSpecial ? (
          <p className="shrink-0 truncate text-[10px] font-semibold text-amber-800">Special: {noteAsSpecial}</p>
        ) : order.notes ? (
          <p className="shrink-0 truncate text-[10px] font-medium text-amber-800/80">{order.notes}</p>
        ) : null}
      </div>

      <footer className="shrink-0 border-t border-slate-100 pt-1.5" onClick={(e) => e.stopPropagation()}>
        {bump ? (
          <Button
            type="button"
            data-testid={`order-bump-${order.id}`}
            className="min-h-9 w-full rounded-xl bg-s2d-gold text-sm font-bold text-s2d-teal-deep hover:bg-s2d-gold-soft"
            onClick={() => void patchOrder(order.id, { status: bump.status })}
          >
            {order.type === 'delivery' && bump.status === 'delivery' ? (
              <Truck className="mr-1 h-3.5 w-3.5" />
            ) : null}
            {bump.label}
          </Button>
        ) : null}
      </footer>
    </article>
  );
}

export default function RestaurantOrders({ tab: tabProp, showTabs = true, embedded = false }: RestaurantOrdersProps = {}) {
  const [tabState, setTab] = useState<BoardTab>('kitchen');
  const tab = tabProp ?? tabState;
  const [orders, setOrders] = useState<FoodOrder[]>([]);
  const [ordersLoaded, setOrdersLoaded] = useState(false);
  const [nowTick, setNowTick] = useState(0);
  const [audioOk, setAudioOk] = useState(() => isKitchenAudioUnlocked());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [, setAlertTick] = useState(0);
  const [showHistory, setShowHistory] = useState(() => {
    try {
      return localStorage.getItem(HISTORY_KEY) === '1';
    } catch {
      return false;
    }
  });
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
      else if (patch.status) toast.success(statusLabel(patch.status as OrderStatus));
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
    let pollMs = 8_000;

    async function loadOrders() {
      try {
        const res = await fetch('/api/orders', {
          headers: orgId ? { 'x-org-id': orgId } : {},
        });
        if (!res.ok) {
          pollMs = Math.min(20_000, pollMs + 2_000);
          if (!cancelled) setOrdersLoaded(true);
          return;
        }
        pollMs = 8_000;
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
        pollMs = Math.min(20_000, pollMs + 2_000);
      } finally {
        if (!cancelled) setOrdersLoaded(true);
      }
    }

    void loadOrders();
    const poll = window.setInterval(() => void loadOrders(), pollMs);

    // Prefer Supabase realtime when available; keep polling as resilient fallback.
    let channel: { unsubscribe: () => void } | null = null;
    void import('../../lib/supabase/client').then(({ getSupabase, isSupabaseConfigured }) => {
      if (!isSupabaseConfigured()) return;
      try {
        const supabase = getSupabase();
        channel = supabase
          .channel(`s2d-orders-${orgId || 'default'}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
            void loadOrders();
          })
          .subscribe();
      } catch {
        /* polling only */
      }
    }).catch(() => { /* no supabase client */ });

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      channel?.unsubscribe();
    };
  }, [orgId]);

  const boardOrders = useMemo(() => {
    void nowTick;
    const base = tab === 'delivery' ? orders.filter((o) => o.type === 'delivery') : orders;
    const now = Date.now();
    return base.filter((o) => {
      const stage = boardStage(o, tab);
      if (stage !== 'done') return true;
      if (showHistory) return true;
      const ended = Date.parse(o.createdAt);
      // Hide completed/cancelled after short delay unless history toggle on
      if (!Number.isFinite(ended)) return false;
      return now - ended < DONE_HIDE_MS && normalizeKitchenStatus(o.status) !== 'cancelled';
    });
  }, [orders, tab, nowTick, showHistory]);

  const stages: BoardStage[] = tab === 'delivery'
    ? ['new', 'cooking', 'ready', 'out', 'done']
    : ['new', 'cooking', 'ready', 'done'];

  const byStage = useMemo(() => {
    const map = new Map<BoardStage, FoodOrder[]>();
    for (const s of stages) map.set(s, []);
    for (const o of boardOrders) {
      const s = boardStage(o, tab);
      if (!map.has(s)) map.set(s, []);
      map.get(s)!.push(o);
    }
    return map;
  }, [boardOrders, tab, stages]);

  useEffect(() => {
    const overdue = boardOrders.filter((o) => slaTier(o) === 'overdue' && boardStage(o, tab) !== 'done');
    setOverdueAlertIds(overdue.map((o) => o.id));
    const news = boardOrders.filter((o) => boardStage(o, tab) === 'new').length;
    const overdueN = overdue.length;
    if (tab === 'delivery') {
      setBoardBadgeCounts({ deliveryNew: news, deliveryOverdue: overdueN });
    } else {
      setBoardBadgeCounts({ kitchenNew: news, kitchenOverdue: overdueN });
    }
  }, [boardOrders, tab]);

  const alertCounts = useMemo(() => {
    const news = boardOrders.filter((o) => boardStage(o, tab) === 'new').length;
    const overdue = boardOrders.filter((o) => slaTier(o) === 'overdue' && boardStage(o, tab) !== 'done').length;
    const unpaid = boardOrders.filter((o) => o.payment === 'unpaid' && o.type === 'delivery').length;
    const allergy = boardOrders.filter((o) => Boolean(o.customerAllergies)).length;
    return { news, overdue, unpaid, allergy };
  }, [boardOrders, tab]);

  const selected = selectedId ? orders.find((o) => o.id === selectedId) ?? null : null;

  const openOrder = (order: FoodOrder) => {
    acknowledgeOrderFlash(order.id);
    setSelectedId(order.id);
  };

  const toggleHistory = () => {
    setShowHistory((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(HISTORY_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  return (
    <main className={embedded ? '' : 'min-h-full bg-s2d-cream p-3 sm:p-5'} data-testid="restaurant-orders-board">
      <section className="mx-auto max-w-7xl">
        {!embedded && (
          <div className="mb-4 rounded-[1.75rem] bg-s2d-teal-deep p-4 text-white shadow-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-s2d-gold">Sync2Dine staff tablet</p>
                <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                  {showTabs ? 'Kitchen and delivery' : tab === 'delivery' ? 'Delivery board' : 'Kitchen board'}
                </h1>
                <p className="mt-2 text-sm font-semibold text-s2d-cream/90" data-testid="orders-alert-strip">
                  {alertCounts.news} new · {alertCounts.overdue} overdue · {alertCounts.unpaid} unpaid delivery · {alertCounts.allergy} allergy
                </p>
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
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[52px] rounded-xl border-white/30 bg-white/10 text-base font-bold text-white hover:bg-white/20"
                  onClick={toggleHistory}
                >
                  {showHistory ? 'Hide history' : 'Show history'}
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
            <p className="text-xs font-bold text-slate-600" data-testid="orders-alert-strip">
              {alertCounts.news} new · {alertCounts.overdue} overdue · {alertCounts.allergy} allergy
            </p>
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

        {!ordersLoaded && (
          <div className="rounded-[1.5rem] border border-dashed border-s2d-teal/30 bg-white/70 p-10 text-center">
            <p className="text-xl font-bold text-s2d-teal-deep">Loading orders…</p>
          </div>
        )}
        {ordersLoaded && boardOrders.length === 0 && (
          <div className="rounded-[1.5rem] border border-dashed border-s2d-teal/30 bg-white/70 p-10 text-center">
            <p className="text-xl font-bold text-s2d-teal-deep">No orders on this board right now</p>
            <p className="mt-1 text-s2d-teal-soft">New phone and kiosk orders appear here with a kitchen alert.</p>
          </div>
        )}

        {/* <lg: vertical sections · lg+: kanban */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-3 lg:overflow-x-auto">
          {stages.map((stage) => {
            const list = byStage.get(stage) ?? [];
            if (stage === 'done' && !showHistory && list.length === 0) return null;
            return (
              <section
                key={stage}
                data-testid={`orders-stage-${stage}`}
                className="min-w-0 flex-1 lg:min-w-[16rem] lg:max-w-[20rem]"
              >
                <header className="sticky top-0 z-[1] mb-2 flex items-center justify-between rounded-xl bg-s2d-teal-deep/95 px-3 py-2 text-white backdrop-blur">
                  <h3 className="text-sm font-black uppercase tracking-wide">{stageLabel(stage, tab)}</h3>
                  <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-bold">{list.length}</span>
                </header>
                <div className="grid gap-2">
                  {list.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      patchOrder={patchOrder}
                      openOrder={openOrder}
                    />
                  ))}
                  {list.length === 0 && (
                    <p className="rounded-xl border border-dashed border-slate-200 px-3 py-6 text-center text-sm text-slate-400">
                      Empty
                    </p>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </section>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto rounded-2xl">
          {selected && (() => {
            const detailName = selected.customer && !/^guest$/i.test(selected.customer) ? selected.customer : 'Guest';
            return (
            <>
              <DialogHeader>
                <DialogTitle className="pr-8 text-2xl font-black">
                  Order #{selected.number}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-xl font-black text-slate-950">{detailName}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge className="rounded-xl bg-s2d-teal-deep px-3 py-1 text-white capitalize">{selected.type}</Badge>
                    <Badge className="rounded-xl bg-s2d-teal-deep px-3 py-1 text-white">{statusLabel(selected.status)}</Badge>
                    <Badge className={paymentBadge(selected).className}>{paymentBadge(selected).label}</Badge>
                    {sourceBadge(selected) ? (
                      <Badge className="rounded-xl bg-indigo-100 px-3 py-1 text-indigo-900">{sourceBadge(selected)}</Badge>
                    ) : null}
                    <CallRecordingBadge recordingUrl={selected.recordingUrl} />
                    <OrderPosSyncBadge
                      orderId={selected.id}
                      syncState={selected.syncState}
                      externalId={selected.externalId}
                    />
                  </div>
                  {selected.phone ? (
                    <a href={`tel:${selected.phone}`} className="mt-2 inline-flex items-center gap-1 font-semibold text-s2d-teal-deep hover:underline">
                      <Phone className="h-4 w-4" />
                      {selected.phone}
                    </a>
                  ) : null}
                </div>

                {selected.customerAllergies ? <AllergyBanner text={selected.customerAllergies} /> : null}
                <AddressBlock order={selected} />
                {(selected.sourceCallId || selected.recordingUrl || selected.listenUrl) ? (
                  <CallContextChip
                    callId={selected.sourceCallId}
                    phone={selected.phone}
                    contactName={detailName}
                    isGuest={/^guest$/i.test(detailName)}
                    listenUrl={selected.listenUrl}
                    recordingUrl={selected.recordingUrl}
                  />
                ) : null}
                <CallRecordingPlayer recordingUrl={selected.recordingUrl} testId={`order-detail-recording-${selected.id}`} />

                <div>
                  <p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Items</p>
                  <OrderItemsList
                    items={selected.items}
                    dense={selected.type === 'delivery' || selected.items.length > 6}
                    showAllergens
                    maxHeightClass="max-h-72"
                  />
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

                {primaryBump(selected) && (
                  <Button
                    type="button"
                    className="min-h-12 w-full rounded-xl bg-s2d-gold font-bold text-s2d-teal-deep"
                    onClick={() => {
                      const bump = primaryBump(selected);
                      if (bump) void patchOrder(selected.id, { status: bump.status });
                    }}
                  >
                    {primaryBump(selected)!.label}
                  </Button>
                )}
                <SecondaryActions order={selected} patchOrder={patchOrder} />

                <Button type="button" variant="ghost" className="min-h-12 w-full" onClick={() => setSelectedId(null)}>
                  <X className="mr-2 h-4 w-4" />
                  Close
                </Button>
              </div>
            </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </main>
  );
}
