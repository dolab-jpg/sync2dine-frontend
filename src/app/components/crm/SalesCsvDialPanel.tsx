import { useCallback, useState } from 'react';
import type { Customer } from '../../App';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { PhoneOutgoing, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { parseSallyLeadSheetCsv, type SallyDialRow } from '../../engine/data/sallyLeadSheetParser';

type Props = {
  onImport?: (customers: Customer[]) => Promise<void> | void;
};

/** CSV drop zone for company phone numbers — queues outbound sales dials. */
export function SalesCsvDialPanel({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [batchId, setBatchId] = useState(() => `sales-${new Date().toISOString().slice(0, 10)}`);
  const [brief, setBrief] = useState(
    'Sally from Sync2Dine: introduce the takeaway phone platform — AI answers, takes orders, and drives repeat business. If they want to sign up, research their restaurant online and confirm details before creating their account.',
  );
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const queueRows = useCallback(async (text: string) => {
    const parsed = parseSallyLeadSheetCsv(text, { batchId });
    const rows: SallyDialRow[] = parsed.dialRows;
    if (!rows.length) {
      toast.error(parsed.errors[0] || 'No phone numbers found in CSV');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/calls/outbound/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: rows.map((r) => ({
            company: r.company,
            phone: r.phone,
            customerId: r.customerId,
            venueType: r.venueType || 'takeaway',
            openingHours: r.openingHours,
            notes: r.notes,
            address: r.address,
          })),
          template: 'lead_callback',
          batchId,
          brief,
          agentPersona: 'sally',
          aim: 'sales_outreach',
          venueAware: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to queue calls');

      if (onImport && parsed.customers.length) {
        const stamped = parsed.customers.map((c) => ({
          ...c,
          source: 'purchased' as const,
          leadBatchId: batchId,
          campaign: batchId,
          callQueueStatus: 'queued' as const,
          callAttemptCount: 0,
          status: 'lead' as const,
          tags: [...new Set([...(c.tags ?? []), 'sales-csv', 'sally', batchId])],
        }));
        await onImport(stamped);
      }

      const held = Number(data.held ?? 0);
      const queued = Number(data.queued ?? rows.length);
      toast.success(
        held > 0
          ? `Queued ${queued}; held ${held} for hours research`
          : `Queued ${queued} Sally outbound call${queued === 1 ? '' : 's'}`,
      );
      if (parsed.errors.length) toast.message(`${parsed.errors.length} row warning(s)`);
      setPaste('');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Queue failed');
    } finally {
      setBusy(false);
    }
  }, [batchId, brief, onImport]);

  async function handleFile(file: File) {
    const text = await file.text();
    await queueRows(text);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11 border-amber-300 bg-amber-50 hover:bg-amber-100">
          <PhoneOutgoing className="w-4 h-4 mr-2" />
          Sally CSV dial
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sally — queue Sync2Dine sales dials</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Batch tag</Label>
            <Input
              className="mt-1"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="sales-2026-07-16"
            />
          </div>
          <div>
            <Label>Call brief</Label>
            <Textarea
              className="mt-1 min-h-[60px]"
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
            />
          </div>
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center transition-colors ${
              dragOver ? 'border-amber-500 bg-amber-50' : 'border-slate-300 bg-slate-50'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFile(file);
            }}
          >
            <Upload className="w-8 h-8 mx-auto text-slate-500 mb-2" />
            <p className="text-sm text-slate-600 mb-2">
              Drop a Google Sheet CSV (company_name, contact_name, phone, hours…)
            </p>
            <Input
              type="file"
              accept=".csv,text/csv,.tsv,text/tab-separated-values"
              className="max-w-xs mx-auto"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFile(file);
              }}
            />
          </div>
          <div>
            <Label>Or paste rows</Label>
            <p className="text-xs text-slate-500 mt-0.5">
              Headers: company_name, contact_name, phone (all required). Also: address, city,
              postcode, category, opening_hours, hours_mon…hours_sun, lead_id.
            </p>
            <Textarea
              className="mt-1 min-h-[100px] font-mono text-sm"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={'company_name,contact_name,phone,opening_hours\nAcme Takeaway,Jane Smith,+447700900123,16:00-23:00'}
            />
          </div>
          <Button
            className="w-full min-h-11"
            disabled={busy || !paste.trim()}
            onClick={() => queueRows(paste)}
          >
            {busy ? 'Queuing…' : 'Queue outbound calls'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
