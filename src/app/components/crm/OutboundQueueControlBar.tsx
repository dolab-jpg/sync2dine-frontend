import { useCallback, useEffect, useState } from 'react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Pause, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

type QueueState = 'running' | 'paused' | 'stopped';

type Props = {
  className?: string;
  /** Compact chip row for Call Centre header */
  compact?: boolean;
};

/**
 * Shared Start / Pause / Stop for the Sally outbound dial queue.
 * “Paused” here means the dial queue — not Agent on/off.
 */
export function OutboundQueueControlBar({ className = '', compact = false }: Props) {
  const [state, setState] = useState<QueueState>('running');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/settings');
      const data = await res.json();
      if (data.outboundQueueState === 'paused' || data.outboundQueueState === 'stopped' || data.outboundQueueState === 'running') {
        setState(data.outboundQueueState);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = window.setInterval(() => void refresh(), 15000);
    return () => window.clearInterval(t);
  }, [refresh]);

  async function setControl(next: QueueState) {
    setSaving(true);
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outboundQueueState: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to update dial queue');
      setState((data as { outboundQueueState?: QueueState }).outboundQueueState ?? next);
      const labels: Record<QueueState, string> = {
        running: 'started — Sally will dial queued leads',
        paused: 'paused — no new dials until you start',
        stopped: 'stopped — queued dials cancelled',
      };
      toast.success(`Dial queue ${labels[next]}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Dial queue update failed');
    } finally {
      setSaving(false);
    }
  }

  const badgeVariant = state === 'running' ? 'default' : state === 'paused' ? 'secondary' : 'destructive';

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${compact ? '' : 'rounded-xl border border-slate-200 bg-white/80 px-3 py-2'} ${className}`}
    >
      <span className={`font-semibold text-slate-800 ${compact ? 'text-xs' : 'text-sm'}`}>
        Dial queue
      </span>
      <Badge variant={badgeVariant} className={compact ? 'text-[10px]' : ''}>
        {state === 'running' ? 'Running' : state === 'paused' ? 'Paused' : 'Stopped'}
      </Badge>
      <Button
        size="sm"
        variant="outline"
        className="min-h-9"
        disabled={saving || state === 'running'}
        onClick={() => void setControl('running')}
      >
        <Play className="w-4 h-4 mr-1" />
        Start
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="min-h-9"
        disabled={saving || state === 'paused'}
        onClick={() => void setControl('paused')}
      >
        <Pause className="w-4 h-4 mr-1" />
        Pause
      </Button>
      <Button
        size="sm"
        variant="destructive"
        className="min-h-9"
        disabled={saving || state === 'stopped'}
        onClick={() => {
          if (confirm('Stop dial queue and cancel queued Sally dials?')) {
            void setControl('stopped');
          }
        }}
      >
        <Square className="w-4 h-4 mr-1" />
        Stop
      </Button>
    </div>
  );
}
