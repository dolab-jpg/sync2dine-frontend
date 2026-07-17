import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { Wallet, AlertCircle, Banknote, CreditCard } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { getActiveOrgId } from '../../engine/platform/orgContext';

type OrderRow = {
  id: string;
  orderNumber?: number | string;
  number?: string;
  customerName?: string;
  customer?: string;
  paymentStatus?: string;
  paymentMethod?: string | null;
  payment?: string;
  total?: number;
  orderType?: string;
  type?: string;
  createdAt?: string;
  status?: string;
};

function isPaid(o: OrderRow): boolean {
  const s = String(o.paymentStatus ?? o.payment ?? 'unpaid').toLowerCase();
  return s === 'paid' || s === 'cash' || s === 'card';
}

function payMethod(o: OrderRow): 'cash' | 'card' | null {
  const s = String(o.paymentStatus ?? o.payment ?? '').toLowerCase();
  if (s === 'cash' || s === 'card') return s;
  const m = String(o.paymentMethod ?? '').toLowerCase();
  if (m === 'cash' || m === 'card') return m;
  return null;
}

function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * Restaurant Accounts lite — today's takings + unpaid list (not TradePro job costing).
 */
export default function RestaurantAccounts() {
  const navigate = useNavigate();
  const orgId = getActiveOrgId();
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [stripeHint, setStripeHint] = useState<string>('Not checked');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/orders', {
          headers: orgId ? { 'x-org-id': orgId } : {},
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json() as { orders?: OrderRow[] };
        if (!cancelled) setOrders(Array.isArray(data.orders) ? data.orders : []);
      } catch {
        if (!cancelled) setOrders([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/integrations');
        if (!res.ok) {
          if (!cancelled) setStripeHint('Open Settings → Integrations');
          return;
        }
        const data = await res.json() as { integrations?: Array<{ id?: string; connected?: boolean; name?: string }> };
        const stripe = (data.integrations ?? []).find((i) => /stripe/i.test(String(i.id ?? i.name ?? '')));
        if (!cancelled) {
          setStripeHint(stripe?.connected ? 'Stripe connected' : 'Stripe not connected — see Settings → Integrations');
        }
      } catch {
        if (!cancelled) setStripeHint('Open Settings → Integrations');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const todayStart = startOfTodayIso();

  const stats = useMemo(() => {
    const today = orders.filter((o) => String(o.createdAt ?? '') >= todayStart);
    const unpaid = orders.filter((o) => !isPaid(o) && o.status !== 'cancelled');
    let cash = 0;
    let card = 0;
    let paidTotal = 0;
    for (const o of today) {
      if (!isPaid(o)) continue;
      const t = Number(o.total ?? 0);
      paidTotal += t;
      const m = payMethod(o);
      if (m === 'cash') cash += t;
      else if (m === 'card') card += t;
    }
    return {
      todayCount: today.length,
      paidTotal,
      cash,
      card,
      unpaid,
    };
  }, [orders, todayStart]);

  return (
    <div className="min-h-full bg-s2d-cream p-3 sm:p-5">
      <section className="mx-auto max-w-5xl space-y-4">
        <div className="rounded-[1.75rem] bg-s2d-teal-deep p-4 text-white shadow-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-s2d-gold">Accounts</p>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-black tracking-tight">
            <Wallet className="h-8 w-8 text-s2d-gold" />
            Today&apos;s money
          </h1>
          <p className="mt-1 text-sm text-s2d-cream/80">{stripeHint}</p>
        </div>

        {loading ? (
          <p className="rounded-2xl bg-white p-6 font-semibold text-slate-600">Loading orders…</p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-500">Orders today</p>
                <p className="mt-1 text-3xl font-black text-slate-950">{stats.todayCount}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-sm font-bold text-slate-500">Paid takings</p>
                <p className="mt-1 text-3xl font-black text-emerald-700">£{stats.paidTotal.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1 text-sm font-bold text-slate-500">
                  <Banknote className="h-4 w-4" /> Cash paid
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">£{stats.cash.toFixed(2)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="flex items-center gap-1 text-sm font-bold text-slate-500">
                  <CreditCard className="h-4 w-4" /> Card paid
                </p>
                <p className="mt-1 text-3xl font-black text-slate-950">£{stats.card.toFixed(2)}</p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h2 className="text-xl font-black text-slate-950">Unpaid orders</h2>
                <Badge className="rounded-lg bg-red-600 text-white">{stats.unpaid.length}</Badge>
              </div>
              {stats.unpaid.length === 0 ? (
                <p className="text-sm font-semibold text-slate-500">Nothing unpaid right now.</p>
              ) : (
                <ul className="space-y-2">
                  {stats.unpaid.slice(0, 40).map((o) => {
                    const num = o.orderNumber ?? o.number ?? '—';
                    const name = o.customerName ?? o.customer ?? 'Guest';
                    const type = o.orderType ?? o.type ?? '';
                    return (
                      <li
                        key={o.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2"
                      >
                        <div>
                          <p className="font-bold text-slate-900">#{num} · {name}</p>
                          <p className="text-sm capitalize text-slate-500">{type} · £{Number(o.total ?? 0).toFixed(2)}</p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          className="rounded-xl bg-s2d-teal-deep font-bold text-white"
                          onClick={() => navigate(type === 'delivery' ? '/orders/delivery' : '/orders/kitchen')}
                        >
                          Open board
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
