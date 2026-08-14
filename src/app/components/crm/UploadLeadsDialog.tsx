import { useState } from 'react';
import type { Customer } from '../../App';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../ui/dialog';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import { parseCustomersCsv } from '../../engine/data/dataImportExportService';
import { normalizeLeadSheet } from '../../engine/data/normalizeLeadCsv';
import type { SallyDialRow } from '../../engine/data/sallyLeadSheetParser';
import { DEFAULT_SALLY_BRIEF, LEEDS_CAMPAIGN_ID } from '../../engine/leads/leedsCampaign';

export type LeadImportResult = { added: number; skipped: number };

type Props = {
  onImport: (customers: Customer[]) => Promise<LeadImportResult | void> | LeadImportResult | void;
};

/**
 * One Upload leads dialog: import CRM cards + queue Sally on the same list (Leeds campaign).
 */
export function UploadLeadsDialog({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [batchId, setBatchId] = useState(LEEDS_CAMPAIGN_ID);
  const [brief, setBrief] = useState(DEFAULT_SALLY_BRIEF);
  const [queueSally, setQueueSally] = useState(true);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  function rowsFromPaste(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return '';
    const first = trimmed.split(/\r?\n/)[0]?.toLowerCase() || '';
    if (
      first.startsWith('name')
      || first.startsWith('restaurant')
      || first.includes('company_name')
      || first.includes('contact_name')
      || first.includes('company,')
      || (first.includes('phone') && first.includes(','))
    ) {
      return trimmed;
    }
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const body = lines.map((line) => {
      const parts = line.split(/[,\t|;]/).map((p) => p.trim());
      const restaurant = parts[0] || '';
      const phone = parts.find((p) => /\d{7,}/.test(p)) || '';
      const email = parts.find((p) => p.includes('@')) || '';
      const contact = parts.find((p) => p && p !== restaurant && p !== phone && p !== email) || '';
      const address = parts.filter((p) => p && p !== restaurant && p !== contact && p !== phone && p !== email).join(' ');
      return [restaurant, contact, email, phone, address]
        .map((v) => (/,|"/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
        .join(',');
    });
    return ['restaurant_name,contact_name,email,phone,address', ...body].join('\n');
  }

  async function runImport(csvText: string) {
    const campaign = (batchId.trim() || LEEDS_CAMPAIGN_ID);
    const toastId = toast.loading(queueSally ? 'Importing & queuing Leeds dials…' : 'Importing leads…');
    setBusy(true);
    try {
      const sheet = await normalizeLeadSheet(csvText, campaign);
      let customers = sheet.customers;
      let errors = sheet.errors;
      const dialRows: SallyDialRow[] = sheet.dialRows?.length ? sheet.dialRows : [];
      if (!customers.length) {
        const fallback = parseCustomersCsv(csvText);
        customers = fallback.customers;
        errors = [...errors, ...fallback.errors];
      }
      if (errors.length && !customers.length) {
        toast.error(errors[0], { id: toastId });
        return;
      }

      const stamped = customers.map((c) => ({
        ...c,
        source: c.source ?? ('purchased' as const),
        leadBatchId: campaign,
        campaign,
        callQueueStatus: (queueSally ? 'queued' : 'not_called') as 'queued' | 'not_called',
        callAttemptCount: 0,
        status: 'lead' as const,
        tags: [...new Set([...(c.tags ?? []).filter((t) => !/hindi|scrape-\d|sales-\d/i.test(t)), 'scraped', campaign])],
        people: c.people?.length
          ? c.people
          : (c.contactName
            ? [{ name: c.contactName, role: 'Manager' as const, phone: c.phone || undefined }]
            : c.people),
      }));

      if (!stamped.length && !dialRows.length) {
        toast.error('No leads found to import', { id: toastId });
        return;
      }

      let added = 0;
      let skipped = 0;
      if (stamped.length) {
        const result = await onImport(stamped);
        added = result && typeof result === 'object' ? result.added : stamped.length;
        skipped = result && typeof result === 'object' ? result.skipped : 0;
      }

      let queued = 0;
      let held = 0;
      if (queueSally && (dialRows.length || stamped.length)) {
        const rows = dialRows.length
          ? dialRows.map((r) => ({
              company: r.company,
              phone: r.phone,
              customerId: r.customerId,
              venueType: r.venueType || 'takeaway',
              openingHours: r.openingHours,
              notes: r.notes,
              address: r.address,
            }))
          : stamped.map((c) => ({
              company: c.name,
              phone: c.phone,
              customerId: c.id,
              venueType: 'takeaway',
              notes: c.notes,
              address: c.address,
            }));
        const res = await fetch('/api/calls/outbound/bulk', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows,
            template: 'sally_sales',
            batchId: campaign,
            brief,
            agentPersona: 'sally',
            aim: 'sales_outreach',
            venueAware: true,
          }),
        });
        const data = await res.json().catch(() => ({})) as {
          error?: string;
          queued?: number;
          held?: number;
        };
        if (!res.ok) throw new Error(data.error ?? 'Failed to queue Sally dials');
        queued = Number(data.queued ?? 0);
        held = Number(data.held ?? 0);
      }

      const parts = [
        `Imported ${added} lead${added === 1 ? '' : 's'}`,
        skipped > 0 ? `skipped ${skipped} duplicate${skipped === 1 ? '' : 's'}` : '',
        queueSally ? `queued ${queued} for ${campaign}${held ? ` · held ${held} for hours` : ''}` : '',
      ].filter(Boolean);
      toast.success(parts.join(' · '), { id: toastId });
      if (errors.length) {
        const dupWarns = errors.filter((e) => /duplicate phone/i.test(e)).length;
        const otherWarns = errors.length - dupWarns;
        if (dupWarns) toast.message(`${dupWarns} duplicate phone${dupWarns === 1 ? '' : 's'} in the file (kept first only)`);
        if (otherWarns) toast.message(`${otherWarns} row warning${otherWarns === 1 ? '' : 's'}`);
      }
      setPaste('');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed', { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  async function handleFile(file: File) {
    await runImport(await file.text());
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          <Upload className="w-4 h-4 mr-2" />
          Upload leads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload leads</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Campaign</Label>
            <Input
              className="mt-1"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder={LEEDS_CAMPAIGN_ID}
            />
            <p className="text-xs text-slate-500 mt-0.5">
              Default is Leeds. Venue opening hours from the sheet drive when Sally dials.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={queueSally}
              onChange={(e) => setQueueSally(e.target.checked)}
              className="rounded border-slate-300"
            />
            Import and queue Sally dials (same list)
          </label>
          {queueSally && (
            <div>
              <Label>Call brief</Label>
              <Textarea
                className="mt-1 min-h-[60px]"
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
              />
            </div>
          )}
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
            <p className="text-sm text-slate-600 mb-2">Drop a CSV — formats are detected automatically.</p>
            <Input
              type="file"
              accept=".csv,text/csv,.tsv,text/tab-separated-values"
              className="max-w-xs mx-auto"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (file) void handleFile(file);
              }}
            />
          </div>
          <div>
            <Label>Or paste CSV</Label>
            <p className="text-xs text-slate-500 mt-0.5">
              UK phones (0…, +44…, or missing leading 0) are normalised to E.164.
            </p>
            <Textarea
              className="mt-1 min-h-[120px] font-mono text-sm"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={'company_name,contact_name,phone,opening_hours\nAcme Takeaway,Jane Smith,+447700900123,16:00-23:00'}
            />
          </div>
          <Button
            className="w-full min-h-11"
            disabled={busy || !paste.trim()}
            onClick={() => runImport(rowsFromPaste(paste))}
          >
            {busy ? 'Working…' : queueSally ? 'Import & queue Sally' : 'Import into Call Queue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
