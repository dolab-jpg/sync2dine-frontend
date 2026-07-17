/**
 * Shared food-order types for kitchen/delivery boards.
 * Kitchen progress stays separate from payment.
 */

export type OrderStatus =
  | 'new'
  | 'coming'
  | 'paid'
  | 'preparing'
  | 'ready'
  | 'delivery'
  | 'completed'
  | 'cancelled';

export type PayStatus = 'unpaid' | 'paid';
export type PayMethod = 'cash' | 'card';

export type OrderSource =
  | 'phone'
  | 'kiosk'
  | 'whatsapp'
  | 'sync2dine'
  | 'deliverect'
  | 'otter'
  | 'custom';

export type SyncState = 'local' | 'pending_out' | 'synced' | 'error';

export type OrderLine = {
  label: string;
  qty: number;
  price?: number;
  dealName?: string;
  dealIndex?: number;
  role?: string;
  /** Dish name without qty/deal hints — for allergen lookup */
  name?: string;
  allergensContains?: string[];
};

export type FoodOrder = {
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
  customerAllergies?: string;
  allergyConfirmed?: boolean;
  source?: OrderSource;
  channelLabel?: string;
  externalId?: string;
  sourceStatus?: string;
  syncState?: SyncState;
  dueAt?: string;
  placedAt?: string;
  sourceCallId?: string;
  callId?: string;
  recordingUrl?: string;
  callIds?: string[];
};

/** Board column for kanban / stacked sections. */
export type BoardStage = 'new' | 'cooking' | 'ready' | 'out' | 'done';

export function normalizeKitchenStatus(status: string): OrderStatus {
  const s = String(status || 'new').toLowerCase();
  if (s === 'preparing' || s === 'cooking') return 'coming';
  if (s === 'out' || s === 'out_for_delivery') return 'delivery';
  if (s === 'done' || s === 'fulfilled') return 'completed';
  if (
    s === 'new' ||
    s === 'coming' ||
    s === 'paid' ||
    s === 'ready' ||
    s === 'delivery' ||
    s === 'completed' ||
    s === 'cancelled'
  ) {
    return s;
  }
  return 'new';
}

export function statusLabel(status: OrderStatus): string {
  if (status === 'coming' || status === 'preparing' || status === 'paid') return 'Cooking';
  if (status === 'delivery') return 'Out for delivery';
  if (status === 'completed') return 'Done';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'ready') return 'Ready';
  if (status === 'new') return 'New';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function boardStage(order: Pick<FoodOrder, 'status' | 'type'>, tab: 'kitchen' | 'delivery'): BoardStage {
  const s = normalizeKitchenStatus(order.status);
  if (s === 'completed' || s === 'cancelled') return 'done';
  if (s === 'delivery') return 'out';
  if (s === 'ready') return 'ready';
  if (s === 'coming' || s === 'preparing' || s === 'paid') return 'cooking';
  if (tab === 'delivery' && s === 'new') return 'new';
  return 'new';
}

export function stageLabel(stage: BoardStage, tab: 'kitchen' | 'delivery'): string {
  if (stage === 'new') return 'New';
  if (stage === 'cooking') return 'Cooking';
  if (stage === 'ready') return tab === 'delivery' ? 'Ready' : 'Ready';
  if (stage === 'out') return tab === 'delivery' ? 'Out for delivery' : 'Handoff';
  return 'Done';
}

/** Next primary bump action for the live board. */
export function primaryBump(
  order: FoodOrder,
): { label: string; status: OrderStatus } | null {
  const s = normalizeKitchenStatus(order.status);
  if (s === 'completed' || s === 'cancelled') return null;
  if (s === 'new') return { label: 'Accept · Start cooking', status: 'coming' };
  if (s === 'coming' || s === 'preparing' || s === 'paid') {
    return { label: 'Mark ready', status: 'ready' };
  }
  if (s === 'ready') {
    if (order.type === 'delivery') return { label: 'Out for delivery', status: 'delivery' };
    return { label: 'Hand off', status: 'completed' };
  }
  if (s === 'delivery') return { label: 'Mark delivered', status: 'completed' };
  return null;
}

export type SlaTier = 'ok' | 'warn' | 'overdue';

export function slaTier(order: FoodOrder, now = Date.now()): SlaTier {
  const started = Date.parse(order.dueAt || order.createdAt);
  if (!Number.isFinite(started)) return 'ok';
  const eta = order.etaMinutes ?? (order.type === 'delivery' ? 40 : 25);
  const deadline = order.dueAt && Number.isFinite(Date.parse(order.dueAt))
    ? Date.parse(order.dueAt)
    : started + eta * 60_000;
  const left = deadline - now;
  if (left <= 0) return 'overdue';
  if (left <= 5 * 60_000) return 'warn';
  return 'ok';
}
