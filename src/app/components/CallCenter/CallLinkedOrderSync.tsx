import { useCallback, useEffect, useState } from 'react';
import OrderPosSyncBadge from '../restaurant/OrderPosSyncBadge';
import { getActiveOrgId } from '../../engine/platform/orgContext';

type LinkedOrder = {
  id: string;
  orderNumber?: string | number;
  syncState?: string;
  externalId?: string;
  total?: number;
  status?: string;
};

/** Shows POS sync status for orders placed on this call (sourceCallId / callIds). */
export default function CallLinkedOrderSync({ callId }: { callId: string }) {
  const [orders, setOrders] = useState<LinkedOrder[]>([]);

  const load = useCallback(async () => {
    if (!callId) return;
    try {
      const orgId = getActiveOrgId();
      const res = await fetch('/api/orders', {
        headers: orgId ? { 'x-org-id': orgId } : {},
      });
      if (!res.ok) return;
      const data = await res.json() as { orders?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>;
      const list = Array.isArray(data) ? data : (data.orders ?? []);
      const linked = list.filter((o) => {
        const sourceCallId = String(o.sourceCallId ?? o.source_call_id ?? '');
        const callIds = Array.isArray(o.callIds) ? o.callIds.map(String) : [];
        return sourceCallId === callId || callIds.includes(callId);
      }).map((o) => ({
        id: String(o.id),
        orderNumber: (o.orderNumber ?? o.number) as string | number | undefined,
        syncState: o.syncState != null ? String(o.syncState) : undefined,
        externalId: o.externalId != null ? String(o.externalId) : undefined,
        total: Number(o.total ?? 0),
        status: o.status != null ? String(o.status) : undefined,
      }));
      setOrders(linked);
    } catch {
      setOrders([]);
    }
  }, [callId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!orders.length) return null;

  return (
    <div className="rounded-md border bg-white p-2 space-y-2" data-testid="call-linked-order-sync">
      <p className="text-xs font-bold text-slate-700">Orders from this call</p>
      {orders.map((o) => (
        <div key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="font-semibold text-s2d-teal-deep">
            #{o.orderNumber ?? o.id.slice(0, 8)}
            {o.total != null ? ` · £${Number(o.total).toFixed(2)}` : ''}
          </span>
          <OrderPosSyncBadge
            orderId={o.id}
            syncState={o.syncState}
            externalId={o.externalId}
            onRetried={() => void load()}
          />
        </div>
      ))}
    </div>
  );
}
