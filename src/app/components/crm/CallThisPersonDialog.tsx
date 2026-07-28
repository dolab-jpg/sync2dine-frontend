import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { PhoneCall, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const BRIEF_PRESETS = [
  {
    id: 'discovery',
    label: 'Intro / discovery',
    aim: 'discovery',
    text: 'Introduce Sync2Dine — the AI phone assistant that answers every call, takes orders, and books tables. Ask how they handle the phone at peak times and whether they miss orders.',
  },
  {
    id: 'demo',
    label: 'Book demo',
    aim: 'demo_book',
    text: 'Offer a live demo of Sync2Dine taking an order end to end. Agree a day and time, and confirm the best number and email for the invite.',
  },
  {
    id: 'callback',
    label: 'Callback',
    aim: 'callback',
    text: 'Return their callback request, confirm they still want Sync2Dine, answer pricing questions, and agree the next step.',
  },
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
  const [aim, setAim] = useState(BRIEF_PRESETS[0].aim);
  const [dialling, setDialling] = useState(false);

  useEffect(() => {
    if (open) {
      setBrief(defaultBrief?.trim() || BRIEF_PRESETS[0].text);
      setAim(BRIEF_PRESETS[0].aim);
    }
  }, [open, defaultBrief]);

  async function handleCallNow() {
    const text = brief.trim();
    if (!text) {
      toast.error('Enter what Sally should say or do on this call');
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
            aim,
            // Sales CRM dials always run the Sally sales brain, never Judie.
            agentPersona: 'sally',
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
            Sally will dial <strong>{leadName}</strong> on <strong>{leadPhone}</strong> and follow your instructions.
          </p>
          <div className="flex flex-wrap gap-2">
            {BRIEF_PRESETS.map((p) => (
              <Button
                key={p.id}
                type="button"
                size="sm"
                variant={aim === p.aim ? 'default' : 'outline'}
                onClick={() => {
                  setBrief(p.text);
                  setAim(p.aim);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>
          <div>
            <Label className="font-semibold">What should Sally say / do?</Label>
            <Textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              className="mt-1 min-h-[120px]"
              placeholder="e.g. Ask how they handle the phone at peak times and offer a demo…"
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
