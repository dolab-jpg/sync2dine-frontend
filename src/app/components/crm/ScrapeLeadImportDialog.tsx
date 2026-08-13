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

type Props = {
  onImport: (customers: Customer[]) => Promise<void> | void;
};

/** Paste or upload scraped lead rows — formats and UK phones (0 / +44) are detected automatically. */
export function ScrapeLeadImportDialog({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [batchId, setBatchId] = useState(() => `scrape-${new Date().toISOString().slice(0, 10)}`);
  const [busy, setBusy] = useState(false);

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
    const toastId = toast.loading('Recognising sheet…');
    setBusy(true);
    try {
      const sheet = await normalizeLeadSheet(csvText, batchId);
      let customers = sheet.customers;
      let errors = sheet.errors;
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
        leadBatchId: c.leadBatchId || batchId,
        campaign: c.campaign || batchId,
        callQueueStatus: 'not_called' as const,
        callAttemptCount: 0,
        status: 'lead' as const,
        tags: [...new Set([...(c.tags ?? []), 'scraped', batchId])],
        people: c.people?.length
          ? c.people
          : (c.contactName
            ? [{ name: c.contactName, role: 'Manager' as const, phone: c.phone || undefined }]
            : c.people),
      }));
      if (!stamped.length) {
        toast.error('No leads found to import', { id: toastId });
        return;
      }
      await onImport(stamped);
      toast.success(`Imported ${stamped.length} lead${stamped.length === 1 ? '' : 's'}`, { id: toastId });
      if (errors.length) toast.message(`${errors.length} row warning(s)`);
      setPaste('');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed', { id: toastId });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          <Upload className="w-4 h-4 mr-2" />
          Upload CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Upload leads CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Batch tag</Label>
            <Input
              className="mt-1"
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="scrape-2026-07-16"
            />
          </div>
          <div>
            <Label>Paste CSV</Label>
            <p className="text-xs text-slate-500 mt-0.5">
              Formats are detected automatically — no column mapping.
              UK phones starting 0 or +44 are normalised to E.164.
            </p>
            <Textarea
              className="mt-1 min-h-[140px] font-mono text-sm"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={'restaurant_name,contact_name,phone\nThe Golden Dragon,Jane Smith,07700900123'}
            />
          </div>
          <div>
            <Label>Or upload CSV</Label>
            <Input
              type="file"
              accept=".csv,text/csv,.tsv,text/tab-separated-values"
              className="mt-1"
              disabled={busy}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = '';
                if (!file) return;
                await runImport(await file.text());
              }}
            />
          </div>
          <Button
            className="w-full min-h-11"
            disabled={busy || !paste.trim()}
            onClick={() => runImport(rowsFromPaste(paste))}
          >
            {busy ? 'Recognising sheet…' : 'Import into Call Queue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
