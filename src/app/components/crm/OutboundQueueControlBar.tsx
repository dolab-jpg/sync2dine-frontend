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
 * "Paused" here means the dial queue — not Agent on/off.
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

  const isRunning = state === 'running';
  const isPaused = state === 'paused';
  const isStopped = state === 'stopped';

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${
        compact
          ? 'rounded-xl border border-s2d-teal/15 bg-s2d-cream/40 px-2.5 py-2'
          : 'rounded-xl border border-slate-200 bg-white/80 px-3 py-2'
      } ${className}`}
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`font-semibold text-s2d-teal-deep ${compact ? 'text-xs' : 'text-sm'}`}>
          Dial queue
        </span>
        <Badge
          variant={isRunning ? 'default' : isPaused ? 'secondary' : 'destructive'}
          className={`${compact ? 'text-[10px]' : ''} ${
            isRunning ? 'bg-emerald-600 hover:bg-emerald-600' : ''
          }`}
        >
          {isRunning ? 'Running' : isPaused ? 'Paused' : 'Stopped'}
        </Badge>
      </div>

      {/* Primary action: Start when idle/paused, Stop when running */}
      {isRunning ? (
        <Button
          size={compact ? 'sm' : 'default'}
          variant="destructive"
          className={`font-semibold shadow-sm ${compact ? 'min-h-9 px-3' : 'min-h-10 px-4'}`}
          disabled={saving}
          onClick={() => {
            if (confirm('Stop dial queue and cancel queued Sally dials?')) {
              void setControl('stopped');
            }
          }}
        >
          <Square className="w-4 h-4 mr-1.5 fill-current" />
          Stop
        </Button>
      ) : (
        <Button
          size={compact ? 'sm' : 'default'}
          className={`bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm ${
            compact ? 'min-h-9 px-3' : 'min-h-10 px-4'
          }`}
          disabled={saving}
          onClick={() => void setControl('running')}
        >
          <Play className="w-4 h-4 mr-1.5 fill-current" />
          Start
        </Button>
      )}

      <Button
        size="sm"
        variant="outline"
        className={`min-h-9 border-s2d-teal/25 ${isPaused ? 'opacity-50' : ''}`}
        disabled={saving || isPaused}
        onClick={() => void setControl('paused')}
        title="Pause — no new dials until you start"
      >
        <Pause className="w-4 h-4 mr-1" />
        Pause
      </Button>

      {/* Secondary Stop when not already stopped (e.g. from paused) */}
      {!isRunning && !isStopped && (
        <Button
          size="sm"
          variant="outline"
          className="min-h-9 border-red-200 text-red-700 hover:bg-red-50"
          disabled={saving}
          onClick={() => {
            if (confirm('Stop dial queue and cancel queued Sally dials?')) {
              void setControl('stopped');
            }
          }}
        >
          <Square className="w-3.5 h-3.5 mr-1" />
          Stop
        </Button>
      )}
    </div>
  );
}
