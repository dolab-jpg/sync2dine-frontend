import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Switch } from '../ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { Settings2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export type CapacitySnapshot = {
  inboundActive: number;
  outboundActive: number;
  maxInbound: number;
  maxOutbound: number;
  maxTotal: number;
  overflowArmed: boolean;
  overflowNumber?: string;
};

type Props = {
  capacity?: CapacitySnapshot | null;
  onSaved?: () => void;
  /** Compact trigger for the ops strip chips */
  triggerClassName?: string;
};

/**
 * Edit Soho66 concurrent-channel slots (total / inbound reserve / outbound max)
 * and overflow divert. Saves via PATCH /api/agent/settings.
 */
export function CapacityEditor({ capacity, onSaved, triggerClassName = '' }: Props) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [maxTotal, setMaxTotal] = useState(4);
  const [maxInbound, setMaxInbound] = useState(2);
  const [maxOutbound, setMaxOutbound] = useState(2);
  const [overflowWhenFull, setOverflowWhenFull] = useState(true);
  const [overflowNumber, setOverflowNumber] = useState('');

  useEffect(() => {
    if (!open) return;
    setMaxTotal(capacity?.maxTotal ?? 4);
    setMaxInbound(capacity?.maxInbound ?? 2);
    setMaxOutbound(capacity?.maxOutbound ?? 2);
    setOverflowWhenFull(capacity?.overflowArmed !== false);
    setOverflowNumber(capacity?.overflowNumber ?? '');
  }, [open, capacity]);

  async function save() {
    const total = Math.max(1, Math.min(10, Math.round(maxTotal)));
    const inbound = Math.max(1, Math.min(total, Math.round(maxInbound)));
    const outbound = Math.max(1, Math.min(total, Math.round(maxOutbound)));
    setSaving(true);
    try {
      const res = await fetch('/api/agent/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxAgentSlots: total,
          maxInboundSlots: inbound,
          maxOutboundSlots: outbound,
          overflowWhenFull,
          overflowNumber: overflowNumber.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error || 'Failed to save capacity');
      toast.success(`Capacity saved — Max ${total}, Inbound ${inbound}, Outbound ${outbound}`);
      setOpen(false);
      onSaved?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Capacity save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={`min-h-8 gap-1 border-s2d-teal/20 text-s2d-teal-deep hover:bg-s2d-cream ${triggerClassName}`}
          title="Edit concurrent call capacity"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Call capacity</DialogTitle>
          <DialogDescription>
            Total = your Soho66 concurrent-channel allowance. Confirm with a soft-phone
            concurrency test before raising. Outbound should leave room for inbound diners.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cap-total">Total max</Label>
              <Input
                id="cap-total"
                type="number"
                min={1}
                max={10}
                value={maxTotal}
                onChange={(e) => setMaxTotal(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cap-in">Inbound</Label>
              <Input
                id="cap-in"
                type="number"
                min={1}
                max={10}
                value={maxInbound}
                onChange={(e) => setMaxInbound(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cap-out">Outbound</Label>
              <Input
                id="cap-out"
                type="number"
                min={1}
                max={10}
                value={maxOutbound}
                onChange={(e) => setMaxOutbound(Number(e.target.value))}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground rounded-lg bg-s2d-cream/60 border border-s2d-teal/10 px-3 py-2">
            Recommended for a 4-channel Soho66 trunk: Total 4, Inbound 2, Outbound 2.
            Currently live: Inbound {capacity?.inboundActive ?? 0}/{capacity?.maxInbound ?? '—'},
            Outbound {capacity?.outboundActive ?? 0}/{capacity?.maxOutbound ?? '—'}.
          </p>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-s2d-teal/10 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium text-s2d-teal-deep">Divert when full</p>
              <p className="text-[11px] text-muted-foreground">
                Send overflow inbound to a PSTN number when AI slots are busy
              </p>
            </div>
            <Switch checked={overflowWhenFull} onCheckedChange={setOverflowWhenFull} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cap-overflow">Overflow number</Label>
            <Input
              id="cap-overflow"
              type="tel"
              placeholder="+44…"
              value={overflowNumber}
              onChange={(e) => setOverflowNumber(e.target.value)}
              disabled={!overflowWhenFull}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void save()} disabled={saving} className="bg-s2d-teal hover:bg-s2d-teal-deep">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            Save capacity
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
