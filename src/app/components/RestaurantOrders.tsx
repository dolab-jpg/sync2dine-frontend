import { useMemo, useState } from 'react';
import { Clock, CreditCard, MapPin, Phone, Receipt, Truck, Utensils } from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';

type OrderStatus = 'new' | 'coming' | 'paid' | 'preparing' | 'ready' | 'delivery';
type PaymentStatus = 'unpaid' | 'cash' | 'card';

type DemoOrder = {
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
};

const demoOrders: DemoOrder[] = [
  {
    id: 'ord-101',
    number: '101',
    customer: 'Walk-in kiosk',
    phone: '+447700900101',
    type: 'collection',
    status: 'new',
    payment: 'unpaid',
    total: 24.5,
    items: ['Chicken biryani', 'Garlic naan', 'Mango lassi'],
    createdAt: '12:08',
  },
  {
    id: 'ord-102',
    number: '102',
    customer: 'Amina',
    phone: '+447700900102',
    type: 'delivery',
    status: 'delivery',
    payment: 'card',
    total: 31.2,
    address: '24 Market Street, SW1',
    items: ['Lamb curry', 'Pilau rice', 'Onion bhaji'],
    createdAt: '12:13',
  },
];

function statusLabel(status: OrderStatus) {
  if (status === 'coming') return 'Coming to order';
  if (status === 'paid') return 'Paid';
  if (status === 'delivery') return 'Out for delivery';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function RestaurantOrders() {
  const [tab, setTab] = useState<'kitchen' | 'till' | 'delivery'>('kitchen');
  const [orders, setOrders] = useState(demoOrders);

  const visibleOrders = useMemo(() => {
    if (tab === 'delivery') return orders.filter((o) => o.type === 'delivery');
    if (tab === 'till') return orders.filter((o) => o.payment === 'unpaid' || o.status === 'coming');
    return orders;
  }, [orders, tab]);

  function updateOrder(id: string, patch: Partial<DemoOrder>) {
    setOrders((prev) => prev.map((order) => (order.id === id ? { ...order, ...patch } : order)));
  }

  return (
    <main className="min-h-screen bg-slate-100 p-3 sm:p-5">
      <section className="mx-auto max-w-7xl">
        <div className="mb-4 rounded-[1.75rem] bg-emerald-950 p-4 text-white shadow-xl">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-amber-200">Sync2Dine staff tablet</p>
              <h1 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">Orders, till and delivery</h1>
            </div>
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
                    {order.createdAt}
                  </p>
                  <p className="mt-3 text-3xl font-black">£{order.total.toFixed(2)}</p>
                </div>
              </div>

              <footer className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <Button
                  type="button"
                  className="min-h-[52px] rounded-xl bg-amber-400 text-base font-bold text-emerald-950 hover:bg-amber-300"
                  onClick={() => updateOrder(order.id, { status: 'coming' })}
                >
                  <Receipt className="mr-2 h-5 w-5" />
                  Coming to order
                </Button>
                <Button
                  type="button"
                  className="min-h-[52px] rounded-xl bg-emerald-950 text-base font-bold text-white hover:bg-emerald-900"
                  onClick={() => updateOrder(order.id, { status: 'paid', payment: 'cash' })}
                >
                  Cash paid
                </Button>
                <Button
                  type="button"
                  className="min-h-[52px] rounded-xl bg-emerald-950 text-base font-bold text-white hover:bg-emerald-900"
                  onClick={() => updateOrder(order.id, { status: 'paid', payment: 'card' })}
                >
                  Card paid
                </Button>
                <Button type="button" variant="outline" className="min-h-[52px] rounded-xl text-base font-bold">
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
