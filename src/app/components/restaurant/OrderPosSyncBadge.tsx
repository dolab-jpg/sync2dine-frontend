import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { getActiveOrgId } from '../../engine/platform/orgContext';
import type { SyncState } from '../../engine/restaurant/foodOrderTypes';

const LABELS: Record<string, string> = {
  local: 'Local',
  pending_out: 'Sending',
  synced: 'Synced to Square',
  error: 'Sync error',
};

const CLASS: Record<string, string> = {
  local: 'bg-slate-200 text-slate-800',
  pending_out: 'bg-amber-100 text-amber-950',
  synced: 'bg-emerald-100 text-emerald-900',
  error: 'bg-red-100 text-red-900',
};

type Props = {
  orderId?: string;
  syncState?: SyncState | string | null;
  externalId?: string | null;
  compact?: boolean;
  onRetried?: () => void;
};

export default function OrderPosSyncBadge({
  orderId,
  syncState,
  externalId,
  compact,
  onRetried,
}: Props) {
  const state = String(syncState || 'local').toLowerCase();
  const label = LABELS[state] || state;
  const cls = CLASS[state] || CLASS.local;
  const canRetry = Boolean(orderId) && (state === 'error' || state === 'pending_out');

  async function retry() {
    if (!orderId) return;
    try {
      const orgId = getActiveOrgId();
      const res = await fetch(`/api/connectors/orders/${encodeURIComponent(orderId)}/push`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(orgId ? { 'x-org-id': orgId } : {}),
        },
        body: '{}',
      });
      const data = await res.json().catch(() => ({})) as { ok?: boolean; push?: { error?: string } };
      if (!res.ok || data.ok === false) {
        toast.error(data.push?.error || 'POS retry failed');
      } else {
        toast.success('Pushed to Square');
      }
      onRetried?.();
    } catch {
      toast.error('POS retry failed');
    }
  }

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${compact ? '' : 'mt-1'}`} data-testid="order-pos-sync-badge">
      <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${cls}`}>{label}</span>
      {externalId && state === 'synced' && !compact ? (
        <span className="text-[11px] text-slate-500">#{externalId.slice(0, 10)}</span>
      ) : null}
      {canRetry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 min-h-0 px-2 text-xs"
          onClick={() => void retry()}
        >
          <RefreshCw className="mr-1 h-3 w-3" />
          Retry
        </Button>
      ) : null}
    </span>
  );
}
