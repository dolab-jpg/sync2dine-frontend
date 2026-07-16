import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { PhoneCall, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BRIEF_PRESETS = [
  { id: 'scrape', label: 'Scrape follow-up', text: 'Follow up on their enquiry we received, confirm they still want a quote, and book a survey if interested.' },
  { id: 'callback', label: 'Callback', text: 'Return their callback request, confirm interest, and agree the next step.' },
  { id: 'quote', label: 'Quote chase', text: 'Chase the outstanding quote, answer questions, and move them toward booking.' },
];

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string;
  leadPhone: string;
  customerId: string;
  defaultBrief?: string;
  onDialStarted: (payload: { callId?: string; brief: string }) => void;
};

export function CallThisPersonDialog({
  open,
  onOpenChange,
  leadName,
  leadPhone,
  customerId,
  defaultBrief,
  onDialStarted,
}: Props) {
  const [brief, setBrief] = useState(defaultBrief ?? BRIEF_PRESETS[0].text);
  const [dialling, setDialling] = useState(false);

  useEffect(() => {
    if (open) {
      setBrief(defaultBrief?.trim() || BRIEF_PRESETS[0].text);
    }
  }, [open, defaultBrief]);

  async function handleCallNow() {
    const text = brief.trim();
    if (!text) {
      toast.error('Enter what Cynthia should say or do on this call');
      return;
    }
    if (!leadPhone.trim()) {
      toast.error('Lead has no phone number');
      return;
    }
    setDialling(true);
    try {
      const res = await fetch('/api/calls/outbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: leadPhone,
          template: 'lead_callback',
          context: {
            customerId,
            brief: text,
            aim: 'callback',
            source: 'crm_call_this_person',
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? 'Failed to place call');
      }
      onDialStarted({ callId: data.callId, brief: text });
      toast.success(`Calling ${leadName}…`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to place call');
    } finally {
      setDialling(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Call this person</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Cynthia will dial <strong>{leadName}</strong> on <strong>{leadPhone}</strong> and follow your instructions.
          </p>
          <div className="flex flex-wrap gap-2">
            {BRIEF_PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setBrief(p.text)}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div>
            <Label className="font-semibold">What should Cynthia say / do?</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="mt-1 min-h-[120px]"
              placeholder="e.g. Ask if they still want a bathroom quote for their address…"
            />
          </div>
          <Button
            className="w-full min-h-11"
            onClick={handleCallNow}
            disabled={dialling || !leadPhone}
          >
            {dialling ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Dialling…
              </>
            ) : (
              <>
                <PhoneCall className="w-4 h-4 mr-2" />
                Call now
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
