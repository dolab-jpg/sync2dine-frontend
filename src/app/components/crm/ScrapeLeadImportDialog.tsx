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

type Props = {
  onImport: (customers: Customer[]) => Promise<void> | void;
};

/** Paste or upload scraped lead rows (name + phone required). */
export function ScrapeLeadImportDialog({ onImport }: Props) {
  const [open, setOpen] = useState(false);
  const [paste, setPaste] = useState('');
  const [batchId, setBatchId] = useState(() => `scrape-${new Date().toISOString().slice(0, 10)}`);
  const [busy, setBusy] = useState(false);

  function rowsFromPaste(text: string): string {
    const trimmed = text.trim();
    if (!trimmed) return '';
    if (trimmed.toLowerCase().startsWith('name')) {
      return trimmed;
    }
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    const body = lines.map((line) => {
      const parts = line.split(/[,\t|;]/).map((p) => p.trim());
      const name = parts[0] || '';
      const phone = parts[1] || parts.find((p) => /\d{7,}/.test(p)) || '';
      const email = parts.find((p) => p.includes('@')) || '';
      const address = parts.slice(2).filter((p) => p !== phone && p !== email).join(' ');
      return [name, email, phone, address]
        .map((v) => (/,|"/.test(v) ? `"${v.replace(/"/g, '""')}"` : v))
        .join(',');
    });
    return ['name,email,phone,address', ...body].join('\n');
  }

  async function runImport(csvText: string) {
    const { customers, errors } = parseCustomersCsv(csvText);
    if (errors.length && !customers.length) {
      toast.error(errors[0]);
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
    }));
    if (!stamped.length) {
      toast.error('No leads found to import');
      return;
    }
    setBusy(true);
    try {
      await onImport(stamped);
      toast.success(`Imported ${stamped.length} lead${stamped.length === 1 ? '' : 's'} into Call Queue`);
      if (errors.length) toast.message(`${errors.length} row warning(s)`);
      setPaste('');
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-11">
          <Upload className="w-4 h-4 mr-2" />
          Import scraped leads
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import scraped leads</DialogTitle>
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
            <Label>Paste CSV or Name, Phone lines</Label>
            <p className="text-xs text-slate-500 mt-0.5">
              CSV headers: name,phone,email,address,notes — or one lead per line: Name, Phone
            </p>
            <Textarea
              className="mt-1 min-h-[140px] font-mono text-sm"
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={'name,phone\nJane Smith,+447700900123'}
            />
          </div>
          <div>
            <Label>Or upload CSV</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              className="mt-1"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const text = await file.text();
                await runImport(text);
              }}
            />
          </div>
          <Button
            className="w-full min-h-11"
            disabled={busy || !paste.trim()}
            onClick={() => runImport(rowsFromPaste(paste))}
          >
            {busy ? 'Importing…' : 'Import into Call Queue'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
