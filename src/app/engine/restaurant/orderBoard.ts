/**
 * Kitchen/delivery board stage helpers.
 * Backend still stores legacy statuses (coming/preparing/delivery); UI shows clear labels.
 */

export type BoardStage = 'new' | 'cooking' | 'ready' | 'out' | 'done';

export type KitchenStatus =
  | 'new'
  | 'coming'
  | 'paid'
  | 'preparing'
  | 'ready'
  | 'delivery'
  | 'completed'
  | 'cancelled'
  | 'handed_off';

export function stageFromStatus(status: string, orderType?: string): BoardStage {
  const s = String(status || 'new').toLowerCase();
  if (s === 'new') return 'new';
  if (s === 'ready') return 'ready';
  if (s === 'delivery' || s === 'handed_off' || s === 'handoff') return 'out';
  if (s === 'completed' || s === 'cancelled') return 'done';
  // coming / preparing / paid (legacy kitchen) → cooking
  if (s === 'coming' || s === 'preparing' || s === 'paid' || s === 'cooking') return 'cooking';
  if (orderType === 'delivery' && s === 'out') return 'out';
  return 'cooking';
}

export function statusLabel(status: string): string {
  const stage = stageFromStatus(status);
  if (stage === 'new') return 'New';
  if (stage === 'cooking') return 'Cooking';
  if (stage === 'ready') return 'Ready';
  if (stage === 'out') {
    return status === 'handed_off' || status === 'handoff' ? 'Handed off' : 'Out for delivery';
  }
  if (status === 'cancelled') return 'Cancelled';
  return 'Done';
}

/** Next primary bump for Otter-style single action. */
export function nextBump(
  status: string,
  orderType: 'collection' | 'delivery' | 'table',
): { status: KitchenStatus; label: string } | null {
  const stage = stageFromStatus(status);
  if (stage === 'new') return { status: 'coming', label: 'Accept · Start cooking' };
  if (stage === 'cooking') return { status: 'ready', label: 'Mark ready' };
  if (stage === 'ready') {
    if (orderType === 'delivery') return { status: 'delivery', label: 'Out for delivery' };
    return { status: 'completed', label: 'Hand off · Done' };
  }
  if (stage === 'out') return { status: 'completed', label: 'Mark delivered' };
  return null;
}

export type SlaTier = 'ok' | 'warn' | 'overdue';

export function slaTier(order: {
  createdAt: string;
  etaMinutes?: number;
  type?: string;
  status?: string;
}): SlaTier {
  const stage = stageFromStatus(order.status ?? 'new');
  if (stage === 'done') return 'ok';
  const started = Date.parse(order.createdAt);
  if (!Number.isFinite(started)) return 'ok';
  const mins = Math.max(0, Math.floor((Date.now() - started) / 60_000));
  const eta = order.etaMinutes ?? (order.type === 'delivery' ? 40 : 25);
  if (mins >= eta) return 'overdue';
  if (mins >= Math.max(1, eta - 8)) return 'warn';
  return 'ok';
}

export function slaClass(tier: SlaTier): string {
  if (tier === 'overdue') return 'text-red-700 bg-red-50 border-red-200';
  if (tier === 'warn') return 'text-amber-900 bg-amber-50 border-amber-200';
  return 'text-emerald-800 bg-emerald-50 border-emerald-100';
}

export function sourceBadge(source?: string): { label: string; className: string } {
  const s = String(source ?? 'phone').toLowerCase();
  if (s === 'kiosk' || s === 'front') {
    return { label: 'Kiosk', className: 'bg-violet-100 text-violet-900' };
  }
  if (s === 'deliverect' || s === 'otter' || s === 'middleware') {
    return { label: s === 'otter' ? 'Otter' : 'Deliverect', className: 'bg-sky-100 text-sky-900' };
  }
  if (s === 'whatsapp') {
    return { label: 'WhatsApp', className: 'bg-emerald-100 text-emerald-900' };
  }
  if (s === 'web') {
    return { label: 'Web', className: 'bg-slate-100 text-slate-800' };
  }
  return { label: 'Phone', className: 'bg-s2d-cream text-s2d-teal-deep' };
}

export function isActiveBoardOrder(
  status: string,
  createdAt: string,
  opts: { showHistory: boolean; autoHideCompletedMin: number },
): boolean {
  const stage = stageFromStatus(status);
  if (stage !== 'done') return true;
  if (opts.showHistory) return true;
  const ended = Date.parse(createdAt);
  if (!Number.isFinite(ended)) return false;
  const mins = (Date.now() - ended) / 60_000;
  return mins < opts.autoHideCompletedMin;
}
